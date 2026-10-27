/** GU v3: avoid sending oversized phone photos over 4G/5G. */
export const MAX_IMAGES = 5;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_PHONE_SOURCE_BYTES = 24 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHONE_ONLY_IMAGE_TYPES = ['image/heic', 'image/heif'] as const;

export function validateImageSelection(existing:number, incoming:number):string | null {
  if (!Number.isInteger(incoming) || incoming < 1) return 'Hãy chọn ít nhất một ảnh.';
  if (existing + incoming > MAX_IMAGES) return `Mỗi sản phẩm được lưu tối đa ${MAX_IMAGES} ảnh.`;
  return null;
}

export function validateImageSource(type:string, size:number):string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number]) && !PHONE_ONLY_IMAGE_TYPES.includes(type as (typeof PHONE_ONLY_IMAGE_TYPES)[number]))
    return 'GU hỗ trợ JPG, PNG, WebP và thử chuyển HEIC/HEIF thành JPG trên điện thoại. Vui lòng chọn định dạng ảnh phù hợp.';
  if (!size || size > MAX_PHONE_SOURCE_BYTES) return 'Ảnh gốc phải có dung lượng không quá 24 MB.';
  return null;
}

/** Browser-only and only called after a user chooses a photo. Server validates again. */
export async function preparePhonePhoto(file:File):Promise<File> {
  const reason = validateImageSource(file.type,file.size);
  if (reason) throw new Error(reason);
  if (file.size <= 650_000 && ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return file;
  let bitmap:ImageBitmap|null=null;
  let image:HTMLImageElement|null=null;
  let tempUrl='';
  try {
    try { bitmap=await createImageBitmap(file); }
    catch {
      tempUrl=URL.createObjectURL(file);
      image=new Image();
      image.src=tempUrl;
      await image.decode();
    }
    const source=bitmap || image;
    if(!source)throw new Error('Không mở được ảnh.');
    const width=bitmap?.width || image?.naturalWidth || 0;
    const height=bitmap?.height || image?.naturalHeight || 0;
    const scale = Math.min(1, 1800 / Math.max(width,height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(width*scale));
    canvas.height = Math.max(1,Math.round(height*scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    context.drawImage(source,0,0,canvas.width,canvas.height);
    for (const quality of [0.84,0.72,0.58]) {
      const blob = await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if (!blob) throw new Error('Không thể tối ưu ảnh từ điện thoại.');
      if (blob.size<=MAX_UPLOAD_BYTES) return new File([blob],file.name.replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg'});
    }
    throw new Error('Ảnh vẫn lớn hơn 3 MB sau tối ưu. Vui lòng chọn ảnh nhỏ hơn.');
  } catch (error) {
    if(file.size<=MAX_UPLOAD_BYTES && ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return file;
    if(PHONE_ONLY_IMAGE_TYPES.includes(file.type as (typeof PHONE_ONLY_IMAGE_TYPES)[number]))
      throw new Error('Trình duyệt chưa đọc được ảnh HEIC/HEIF. Hãy xuất ảnh JPG hoặc đổi Camera → Formats → Most Compatible rồi thử lại.');
    throw error;
  } finally { bitmap?.close();if(tempUrl)URL.revokeObjectURL(tempUrl); }
}
