#!/usr/bin/env python3
"""GU v1 optional local CLIP image-search service.
Only listen on loopback. The Next.js API authenticates staff before forwarding image bytes.
No customer images are saved. The stock-image index is an independent PG table.
"""
from __future__ import annotations
import argparse
import hashlib
import hmac
import io
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
import psycopg
from psycopg.types.json import Jsonb
import torch
from transformers import CLIPModel, CLIPProcessor

MODEL_ID = 'openai/clip-vit-base-patch32'
MODEL_TAG = 'gu-clip-vit-b32-v1'
PHOTO_RE = re.compile(r'^/api/local-media/products/([A-Za-z0-9_-]{10,128})/([a-f0-9-]{36})\.(jpg|png|webp)$')
MAX_IMAGE_BYTES = 3 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000

torch.set_num_threads(max(1, min(4, int(os.environ.get('GU_VISUAL_AI_THREADS', '2')))))


def stock_path(url: str) -> Path | None:
    match = PHOTO_RE.fullmatch(url)
    if not match:
        return None
    base = Path(os.environ.get('GU_UPLOAD_DIR', '/var/lib/gu/uploads')).resolve()
    target = base.joinpath('products', match.group(1), match.group(2) + '.' + match.group(3)).resolve()
    if not target.is_relative_to(base / 'products'):
        return None
    return target


def parse_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError('Dung lượng ảnh không hợp lệ.')
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError('Chỉ hỗ trợ JPEG, PNG, WebP.')
        image.load()
        return ImageOps.exif_transpose(image).convert('RGB')
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('Ảnh không đọc được hoặc quá lớn.') from exc


def target_regions(image: Image.Image, category: str) -> list[Image.Image]:
    w, h = image.size
    if w < 32 or h < 32:
        return [image]
    top = image.crop((0, 0, w, max(32, int(h * .64))))
    bottom = image.crop((0, min(h-32, int(h * .36)), w, h))
    c = category.casefold()
    # Vietnamese categories are a query constraint. Crops only help locate the
    # garment in a full-body photograph; CLIP still compares clothing appearance.
    if category == 'ALL':
        return [image, top, bottom]
    if any(t in c for t in ('chân váy', 'chan vay', 'quần', 'quan', 'giày', 'giay')):
        return [bottom, image]
    if any(t in c for t in ('áo ', 'ao ', 'áo kiểu', 'ao kieu', 'áo sơ', 'áo thun', 'áo khoác')) or c in ('áo', 'ao'):
        return [top, image]
    return [image, top, bottom]


class Engine:
    def __init__(self) -> None:
        self.secret = os.environ.get('GU_VISUAL_AI_SECRET', '')
        if len(self.secret) < 32:
            raise RuntimeError('GU_VISUAL_AI_SECRET must be at least 32 characters')
        self.dsn = os.environ.get('DATABASE_URL', '')
        if not self.dsn:
            raise RuntimeError('Missing DATABASE_URL')
        self.model = CLIPModel.from_pretrained(MODEL_ID).eval()
        self.processor = CLIPProcessor.from_pretrained(MODEL_ID)
        self.predict_lock = threading.Lock()
        self.stop = threading.Event()
        self.cache: tuple[float, list[tuple[str, str, str, np.ndarray]]] = (0, [])
        self.cache_lock = threading.Lock()
        self.ensure_schema()

    def connection(self):
        return psycopg.connect(self.dsn, connect_timeout=5)

    def ensure_schema(self):
        with self.connection() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS gu_visual_ai_index (
                item_id text NOT NULL,
                image_path text NOT NULL,
                model_id text NOT NULL,
                image_hash text NOT NULL,
                embedding jsonb NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (item_id, image_path, model_id)
            )''')
            db.execute('CREATE INDEX IF NOT EXISTS gu_visual_ai_idx_model ON gu_visual_ai_index(model_id)')

    def image_features(self, images: list[Image.Image]) -> np.ndarray:
        inputs = self.processor(images=images, return_tensors='pt')
        with self.predict_lock, torch.inference_mode():
            vec = self.model.get_image_features(**inputs)
            if not isinstance(vec, torch.Tensor):
                vec = vec.pooler_output
            vec = torch.nn.functional.normalize(vec.float(), dim=-1)
        return vec.cpu().numpy()

    def index_batch(self, limit: int = 12) -> dict[str, int]:
        max_photos = max(1, min(5, int(os.environ.get('GU_VISUAL_AI_MAX_PHOTOS', '3'))))
        with self.connection() as db:
            # Inventory rows are read in bounded pages; never scan order/customer data.
            docs = db.execute('''SELECT id, data->'imagePaths' AS paths
                FROM gu_documents WHERE collection='items'
                  AND COALESCE(data->>'archivedAt','')=''
                  AND jsonb_typeof(data->'imagePaths')='array'
                ORDER BY id LIMIT 10000''').fetchall()
            known = set(db.execute('SELECT item_id,image_path FROM gu_visual_ai_index WHERE model_id=%s', (MODEL_TAG,)).fetchall())
            to_index = []
            live = set()
            for item_id, paths in docs:
                if not isinstance(paths, list):
                    continue
                for url in paths[:max_photos]:
                    if not isinstance(url, str):
                        continue
                    p = stock_path(url)
                    if not p:
                        continue
                    live.add((item_id, url))
                    if (item_id, url) not in known and len(to_index) < limit:
                        to_index.append((item_id, url, p))
            indexed = 0
            for item_id, url, path in to_index:
                try:
                    data = path.read_bytes()
                    image = parse_image(data)
                    emb = self.image_features([image])[0].tolist()
                    db.execute('''INSERT INTO gu_visual_ai_index(item_id,image_path,model_id,image_hash,embedding)
                        VALUES (%s,%s,%s,%s,%s)
                        ON CONFLICT(item_id,image_path,model_id) DO UPDATE SET
                        image_hash=EXCLUDED.image_hash,embedding=EXCLUDED.embedding,updated_at=now()''',
                        (item_id, url, MODEL_TAG, hashlib.sha256(data).hexdigest(), Jsonb(emb)))
                    indexed += 1
                except (ValueError, OSError) as exc:
                    # One damaged/missing photo must not block indexing the shop.
                    print(f'[visual-ai] skipped stock image item={item_id}: {type(exc).__name__}', flush=True)
            # Only remove entries when inventory scan was not truncated.
            if len(docs) < 10000:
                for item_id, url in known - live:
                    db.execute('DELETE FROM gu_visual_ai_index WHERE item_id=%s AND image_path=%s AND model_id=%s', (item_id, url, MODEL_TAG))
            if indexed or known - live:
                with self.cache_lock:
                    self.cache = (0, [])
            return {'indexed': indexed, 'remaining': max(0, len(live - known) - indexed), 'total': len(live)}

    def background(self):
        while not self.stop.is_set():
            try:
                result = self.index_batch()
                if result['indexed']:
                    print('[visual-ai] index:', result, flush=True)
            except Exception as exc:
                print('[visual-ai] index error:', type(exc).__name__, str(exc)[:150], flush=True)
            self.stop.wait(max(30, int(os.environ.get('GU_VISUAL_AI_INDEX_INTERVAL', '90'))))

    def candidates(self):
        with self.cache_lock:
            if time.monotonic() - self.cache[0] < 45:
                return self.cache[1]
        with self.connection() as db:
            rows = db.execute('''SELECT a.item_id,a.image_path,
                COALESCE(d.data->>'category',''),a.embedding
                FROM gu_visual_ai_index a JOIN gu_documents d
                ON d.collection='items' AND d.id=a.item_id
                WHERE a.model_id=%s AND COALESCE(d.data->>'archivedAt','')=''
                  AND (d.data->'imagePaths') ? a.image_path
                LIMIT 30000''', (MODEL_TAG,)).fetchall()
        vectors = []
        for item_id, url, category, emb in rows:
            if isinstance(emb, list) and len(emb) == 512:
                vectors.append((item_id, url, category, np.asarray(emb, dtype=np.float32)))
        with self.cache_lock:
            self.cache = (time.monotonic(), vectors)
        return vectors

    def search(self, data: bytes, category: str) -> dict:
        vectors = self.candidates()
        if not vectors:
            return {'ready': False, 'hits': [], 'indexedPhotos': 0}
        regions = target_regions(parse_image(data), category)
        q_vectors = self.image_features(regions)
        scored = {}
        for item_id, url, cat, v in vectors:
            if category != 'ALL' and cat != category:
                continue
            dots = q_vectors @ v
            # Whole image is preferred for catalog photographs, regions help
            # retrieve tops/bottoms from photos containing multiple garments.
            score = float(max(dots[0], np.max(dots[1:]) - .025 if len(dots) > 1 else dots[0]))
            prev = scored.get(item_id)
            if prev is None or score > prev[0]:
                scored[item_id] = (score, cat)
        ranked = sorted(((item_id, val[0], val[1]) for item_id, val in scored.items()), key=lambda x: (-x[1], x[0]))
        # Balanced ALL results: one outfit should not crowd out other garments.
        if category == 'ALL':
            top = []
            by_cat = {}
            for row in ranked:
                if by_cat.get(row[2], 0) >= 3:
                    continue
                top.append(row)
                by_cat[row[2]] = by_cat.get(row[2], 0) + 1
                if len(top) == 8:
                    break
            for row in ranked:
                if len(top) >= 8:
                    break
                if row not in top:
                    top.append(row)
            ranked = top
        return {'ready': True, 'hits': [{'id': item_id, 'score': round(score, 5)} for item_id, score, _ in ranked[:8]], 'indexedPhotos': len(vectors)}


class Handler(BaseHTTPRequestHandler):
    engine: Engine

    def log_message(self, format, *args):
        # No uploaded image data or auth token in logs.
        pass

    def respond(self, status, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path != '/search':
            return self.respond(404, {'error': 'Not found'})
        if not hmac.compare_digest(self.headers.get('X-GU-Visual-Token', ''), self.engine.secret):
            return self.respond(403, {'error': 'Forbidden'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_IMAGE_BYTES:
                return self.respond(413, {'error': 'Image limit 3MB'})
            category = unquote(self.headers.get('X-GU-Category', 'ALL'))
            if len(category) > 100 or any(ord(c) < 32 for c in category):
                return self.respond(400, {'error': 'Invalid category'})
            payload = self.rfile.read(length)
            self.respond(200, self.engine.search(payload, category))
        except (ValueError, UnidentifiedImageError) as exc:
            self.respond(400, {'error': str(exc)[:120]})
        except Exception as exc:
            print('[visual-ai] request error:', type(exc).__name__, flush=True)
            self.respond(503, {'error': 'Visual worker temporarily unavailable'})


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--backfill', action='store_true', help='Index existing stock and exit; does not start HTTP')
    p.add_argument('--port', type=int, default=int(os.environ.get('GU_VISUAL_AI_PORT', '3395')))
    args = p.parse_args()
    engine = Engine()
    if args.backfill:
        for _ in range(100000):
            stats = engine.index_batch(30)
            print('BACKFILL', stats, flush=True)
            if stats['remaining'] == 0:
                break
        return
    Handler.engine = engine
    threading.Thread(target=engine.background, name='inventory-indexer', daemon=True).start()
    print(f'[visual-ai] CLIP ready on 127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()

if __name__ == '__main__':
    main()
