/** Product images saved locally on VPS. Ownership validated by UID embedded in a UUID path. */
export function validProductImageUrl(url:unknown,uid:string,_cloudName:string):url is string {
 if(typeof url!=='string'||!/^[A-Za-z0-9_-]{10,128}$/.test(uid))return false;
 return new RegExp('^/api/local-media/products/'+uid+'/[a-f0-9-]{36}\\.(?:jpg|png|webp)$').test(url);
}
export function imageMagicMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  if (mime === 'image/webp') return bytes.length >= 12 &&
    [82,73,70,70].every((n,i)=>bytes[i]===n) && [87,69,66,80].every((n,i)=>bytes[i+8]===n);
  return false;
}

/** Cloudinary dynamic delivery, without modifying stored original URLs.
 * Thumbnail variants are cached CDN-side; q_auto/f_auto minimize bandwidth. */
export function thumbCloudinaryUrl(url:string,_width=360):string{return url;}
