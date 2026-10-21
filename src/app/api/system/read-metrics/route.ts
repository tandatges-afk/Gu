import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError,requireAdmin} from '@/lib/http';
import {readMetrics} from '@/lib/read-optimization';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{const me=await staffUser(req);requireAdmin(me);return NextResponse.json(readMetrics(),{headers:{'Cache-Control':'private,no-store'}});}
 catch(e){return handleError(e,'GET /api/system/read-metrics');}
}
