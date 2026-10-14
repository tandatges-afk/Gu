/** Product photos are PUBLIC catalog assets on Cloudinary, never personal customer photos. */
export function validProductImageUrl(url: unknown, uid: string, cloudName: string): url is string {
  if (typeof url !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !/^[a-zA-Z0-9]+$/.test(uid)) return false;
  const pattern = new RegExp('^https://res\\.cloudinary\\.com/' + cloudName + '/image/upload/v[0-9]+/gu/products/' + uid + '/[a-f0-9-]{36}\\.(?:jpg|jpeg|png|webp)$');
  return pattern.test(url);
}

export function imageMagicMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  if (mime === 'image/webp') return bytes.length >= 12 &&
    [82,73,70,70].every((n,i)=>bytes[i]===n) && [87,69,66,80].every((n,i)=>bytes[i+8]===n);
  return false;
}
