/** Reject browser cross-site mutations. Not a substitute for authorization. */
export function isTrustedMutationOrigin(headers:Pick<Headers,'get'>):boolean {
  const site=headers.get('sec-fetch-site');
  if(site==='cross-site')return false;
  const origin=headers.get('origin');
  if(!origin)return true; // CLI/service requests may omit Origin; auth remains mandatory.
  const host=headers.get('host');
  if(!host)return false;
  try {
    const parsed=new URL(origin);
    return (parsed.protocol==='https:'||parsed.protocol==='http:') && parsed.host===host;
  }catch {return false;}
}
