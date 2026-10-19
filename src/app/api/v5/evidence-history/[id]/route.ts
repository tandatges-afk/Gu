import {NextRequest,NextResponse} from 'next/server';
import {staffUser,requireAdmin,handleError,ApiError} from '@/lib/http';
import {db} from '@/lib/firebase-admin';
export const runtime='nodejs';
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{const me=await staffUser(req);requireAdmin(me);const {id}=await ctx.params;
 if(!/^[a-zA-Z0-9]{10,64}$/.test(id))throw new ApiError(400,'Sản phẩm không hợp lệ.');
 const [doc,queued]=await Promise.all([db().collection('inspectionEvidence').doc(id).get(),db().collection('inspectionCleanup').where('itemId','==',id).limit(20).get()]);
 return NextResponse.json({rounds:doc.data()?.rounds||[],pendingDelete:queued.size,maxRounds:7},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/evidence-history/[id]');}
}
