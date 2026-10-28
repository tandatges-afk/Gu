import {NextRequest,NextResponse} from 'next/server';
import {staffUser,requireAdmin,handleError} from '@/lib/http';
import {savePhoto,readPhoto,deletePhoto} from '@/lib/local-media';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{requireAdmin(await staffUser(req));return NextResponse.json({ok:true,provider:'local',bucket:'VPS private',location:'local',projectId:'GU_UPLOAD_DIR',writeVerified:false});}catch(e){return handleError(e);}}
export async function POST(req:NextRequest){
 try{const me=await staffUser(req);requireAdmin(me);
  const id=randomUUID(),photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
  await savePhoto('secure',me.uid,id,photo,'image/png');
  try{const got=await readPhoto('secure',me.uid,id,'png');if(!got.equals(photo))throw Error('File dữ liệu ảnh không khớp');}
  finally{await deletePhoto('secure',me.uid,id,'png');}
  return NextResponse.json({ok:true,provider:'local',bucket:'VPS private',location:'local',projectId:'GU_UPLOAD_DIR',writeVerified:true});
 }catch(e){return handleError(e);}
}
