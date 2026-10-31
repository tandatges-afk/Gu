'use client';
import {useEffect,useState} from 'react';
import {formatVNDateKey,isoDayFromVN,isValidHHMM} from '@/lib/vn-datetime';
import {CalendarDays} from 'lucide-react';

// GU_FIX20_REV4_DATE_CREATOR_V3: the native input itself is the tap target.
// A hidden 1px input behind a separate button can fail to open on mobile.
const NativeDateTrigger = ({value,onChange,label}:{
  value:string;
  onChange:(value:string)=>void;
  label:string;
}) => <label className="gu-vn-native-trigger">
  <CalendarDays size={17} aria-hidden="true" />
  <input
    className="gu-vn-native-date gu-vn-native-date-overlay"
    type="date"
    aria-label={label}
    value={value}
    onClick={e=>{try{e.currentTarget.showPicker?.();}catch{/* Native click remains available. */}}}
    onChange={e=>onChange(e.currentTarget.value)}
  />
</label>;

/** Controlled local datetime displayed as DD/MM/YYYY and HH:MM (24h). */
export function GuVNDateTimeInput({value,onChange,required=false,className='input',ariaLabel}:{
  value:string;
  onChange:(v:string)=>void;
  required?:boolean;
  className?:string;
  ariaLabel?:string;
}){
  const [date,setDate]=useState(value?formatVNDateKey(value.slice(0,10)):'');
  const [time,setTime]=useState(value.slice(11,16)||'09:00');
  useEffect(()=>{
    setDate(value?formatVNDateKey(value.slice(0,10)):'');
    setTime(value.slice(11,16)||'09:00');
  },[value]);
  const update=(d:string,t:string)=>{
    const day=isoDayFromVN(d);
    if(day&&isValidHHMM(t))onChange(`${day}T${t}`);
  };
  return <div className="gu-vn-datetime" aria-label={ariaLabel}>
    <input className={className} inputMode="numeric" type="text"
      placeholder="DD/MM/YYYY" aria-label={(ariaLabel||'Thời gian')+' ngày (DD/MM/YYYY)'}
      value={date} required={required}
      onChange={e=>{setDate(e.target.value);update(e.target.value,time);}}/>
    <input className={className} inputMode="numeric" type="text"
      placeholder="HH:MM" aria-label={(ariaLabel||'Thời gian')+' giờ (24h)'}
      value={time} required={required}
      onChange={e=>{setTime(e.target.value);update(date,e.target.value);}}/>
    <NativeDateTrigger value={isoDayFromVN(date)||value.slice(0,10)}
      label="Chọn ngày bằng lịch"
      onChange={iso=>{const d=formatVNDateKey(iso);setDate(d);update(d,time);}}/>
  </div>;
}

export function GuVNDateInput({value,onChange,className='input',ariaLabel}:{
  value:string;
  onChange:(v:string)=>void;
  className?:string;
  ariaLabel?:string;
}){
  const [text,setText]=useState(value?formatVNDateKey(value):'');
  useEffect(()=>setText(value?formatVNDateKey(value):''),[value]);
  return <div className="gu-vn-date-only">
    <input type="text" inputMode="numeric" className={className}
      value={text} placeholder="DD/MM/YYYY"
      aria-label={ariaLabel||'Ngày DD/MM/YYYY'}
      onChange={e=>{setText(e.target.value);const day=isoDayFromVN(e.target.value);if(day)onChange(day);}}/>
    <NativeDateTrigger value={value} label="Chọn ngày bằng lịch"
      onChange={iso=>{setText(formatVNDateKey(iso));onChange(iso);}}/>
  </div>;
}
