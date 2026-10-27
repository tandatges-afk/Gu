import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError} from '@/lib/http';
import {activeRegistrationPeriod} from '@/lib/shift-registration-window';
export async function GET(req:NextRequest){
 try{
  const user=await staffUser(req,{allowSchedule:true});
  const period=await activeRegistrationPeriod(new Date());
  const access=user.role==='admin'||user.shift?.canWork?'WORK':period.isOpen?'REGISTER':'DENIED';
  return NextResponse.json({role:user.role,name:user.name,access,shift:user.shift||null,registration:period,
   message:access==='DENIED'?'Bạn chưa có ca làm ở thời điểm này. Chỉ có thể đăng ký ca trong thời gian được mở (Chủ nhật hoặc Admin mở sớm).':access==='REGISTER'?'Chỉ được truy cập màn đăng ký ca, không thể xử lý đơn và kho.':null},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/session');}
}
