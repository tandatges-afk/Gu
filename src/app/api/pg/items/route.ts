import {NextRequest,NextResponse} from 'next/server';
import {pgRows} from '@/lib/pg-vps';
import {pgCurrentUser,pgError,requirePgAdmin,checkOrigin,jsonObject,needString,pgAmount,pgUuid,PgHttpError} from '@/lib/pg-security';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
  await pgCurrentUser(req);
  const search=new URL(req.url).searchParams.get('q')?.trim().slice(0,80)||'';
  const pattern='%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%';
  const items=await pgRows(`SELECT i.id,i.name,i.sku,i.hanger_code,i.size,i.color,i.status,i.daily_rate::text,
      i.replacement_value::text,c.name AS category,i.category_id,i.image_urls
    FROM inventory_items i LEFT JOIN categories c ON c.id=i.category_id
    WHERE i.archived_at IS NULL AND (i.name ILIKE $1 ESCAPE '\\' OR i.sku ILIKE $1 ESCAPE '\\' OR coalesce(i.color,'') ILIKE $1 ESCAPE '\\')
    ORDER BY i.created_at DESC LIMIT 200`,[pattern]);
  return NextResponse.json({items});
}catch(e){return pgError(e);}}
export async function POST(req:NextRequest){try{
  checkOrigin(req);requirePgAdmin(await pgCurrentUser(req));const body=await jsonObject(req);
  const name=needString(body.name,'Tên sản phẩm',180);
  const sku=needString(body.sku,'Mã sản phẩm',60);
  const categoryId=body.categoryId?pgUuid(body.categoryId,'Danh mục'):null;
  const dailyRate=pgAmount(body.dailyRate,'Giá thuê');
  const replacementValue=pgAmount(body.replacementValue??0,'Giá trị sản phẩm');
  const [item]=await pgRows(`INSERT INTO inventory_items(name,sku,hanger_code,category_id,size,color,daily_rate,replacement_value)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,sku,status`,[name,sku,body.hangerCode?needString(body.hangerCode,'Mã móc',80):null,categoryId,String(body.size||'').slice(0,80),String(body.color||'').slice(0,80),dailyRate,replacementValue]);
  return NextResponse.json({item},{status:201});
}catch(e){return pgError(e);}}
export async function PATCH(req:NextRequest){try{
  checkOrigin(req);requirePgAdmin(await pgCurrentUser(req));const body=await jsonObject(req);
  const id=pgUuid(body.id);const status=body.status;
  if(!['AVAILABLE','LAUNDRY','MAINTENANCE','MISSING'].includes(String(status)))throw new PgHttpError(400,'Trạng thái không hợp lệ.');
  const [item]=await pgRows(`UPDATE inventory_items SET status=$2,updated_at=now()
    WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM item_reservations r WHERE r.item_id=$1 AND r.state='PICKED_UP')
    RETURNING id,name,status`,[id,status]);
  if(!item)throw new PgHttpError(409,'Không thể đổi trạng thái khi sản phẩm đang được giao cho khách.');
  return NextResponse.json({item});
}catch(e){return pgError(e);}}
