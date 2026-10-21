import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {staffUser,handleError,jsonBody,ApiError} from '@/lib/http';
import {assertText} from '@/lib/rental';
import {auditInTransaction} from '@/lib/audit';
export const runtime='nodejs';
async function categoryChange(req:NextRequest,ctx:{params:Promise<{id:string}>},deleting:boolean){
 try{
  const me=await staffUser(req);
  if(me.role!=='admin')throw new ApiError(403,'Chỉ Admin được sửa hoặc xóa danh mục.');
  const {id}=await ctx.params;
  const ref=db().collection('categories').doc(id);
  const name=deleting?'':assertText((await jsonBody(req)).name,'Tên danh mục',50);
  const newId=deleting?'':encodeURIComponent(name.toLocaleLowerCase('vi-VN'));
  await db().runTransaction(async tx=>{
    const snapshot=await tx.get(ref);
    if(!snapshot.exists)throw new ApiError(404,'Danh mục không tồn tại.');
    const oldName=String(snapshot.data()?.name||'');
    const referenced=await tx.get(db().collection('items').where('category','==',oldName).limit(201));
    const nextRef=db().collection('categories').doc(newId || id);
    const nextSnap=!deleting&&newId!==id?await tx.get(nextRef):null;
    if(deleting&&!referenced.empty)throw new ApiError(409,'Danh mục còn sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước khi xóa.');
    if(!deleting&&referenced.size>200)throw new ApiError(409,'Danh mục có hơn 200 sản phẩm. Hãy chia việc chuyển danh mục để tránh vượt giới hạn giao dịch.');
    if(nextSnap?.exists)throw new ApiError(409,'Tên danh mục đã tồn tại.');
    const now=new Date().toISOString();
    if(!deleting)referenced.docs.forEach(item=>tx.update(item.ref,{category:name,updatedAt:now}));
    if(deleting)tx.delete(ref);else if(id===newId)tx.update(ref,{name});else {tx.delete(ref);tx.create(nextRef,{name,createdAt:String(snapshot.data()?.createdAt||now)});}
    auditInTransaction(tx,me,deleting?'CATEGORY_DELETE':'CATEGORY_EDIT','category',id,deleting?`Xóa ${oldName}`:`${oldName} → ${name}`,now);
  });
  return NextResponse.json({ok:true});
 }catch(e){return handleError(e);}
}
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){return categoryChange(req,ctx,false);}
export async function DELETE(req:NextRequest,ctx:{params:Promise<{id:string}>}){return categoryChange(req,ctx,true);}
