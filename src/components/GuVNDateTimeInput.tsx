'use client';
import {useEffect,useRef,useState} from 'react';
import {formatVNDateKey,isoDayFromVN,isValidHHMM} from '@/lib/vn-datetime';
import {CalendarDays} from 'lucide-react';
/** Controlled ISO local datetime, rendered using explicit VN date and 24-hour text clock.
 * Date picker is an optional native helper; its locale does not affect visible fields.
 */
export function GuVNDateTimeInput({value,onChange,required=false,className='input',ariaLabel}:{value:string;onChange:(v:string)=>void;required?:boolean;className?:string;ariaLabel?:string}){
 const dateRef=useRef<HTMLInputElement>(null);
 const [date,setDate]=useState(value?formatVNDateKey(value.slice(0,10)):'');
 const [time,setTime]=useState(value.slice(11,16)||'09:00');
 useEffect(()=>{setDate(value?formatVNDateKey(value.slice(0,10)):'');setTime(value.slice(11,16)||'09:00');},[value]);
 const update=(d:string,t:string)=>{const day=isoDayFromVN(d);if(day&&isValidHHMM(t))onChange(`${day}T${t}`);};
 return <div className="gu-vn-datetime" aria-label={ariaLabel}>
  <input className={className} inputMode="numeric" type="text" placeholder="DD/MM/YYYY" aria-label={(ariaLabel||'Thời gian')+' ngày (DD/MM/YYYY)'} value={date} required={required} onChange={e=>{setDate(e.target.value);update(e.target.value,time);}}/>
  <input className={className} inputMode="numeric" type="text" placeholder="HH:MM" aria-label={(ariaLabel||'Thời gian')+' giờ (24h)'} value={time} required={required} onChange={e=>{setTime(e.target.value);update(date,e.target.value);}}/>
  <button type="button" className="gu-vn-date-open" aria-label="Chọn ngày bằng lịch" onClick={()=>{try{dateRef.current?.showPicker();}catch{dateRef.current?.focus();}}}><CalendarDays size={17} aria-hidden="true"/></button>
  <input ref={dateRef} aria-label="Chọn ngày" className="gu-vn-native-date" type="date" tabIndex={-1} value={isoDayFromVN(date)||value.slice(0,10)} onChange={e=>{const d=formatVNDateKey(e.target.value);setDate(d);update(d,time);}}/>
 </div>;
}
export function GuVNDateInput({value,onChange,className='input',ariaLabel}:{value:string;onChange:(v:string)=>void;className?:string;ariaLabel?:string}){
 const [text,setText]=useState(value?formatVNDateKey(value):'');
 const dateRef=useRef<HTMLInputElement>(null);
 useEffect(()=>setText(value?formatVNDateKey(value):''),[value]);
 return <div className="gu-vn-date-only"><input type="text" inputMode="numeric" className={className} value={text} placeholder="DD/MM/YYYY" aria-label={ariaLabel||'Ngày DD/MM/YYYY'} onChange={e=>{setText(e.target.value);const v=isoDayFromVN(e.target.value);if(v)onChange(v);}}/><button type="button" aria-label="Chọn ngày bằng lịch" onClick={()=>{try{dateRef.current?.showPicker();}catch{dateRef.current?.focus();}}}><CalendarDays size={17} aria-hidden="true"/></button><input ref={dateRef} className="gu-vn-native-date" tabIndex={-1} type="date" value={value} onChange={e=>onChange(e.target.value)}/></div>;
}
