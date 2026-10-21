import {NextRequest,NextResponse} from 'next/server';
import {staffUser,requireAdmin,handleError,ApiError} from '@/lib/http';
import {runEvidenceCleanup} from '@/lib/evidence-retention';
import {runSensitiveEvidenceCleanup,queueReviewedEvidenceBackfill} from '@/lib/sensitive-evidence-cleanup';
export const runtime='nodejs';export const preferredRegion='sin1';
export async function POST(req:NextRequest){
 try{const me=await staffUser(req);requireAdmin(me);await queueReviewedEvidenceBackfill();return NextResponse.json({inspections:await runEvidenceCleanup(10),sensitive:await runSensitiveEvidenceCleanup(10)},{headers:{'Cache-Control':'no-store'}});}catch(e){return handleError(e);}
}
export async function GET(req:NextRequest){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)throw new ApiError(401,'Cron secret không hợp lệ.');
  await queueReviewedEvidenceBackfill();return NextResponse.json({inspections:await runEvidenceCleanup(15),sensitive:await runSensitiveEvidenceCleanup(15)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e);}
}
