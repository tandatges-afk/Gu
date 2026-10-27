import {productSearchText} from './product-search.ts';
/** Accent-insensitive substring search without PostgreSQL extensions.
 * Only validated field names are included in SQL; all user inputs are bound.
 * Stable ID keyset pagination avoids silently skipping identical names.
 */
export const VN_SEARCH_FROM='àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
export const VN_SEARCH_TO='aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
export type SubstringKind='items'|'customers';
export function buildSubstringCatalogQuery(input:{kind:SubstringKind;term:string;take:number;afterId?:string;mode?:string;status?:string;category?:string;rentalGroup?:string}){
 const {kind,term,take,afterId,mode='',status='ALL',category='ALL',rentalGroup='ALL'}=input;
 if(!Number.isInteger(take)||take<1||take>50)throw Error('Page size invalid');
 if(afterId&&!/^[\w-]{1,128}$/.test(afterId))throw Error('Cursor invalid');
 const normalized=productSearchText(term);
 const digits=term.replace(/\D/g,'');
 const code=term.toLowerCase().replace(/[^a-z0-9-]/g,'');
 const params:unknown[]=[kind,VN_SEARCH_FROM,VN_SEARCH_TO];
 const bind=(v:unknown)=>{params.push(v);return '$'+params.length;};
 // Normalize Vietnamese chars before comparing. Numeric code searches are
 // combined with name search unless the caller explicitly requests code-only.
 const folded=`translate(lower(concat_ws(' ',data->>'name',${kind==='items'?"data->>'size',data->>'color',data->>'category'":"''"})), $2, $3)`;
 let filter='collection=$1';
 const needles:string[]=[];
 if(mode!=='code'&&normalized)needles.push(`${folded} LIKE ${bind('%'+normalized+'%')}`);
 if(kind==='items'&&code)needles.push(`lower(coalesce(data->>'hangerCode','')) LIKE ${bind('%'+code+'%')}`);
 if(kind==='customers'&&digits)needles.push(`regexp_replace(coalesce(data->>'phone',''),'[^0-9]','','g') LIKE ${bind('%'+digits+'%')}`);
 if(!needles.length)filter+=' AND FALSE';else filter+=' AND ('+needles.join(' OR ')+')';
 if(kind==='items'){
  filter+=" AND NOT (data ? 'archivedAt' AND coalesce(data->>'archivedAt','') NOT IN ('','null'))";
  if(status!=='ALL')filter+=` AND data->>'status'=${bind(status)}`;
  if(category!=='ALL')filter+=` AND data->>'category'=${bind(category)}`;
  if(rentalGroup!=='ALL'){
   const cam="(coalesce(data->>'category','') ~* '(máy[[:space:]]*ảnh|may[[:space:]]*anh|camera)' AND coalesce(data->>'category','') !~* '(phụ[[:space:]]*kiện|phu[[:space:]]*kien|accessor)')";
   filter+=' AND '+(rentalGroup==='CAMERA'?cam:'NOT '+cam);
  }
 }
 if(afterId)filter+=` AND id > ${bind(afterId)}`;
 const sql=`SELECT id,data FROM gu_documents WHERE ${filter} ORDER BY id ASC LIMIT ${bind(take+1)}`;
 return {sql,params};
}
