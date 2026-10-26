import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function GET(){
  // Process liveness only; this endpoint does not verify Firebase or expose secrets.
  return NextResponse.json({status:'ok',build:'v6-vps-pilot',time:new Date().toISOString()},
    {headers:{'Cache-Control':'no-store'}});
}
