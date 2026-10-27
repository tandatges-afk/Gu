import {NextRequest,NextResponse} from 'next/server';
import {staffUser,handleError} from '@/lib/http';
import {registrationPeriod} from '@/lib/shift-schedule';
export async function GET(req:NextRequest){
 try{
  const user=await staffUser(req,{allowSchedule:true});
  const period=registrationPeriod(new Date());
  const access=user.role==='admin'||user.shift?.canWork?'WORK':period.isOpen?'REGISTER':'DENIED';
  return NextResponse.json({role:user.role,name:user.name,access,shift:user.shift||null,registration:period,
   message:access==='DENIED'?'Bạn chưa có ca làm ở thời điểm này. Chỉ có thể đăng ký ca vào Chủ nhật 12:00–20:00.':access==='REGISTER'?'Chỉ được truy cập màn đăng ký ca, không thể xử lý đơn và kho.':null},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){return handleError(e,'GET /api/v5/session');}
}
