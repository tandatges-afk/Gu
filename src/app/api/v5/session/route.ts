import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError} from '@/lib/http';
export async function GET(req:NextRequest){try{const user=await staffUser(req);return NextResponse.json({role:user.role,name:user.name},{headers:{'Cache-Control':'no-store'}});}catch(e){return handleError(e);}}
