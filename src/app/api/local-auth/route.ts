import {NextRequest,NextResponse} from 'next/server';
import {authenticate,verifyToken,SESSION_COOKIE} from '@/lib/local-auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const cookieOpts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:12*60*60};
export async function GET(req:NextRequest){
 try{const user=await verifyToken(req.cookies.get(SESSION_COOKIE)?.value||'');return NextResponse.json({user:{uid:user.uid,email:user.email}}, {headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({user:null},{status:401,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(req:NextRequest){
 try{const body=await req.json() as {email?:string;password?:string};
  if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>250||body.password.length>512)throw Error('Invalid credentials');
  const user=await authenticate(body.email,body.password);
  const response=NextResponse.json({user:{uid:user.uid,email:user.email}},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(SESSION_COOKIE,user.token,cookieOpts);return response;
 }catch{return NextResponse.json({error:'Email hoặc mật khẩu không đúng.'},{status:401,headers:{'Cache-Control':'no-store'}});}
}
export async function DELETE(){const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(SESSION_COOKIE,'',{...cookieOpts,maxAge:0});return response;}
