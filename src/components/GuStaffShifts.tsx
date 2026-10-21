'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {CalendarClock,CheckCircle2,Clock3,LoaderCircle,RefreshCcw,Save,ShieldCheck,Users} from 'lucide-react';
import type {ShiftId,ShiftSeat} from '@/lib/shift-schedule';
import {MIN_WORK_DAYS,SHIFT_MAX_STAFF,isoWeekMonday,vnDate} from '@/lib/shift-schedule';

type Slot = {date:string;id:ShiftId;start:string;end:string;label:string;key:string;members:ShiftSeat[];remaining:number};
type Week = {weekStart:string;weekEnd:string;slots:Slot[];selected:string[];canEdit:boolean;
 period:{isOpen:boolean;weekStart:string;opensAt:string;closesAt:string};stats?:{uid:string;name:string;days:number;shifts:number;compliant:boolean}[]};
type Caller=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
const dayLabel=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'UTC'});
const prettyDateTime=(iso:string)=>new Date(iso).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
export function GuStaffShifts({api,isAdmin=false,registrationOnly=false}: {api:Caller;isAdmin?:boolean;registrationOnly?:boolean}){
 const [week,setWeek]=useState<Week|null>(null);
 const [view,setView]=useState<'next'|'current'>('next');
 const [draft,setDraft]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{const requested=view==='current'?isoWeekMonday(vnDate(new Date())):null;const response=await api<Week>('shifts'+(requested?'?week='+requested:''));setWeek(response);setDraft(response.selected);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Không thể tải lịch ca.');}
  finally{setLoading(false);}
 },[api,view]);
 useEffect(()=>{void load();},[load]);
 const selected=new Set(draft);
 const distinctDays=new Set(draft.map(id=>id.slice(0,10))).size;
 const changed=Boolean(week)&&([...week!.selected].sort().join('|')!==[...draft].sort().join('|'));
 const days=useMemo(()=>Array.from(new Set(week?.slots.map(s=>s.date)||[])),[week]);
 const toggle=(slot:Slot)=>{
  if(!week?.canEdit||isAdmin)return;
  setMessage('');setError('');
  if(selected.has(slot.key)){setDraft(draft.filter(x=>x!==slot.key));return;}
  if(slot.remaining===0){setError('Ca này đã đủ 2 nhân viên. Vui lòng chọn ca khác.');return;}
  setDraft([...draft,slot.key]);
 };
 const submit=async()=>{
  if(!week?.canEdit||saving||!changed)return;
  if(distinctDays<MIN_WORK_DAYS){setError('Bạn phải chọn ít nhất 5 ngày khác nhau trong tuần trước khi lưu.');return;}
  setSaving(true);setError('');setMessage('');
  try{await api('shifts',{method:'PUT',body:JSON.stringify({slotIds:draft})});
   await load();setMessage('Đã xác nhận đăng ký ca. Ca được giữ theo thứ tự giao dịch thành công.');
  }catch(e){setError(e instanceof Error?e.message:'Không thể đăng ký ca.');await load();}
  finally{setSaving(false);}
 };
 return <section className="gu-shifts-panel">
  <div className="gu-shifts-header"><div><div className="eyebrow">LỊCH LÀM VIỆC</div><h2><CalendarClock size={24}/> Đăng ký ca tuần</h2>
   <p>Ba ca/ngày: <b>08:00–13:00</b>, <b>13:00–17:00</b>, <b>17:00–22:00</b>. Mỗi ca tối đa {SHIFT_MAX_STAFF} nhân viên, không giới hạn số ca một người làm trong ngày.</p></div>
   <div className="gu-shifts-header-buttons">
    {!registrationOnly&&<><button className={'btn '+(view==='current'?'btn-dark':'btn-white')} type="button" onClick={()=>setView('current')}>Tuần này</button>
    <button className={'btn '+(view==='next'?'btn-dark':'btn-white')} type="button" onClick={()=>setView('next')}>Tuần sau</button></>}
    <button className="btn btn-white" type="button" onClick={()=>void load()} disabled={loading} aria-label="Tải lại lịch ca"><RefreshCcw size={16}/> Làm mới</button>
   </div></div>
  {loading&&!week&&<div className="center-screen"><LoaderCircle className="spin"/> Đang tải lịch…</div>}
  {week&&<>
   <div className="gu-shifts-info"><Clock3 size={18}/><div><b>Tuần {dayLabel(week.weekStart)} – {dayLabel(week.weekEnd)}</b><span>Đăng ký Chủ nhật từ {prettyDateTime(week.period.opensAt)} đến trước {prettyDateTime(week.period.closesAt)} (giờ Việt Nam).</span></div></div>
   {!isAdmin&&<p className="gu-shifts-rules"><ShieldCheck size={17}/>{week.canEdit?'Đang mở đăng ký. Chọn đủ ít nhất 5 ngày rồi xác nhận. Ai lưu thành công trước sẽ giữ chỗ trước.':'Ngoài giờ đăng ký, lịch chỉ để xem. Ca đã đủ 2 người sẽ tự đóng.'}</p>}
   <div className="gu-shifts-grid">
    {days.map(day=><div className="gu-shifts-day" key={day}><strong>{dayLabel(day)}</strong>
      {week.slots.filter(s=>s.date===day).map(s=>{
       const checked=selected.has(s.key);const full=s.remaining===0&&!checked;
       return <button type="button" key={s.key} className={'gu-shifts-slot'+(checked?' is-selected':'')+(full?' is-full':'')}
         disabled={isAdmin||!week.canEdit||full||saving} aria-pressed={checked} onClick={()=>toggle(s)}>
        <span className="gu-shifts-slot-title"><b>{s.label}</b><span>{s.start}–{s.end}</span></span>
        <span className="gu-shifts-slot-meta">{checked?<><CheckCircle2 size={14}/> Đã chọn</>:full?'Đủ 2/2':`${s.members.length}/2 người`}</span>
        {s.members.length>0&&<span className="gu-shifts-members">{s.members.map(m=>m.name).join(' · ')}</span>}
       </button>;
      })}
    </div>)}
   </div>
   {!isAdmin&&<div className="gu-shifts-footer"><div><b>{distinctDays}/7 ngày · {draft.length} ca</b><p>{distinctDays>=MIN_WORK_DAYS?'Đã đạt mức tối thiểu 5 ngày.':'Cần chọn thêm '+(MIN_WORK_DAYS-distinctDays)+' ngày.'}</p></div>
     {week.canEdit&&<button className="btn btn-dark" type="button" disabled={!changed||distinctDays<MIN_WORK_DAYS||saving} onClick={()=>void submit()}>{saving?<LoaderCircle size={16} className="spin"/>:<Save size={16}/>} Xác nhận đăng ký</button>}</div>}
   {isAdmin&&<div className="gu-shifts-stats"><h3><Users size={19}/> Thống kê nhân viên đăng ký</h3>
    <p>Danh sách nhân viên đã đăng ký trong tuần, kiểm tra tối thiểu {MIN_WORK_DAYS} ngày. Nhân viên chưa chọn ca sẽ không xuất hiện trong bảng; cần đối chiếu với danh sách nhân sự.</p>
    <div className="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Số ngày</th><th>Số ca</th><th>Đăng ký</th></tr></thead><tbody>
     {week.stats?.map(s=><tr key={s.uid}><td>{s.name}</td><td>{s.days}/7</td><td>{s.shifts}</td><td>{s.compliant?'Đạt':'Thiếu ngày'}</td></tr>)}
     {!week.stats?.length&&<tr><td colSpan={4}>Chưa có nhân viên đăng ký.</td></tr>}
    </tbody></table></div></div>}
  </>}
  {error&&<div className="inline-alert danger-alert" role="alert">{error}</div>}
  {message&&<div className="inline-alert" role="status"><CheckCircle2 size={16}/>{message}</div>}
  {registrationOnly&&<p className="gu-shifts-notice">Bạn đang ở chế độ chỉ đăng ký ca. Không thể vào đơn thuê, kho hoặc dữ liệu khách hàng cho đến khi ca làm bắt đầu.</p>}
 </section>;
}
