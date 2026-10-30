'use client';
import {useEffect,useRef,useState,type ChangeEvent,type ClipboardEvent,type KeyboardEvent} from 'react';
import {formatVNDateKey,isoDayFromVN,isValidHHMM} from '@/lib/vn-datetime';
import {CalendarDays} from 'lucide-react';

type DatePart = 'day'|'month'|'year';
type DateParts = {day:string;month:string;year:string};
const fromISO=(iso:string):DateParts=>/^\d{4}-\d{2}-\d{2}$/.test(iso)
 ?{day:iso.slice(8,10),month:iso.slice(5,7),year:iso.slice(0,4)}
 :{day:'',month:'',year:''};
const isoFromParts=(p:DateParts)=>isoDayFromVN(`${p.day}/${p.month}/${p.year}`);

/**
 * Three numeric fields make the separators truly non-editable on iOS and Android.
 * One-digit day/month are zero-padded on blur. Paste also accepts d/m/yyyy.
 * The parent only receives a fully valid date; partially edited dates never leak
 * into reservation pricing or calendar requests.
 */
function VNDateFields({value,onChange,ariaLabel}:{value:string;onChange:(isoDay:string)=>void;ariaLabel:string}){
 const [parts,setParts]=useState<DateParts>(()=>fromISO(value));
 const dayRef=useRef<HTMLInputElement>(null);
 const monthRef=useRef<HTMLInputElement>(null);
 const yearRef=useRef<HTMLInputElement>(null);
 useEffect(()=>setParts(fromISO(value)),[value]);
 const commit=(next:DateParts)=>{const iso=isoFromParts(next);if(iso&&iso!==value)onChange(iso);};
 const applyFullDate=(raw:string):boolean=>{
  const iso=isoDayFromVN(raw.trim());
  if(!iso)return false;
  setParts(fromISO(iso));if(iso!==value)onChange(iso);
  return true;
 };
 const onPartChange=(part:DatePart)=>(event:ChangeEvent<HTMLInputElement>)=>{
  const raw=event.target.value;
  if(raw.includes('/')||raw.includes('-')){
   if(applyFullDate(raw))return;
  }
  const limit=part==='year'?4:2;
  const digits=raw.replace(/\D/g,'').slice(0,limit);
  const next={...parts,[part]:digits};
  setParts(next);
  if(digits.length===limit){
   commit(next);
   if(part==='day')monthRef.current?.focus();
   if(part==='month')yearRef.current?.focus();
  }
 };
 const onPartBlur=(part:DatePart)=>()=>{
  if(part==='year')return;
  const raw=parts[part];
  if(raw.length!==1)return;
  const next={...parts,[part]:raw.padStart(2,'0')};
  setParts(next);commit(next);
 };
 const onPartKeyDown=(part:DatePart)=>(event:KeyboardEvent<HTMLInputElement>)=>{
  if(event.key==='/'||event.key==='ArrowRight'){
   event.preventDefault();
   if(part==='day')monthRef.current?.focus();
   else if(part==='month')yearRef.current?.focus();
  }
  if(event.key==='Backspace'&&!parts[part]){
   if(part==='year')monthRef.current?.focus();
   else if(part==='month')dayRef.current?.focus();
  }
 };
 const onPartPaste=(event:ClipboardEvent<HTMLInputElement>)=>{
  const text=event.clipboardData.getData('text').trim();
  if(applyFullDate(text)){event.preventDefault();return;}
  // Let the browser handle ordinary numeric pastes, which onChange constrains.
 };
 return <div className="gu-vn-date-parts" role="group" aria-label={ariaLabel}>
  <input ref={dayRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={`${ariaLabel}: ngày`} placeholder="DD" maxLength={2} value={parts.day} onChange={onPartChange('day')} onBlur={onPartBlur('day')} onKeyDown={onPartKeyDown('day')} onPaste={onPartPaste}/>
  <span aria-hidden="true">/</span>
  <input ref={monthRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={`${ariaLabel}: tháng`} placeholder="MM" maxLength={2} value={parts.month} onChange={onPartChange('month')} onBlur={onPartBlur('month')} onKeyDown={onPartKeyDown('month')} onPaste={onPartPaste}/>
  <span aria-hidden="true">/</span>
  <input ref={yearRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={`${ariaLabel}: năm`} placeholder="YYYY" maxLength={4} value={parts.year} onChange={onPartChange('year')} onKeyDown={onPartKeyDown('year')} onPaste={onPartPaste}/>
 </div>;
}

/** A real transparent date input overlays the visible icon. Touching it directly
 * invokes iOS Safari's native picker without programmatic opening. */
function NativeDatePicker({value,onChange,ariaLabel}:{value:string;onChange:(isoDay:string)=>void;ariaLabel:string}){
 return <label className="gu-vn-picker" title="Chọn ngày bằng lịch">
  <CalendarDays size={17} aria-hidden="true"/>
  <input type="date" className="gu-vn-native-date" tabIndex={0} aria-label={ariaLabel} value={value} onChange={e=>{if(e.target.value)onChange(e.target.value);}}/>
 </label>;
}

/** Controlled ISO local datetime. Visible date is always DD/MM/YYYY, clock is HH:MM. */
export function GuVNDateTimeInput({value,onChange,required=false,className='input',ariaLabel}:{value:string;onChange:(v:string)=>void;required?:boolean;className?:string;ariaLabel?:string}){
 const date=value.slice(0,10);
 const [time,setTime]=useState(value.slice(11,16)||'09:00');
 useEffect(()=>setTime(value.slice(11,16)||'09:00'),[value]);
 const updateDate=(day:string)=>{if(isValidHHMM(time))onChange(`${day}T${time}`);};
 return <div className="gu-vn-datetime" aria-label={ariaLabel}>
  <VNDateFields value={date} onChange={updateDate} ariaLabel={(ariaLabel||'Thời gian')+' ngày DD/MM/YYYY'}/>
  <input className={className} inputMode="numeric" type="text" placeholder="HH:MM" aria-label={(ariaLabel||'Thời gian')+' giờ (24h)'} value={time} required={required} onChange={e=>{const t=e.target.value;setTime(t);if(isoDayFromVN(formatVNDateKey(date))&&isValidHHMM(t))onChange(`${date}T${t}`);}}/>
  <NativeDatePicker value={date} onChange={updateDate} ariaLabel={(ariaLabel||'Thời gian')+' chọn ngày bằng lịch'}/>
 </div>;
}
export function GuVNDateInput({value,onChange,className='input',ariaLabel}:{value:string;onChange:(v:string)=>void;className?:string;ariaLabel?:string}){
 void className;
 return <div className="gu-vn-date-only">
  <VNDateFields value={value} onChange={onChange} ariaLabel={ariaLabel||'Ngày DD/MM/YYYY'}/>
  <NativeDatePicker value={value} onChange={onChange} ariaLabel={(ariaLabel||'Ngày')+' chọn ngày bằng lịch'}/>
 </div>;
}
