import { NextRequest, NextResponse } from 'next/server';
import { staffUser, handleError, ApiError } from '@/lib/http';
import { imageMagicMatches, validProductImageUrl } from '@/lib/cloudinary-images';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function POST(req: NextRequest) {
  try {
    // Verify the Firebase ID token AND staff role before accepting any upload.
    const me = await staffUser(req);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    const key = process.env.CLOUDINARY_API_KEY || '';
    const secret = process.env.CLOUDINARY_API_SECRET || '';
    if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !key || !secret)
      throw new ApiError(503, 'Chưa thiết lập Cloudinary trên máy chủ.');
    const maxBytes = 3 * 1024 * 1024;
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > maxBytes + 64_000) throw new ApiError(413, 'Mỗi ảnh tối đa 3 MB.');
    const form = await req.formData();
    const image = form.get('file');
    if (!(image instanceof File)) throw new ApiError(400, 'Chưa chọn ảnh.');
    if (image.size === 0 || image.size > maxBytes) throw new ApiError(413, 'Mỗi ảnh phải từ 1 byte đến 3 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type))
      throw new ApiError(400, 'Chỉ hỗ trợ JPEG, PNG, WebP.');
    const header = new Uint8Array(await image.slice(0, 16).arrayBuffer());
    if (!imageMagicMatches(header, image.type)) throw new ApiError(400, 'Nội dung ảnh không đúng định dạng.');

    const id = randomUUID();
    const publicId = `gu/products/${me.uid}/${id}`;
    const upload = new FormData();
    upload.append('file', image, `photo.${image.type==='image/png'?'png':image.type==='image/webp'?'webp':'jpg'}`);
    upload.append('public_id', publicId);
    upload.append('overwrite', 'false');
    const result = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') },
      body: upload,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    if (!result.ok) {
      console.error('Cloudinary upload failed:', result.status);
      throw new ApiError(502, 'Cloudinary từ chối tải ảnh. Kiểm tra quyền, hạn mức và thông tin API.');
    }
    const response: unknown = await result.json();
    const url = (response && typeof response==='object' && 'secure_url' in response)
      ? (response as {secure_url:unknown}).secure_url : undefined;
    if (!validProductImageUrl(url, me.uid, cloudName))
      throw new ApiError(502, 'Cloudinary trả về liên kết ảnh không hợp lệ.');
    return NextResponse.json({ path:url }, {status:201});
  } catch (error) { return handleError(error); }
}
