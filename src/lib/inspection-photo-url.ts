/** GU VPS inspection evidence URL parser.
 * Only accept a local-media inspection upload; never accept arbitrary URLs.
 * The proofUploads record is the authoritative owner/order/phase check.
 */
export type InspectionPhotoUrl={url:string;uid:string;id:string};
const INSPECTION_PATH=/^\/api\/local-media\/inspections\/([A-Za-z0-9_-]{10,128})\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(jpg|png|webp)$/;
export function parseInspectionPhotoUrl(raw:unknown,appUrl:string|undefined):InspectionPhotoUrl|null{
 if(typeof raw!=='string'||!raw||raw.length>700)return null;
 let path=raw;
 if(/^https?:\/\//i.test(raw)){
  try{
   if(!appUrl)return null;
   const site=new URL(appUrl);const input=new URL(raw);
   if(input.origin!==site.origin||input.username||input.password||input.search||input.hash)return null;
   path=input.pathname;
  }catch{return null;}
 }
 const match=INSPECTION_PATH.exec(path);
 return match?{url:path,uid:match[1],id:match[2]}:null;
}
