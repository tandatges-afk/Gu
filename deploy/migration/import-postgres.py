#!/usr/bin/env python3
"""Offline migration staging: import exported Firestore JSONL into PostgreSQL JSONB.
DOES NOT switch GU production APIs to PostgreSQL or delete Firestore records.
Requires: pip install 'psycopg[binary]>=3.2,<4'
"""
import os, json, hashlib, pathlib, sys
import psycopg
from psycopg.types.json import Jsonb

if len(sys.argv) != 2:
    raise SystemExit('Usage: python import-postgres.py /private/export-directory')
root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
dsn = os.environ.get('DATABASE_URL')
if not dsn:
    raise SystemExit('DATABASE_URL required; never paste secrets in terminal history')
with psycopg.connect(dsn) as con:
    with con.transaction():
        for collection, metadata in manifest['collections'].items():
            file = root / f'{collection}.jsonl'
            assert hashlib.sha256(file.read_bytes()).hexdigest() == metadata['sha256'], f'Bad checksum for {collection}'
            count = 0
            with con.cursor() as cur, file.open(encoding='utf-8') as reader:
                for line in reader:
                    row = json.loads(line)
                    cur.execute('INSERT INTO gu_migration_document (collection,doc_id,payload) VALUES (%s,%s,%s) ON CONFLICT (collection,doc_id) DO UPDATE SET payload=EXCLUDED.payload,migrated_at=now()',
                                (collection,row['id'],Jsonb(row['data'])))
                    count += 1
            if count != metadata['count']:
                raise RuntimeError(f'Count mismatch for {collection}: {count} != {metadata["count"]}')
            print(f'{collection}: {count} imported and verified')
        con.execute('INSERT INTO gu_migration_runs(exported_at,manifest) VALUES (%s,%s)', (manifest['at'],Jsonb(manifest)))
        for collection,metadata in manifest['collections'].items():
            count = con.execute('SELECT count(*) FROM gu_migration_document WHERE collection=%s',(collection,)).fetchone()[0]
            if count < metadata['count']:
                raise RuntimeError(f'Database verification failed for {collection}')
print('Staging import committed. Production APIs still use Firebase.')
