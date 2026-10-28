import {NextRequest,NextResponse} from 'next/server';
import {authenticate,verifyToken,SESSION_COOKIE} from '@/lib/local-auth';
import {isTrustedMutationOrigin} from '@/lib/request-origin';
export const runtime='nodejs';export const dynamic='force-dynamic';
const cookieOpts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:12*60*60};
export async function GET(req:NextRequest){
 try{const user=await verifyToken(req.cookies.get(SESSION_COOKIE)?.value||'');return NextResponse.json({user:{uid:user.uid,email:user.email,username:user.username}}, {headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({user:null},{status:401,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(req:NextRequest){
 if(!isTrustedMutationOrigin(req.headers))return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{const body=await req.json() as {username?:string;email?:string;password?:string};
  const identity=body.username??body.email;
  if(typeof identity!=='string'||typeof body.password!=='string'||identity.length>250||body.password.length>512)throw Error('Invalid credentials');
  const user=await authenticate(identity,body.password);
  const response=NextResponse.json({user:{uid:user.uid,email:user.email,username:user.username}},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(SESSION_COOKIE,user.token,cookieOpts);return response;
 }catch{return NextResponse.json({error:'Tên đăng nhập hoặc mật khẩu không đúng.'},{status:401,headers:{'Cache-Control':'no-store'}});}
}
export async function DELETE(req:NextRequest){
 if(!isTrustedMutationOrigin(req.headers))return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403,headers:{'Cache-Control':'no-store'}});
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(SESSION_COOKIE,'',{...cookieOpts,maxAge:0});return response;}
