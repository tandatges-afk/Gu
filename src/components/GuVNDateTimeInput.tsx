'use client';
import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type TouchEvent,type WheelEvent} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,X} from 'lucide-react';
import {isValidHHMM} from '@/lib/vn-datetime';
import {vnWheelBounds,vnWheelDateError,vnWheelISO,vnWheelMove,vnWheelPad,vnWheelRange,type VNWheelDate,type VNWheelPart} from '@/lib/vn-wheel';

type Clock={hour:number;minute:number};
type Segment=VNWheelPart;
const vnToday=()=>{
 const pieces=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'})
  .formatToParts(new Date());
 const read=(key:string)=>Number(pieces.find(p=>p.type===key)?.value||0);
 return {day:read('day'),month:read('month'),year:read('year')};
};
function fromISO(iso:string):VNWheelDate{
 if(/^\d{4}-\d{2}-\d{2}$/.test(iso))return {day:Number(iso.slice(8)),month:Number(iso.slice(5,7)),year:Number(iso.slice(0,4))};
 return vnToday();
}
function fromTime(input:string):Clock{
 if(isValidHHMM(input))return {hour:Number(input.slice(0,2)),minute:Number(input.slice(3,5))};
 return {hour:9,minute:0};
}
const wheelTitles:Record<Segment,string>={day:'Chọn ngày',month:'Chọn tháng',year:'Chọn hai số cuối của năm',hour:'Chọn giờ (24h)',minute:'Chọn phút'};
function wheelText(part:Segment,n:number){return vnWheelPad(part==='year'?n%100:n);}

type WheelPickerProps={
 part:Segment;selected:number;year:number;onSelect:(n:number)=>void;onClose:()=>void;anchor:DOMRect;
};
/**
 * Only display 4 numbers above/below the selected number. At calendar boundaries
 * the visible wheel contracts (30/31: 26..31, 23h: 19..23), with no fake days.
 * The touch gesture is handled directly so it works inside nested iOS modals.
 */
function WheelPicker({part,selected,year,onSelect,onClose,anchor}:WheelPickerProps){
 const touchStart=useRef<{y:number;value:number}|null>(null);
 const suppressClick=useRef(false);
 const wheelDelta=useRef(0);
 const bounds=vnWheelBounds(part,year);
 const options=vnWheelRange(selected,bounds.min,bounds.max);
 const isMobile=typeof window!=='undefined'&&window.innerWidth<=600;
 const width=188;
 const left=Math.max(8,Math.min(anchor.left,typeof window!=='undefined'?window.innerWidth-width-8:anchor.left));
 const top=typeof window!=='undefined'&&anchor.bottom+420>window.innerHeight
  ?Math.max(8,anchor.top-420):anchor.bottom+6;
 const paneStyle:CSSProperties=isMobile?{}:{left,top,width};
 const move=(steps:number)=>{if(steps)onSelect(vnWheelMove(selected,steps,bounds));};
 const onTouchStart=(event:TouchEvent<HTMLDivElement>)=>{
  touchStart.current={y:event.touches[0].clientY,value:selected};suppressClick.current=false;
 };
 const onTouchMove=(event:TouchEvent<HTMLDivElement>)=>{
  if(!touchStart.current)return;
  const delta=touchStart.current.y-event.touches[0].clientY;
  if(Math.abs(delta)<7)return;
  suppressClick.current=true;
  const steps=Math.round(delta/29);
  onSelect(vnWheelMove(touchStart.current.value,steps,bounds));
 };
 const onTouchEnd=(event:TouchEvent<HTMLDivElement>)=>{
  if(suppressClick.current)event.preventDefault();
  touchStart.current=null;
 };
 const onWheel=(event:WheelEvent<HTMLDivElement>)=>{
  // Accumulate high precision trackpad deltas without triggering page scrolling.
  event.stopPropagation();
  wheelDelta.current+=event.deltaY;
  const steps=Math.trunc(wheelDelta.current/28);
  if(steps){wheelDelta.current-=steps*28;move(steps);}
 };
 const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key==='Escape'){event.preventDefault();onClose();}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();move(event.key==='ArrowDown'?1:-1);
  }
  else if(event.key==='Home'){event.preventDefault();onSelect(bounds.min);}
  else if(event.key==='End'){event.preventDefault();onSelect(bounds.max);}
 };
 return createPortal(<>
  <div className="gu-vn-wheel-backdrop" onClick={onClose} aria-hidden="true"/>
  <div className="gu-vn-wheel-panel" style={paneStyle} role="dialog" aria-modal="true" aria-label={wheelTitles[part]} onKeyDown={onKeyDown}>
   <div className="gu-vn-wheel-heading"><strong>{wheelTitles[part]}</strong><button type="button" onClick={onClose} aria-label="Đóng chọn số"><X size={17}/></button></div>
   <div className="gu-vn-wheel-items" role="listbox" aria-label={wheelTitles[part]}
     onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
     onWheel={onWheel}>
    {options.map(n=><button key={n} type="button" role="option" aria-selected={n===selected}
     className={'gu-vn-wheel-option'+(n===selected?' is-current':'')}
     onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}onSelect(n);}}>
     {wheelText(part,n)}
    </button>)}
   </div>
   <div className="gu-vn-wheel-hint">Vuốt hoặc cuộn để đổi số · Nhấn số để chọn</div>
   <button className="gu-vn-wheel-done" type="button" onClick={onClose}>Xong</button>
  </div>
 </>,document.body);
}

/** Date segments use buttons (not a phone keyboard), with fixed '/' separators. */
function VNDateFields({value,onChange,ariaLabel,readOnly=false}:{value:string;onChange:(isoDay:string)=>void;ariaLabel:string;readOnly?:boolean}){
 const [draft,setDraft]=useState<VNWheelDate>(()=>fromISO(value));
 const [active,setActive]=useState<{part:Segment;anchor:DOMRect}|null>(null);
 useEffect(()=>{setDraft(fromISO(value));},[value]);
 const iso=vnWheelISO(draft);
 const error=vnWheelDateError(draft);
 const update=(part:Segment,n:number)=>{
  const next={...draft,[part]:n};setDraft(next);
  const valid=vnWheelISO(next);
  if(valid&&valid!==value)onChange(valid);
 };
 const open=(part:Segment,element:HTMLButtonElement)=>{
  if(!readOnly)setActive({part,anchor:element.getBoundingClientRect()});
 };
 return <div className="gu-vn-date-field-wrap">
  <div className={'gu-vn-date-parts'+(error?' is-invalid':'')+(readOnly?' is-readonly':'')}
   role="group" aria-label={ariaLabel} data-vn-iso={iso||''} data-vn-valid={String(Boolean(iso))}>
   <button type="button" disabled={readOnly} aria-label={`${ariaLabel}: ngày ${draft.day}`} aria-haspopup="dialog"
    aria-expanded={active?.part==='day'} onClick={e=>open('day',e.currentTarget)}>{vnWheelPad(draft.day)}</button>
   <span aria-hidden="true">/</span>
   <button type="button" disabled={readOnly} aria-label={`${ariaLabel}: tháng ${draft.month}`} aria-haspopup="dialog"
    aria-expanded={active?.part==='month'} onClick={e=>open('month',e.currentTarget)}>{vnWheelPad(draft.month)}</button>
   <span aria-hidden="true">/</span>
   <button type="button" className="gu-vn-year-button" disabled={readOnly} aria-label={`${ariaLabel}: năm ${draft.year}, chỉnh hai số cuối`} aria-haspopup="dialog"
    aria-expanded={active?.part==='year'} onClick={e=>open('year',e.currentTarget)}>{draft.year}</button>
  </div>
  {error&&<p className="gu-vn-date-error" role="alert">{error}</p>}
  {active&&<WheelPicker part={active.part} selected={draft[active.part as keyof VNWheelDate]}
   year={draft.year} anchor={active.anchor} onSelect={n=>update(active.part,n)} onClose={()=>setActive(null)}/>}
 </div>;
}
function VNTimeFields({value,onChange,ariaLabel,readOnly=false}:{value:string;onChange:(clock:string)=>void;ariaLabel:string;readOnly?:boolean}){
 const [active,setActive]=useState<{part:'hour'|'minute';anchor:DOMRect}|null>(null);
 const clock=fromTime(value);
 const change=(part:'hour'|'minute',n:number)=>{
  const next={...clock,[part]:n};onChange(`${vnWheelPad(next.hour)}:${vnWheelPad(next.minute)}`);
 };
 return <div className={'gu-vn-clock'+(readOnly?' is-readonly':'')} role="group" aria-label={ariaLabel}
  data-vn-time={value} data-vn-valid={String(isValidHHMM(value))}>
  <button type="button" disabled={readOnly} aria-label={`${ariaLabel}: giờ ${clock.hour}`} aria-haspopup="dialog"
   aria-expanded={active?.part==='hour'} onClick={e=>setActive({part:'hour',anchor:e.currentTarget.getBoundingClientRect()})}>{vnWheelPad(clock.hour)}</button>
  <span aria-hidden="true">:</span>
  <button type="button" disabled={readOnly} aria-label={`${ariaLabel}: phút ${clock.minute}`} aria-haspopup="dialog"
   aria-expanded={active?.part==='minute'} onClick={e=>setActive({part:'minute',anchor:e.currentTarget.getBoundingClientRect()})}>{vnWheelPad(clock.minute)}</button>
  {active&&<WheelPicker part={active.part} selected={clock[active.part]} year={2026}
   anchor={active.anchor} onSelect={n=>change(active.part,n)} onClose={()=>setActive(null)}/>}
 </div>;
}
/** Native Safari date control retained as an optional alternative to the five number wheels. */
function NativeDatePicker({value,onChange,ariaLabel,readOnly=false}:{value:string;onChange:(isoDay:string)=>void;ariaLabel:string;readOnly?:boolean}){
 if(readOnly)return null;
 return <label className="gu-vn-picker" title="Chọn ngày bằng lịch">
  <CalendarDays size={17} aria-hidden="true"/>
  <input type="date" className="gu-vn-native-date" tabIndex={0} aria-label={ariaLabel}
   value={value} onChange={e=>{if(e.target.value)onChange(e.target.value);}}/>
 </label>;
}
/** ISO local HH:MM DD/MM/YYYY segments; all selections go through the same validation. */
export function GuVNDateTimeInput({value,onChange,required=false,className='input',ariaLabel,readOnly=false}:{value:string;onChange:(v:string)=>void;required?:boolean;className?:string;ariaLabel?:string;readOnly?:boolean}){
 void required;void className;
 const date=value.slice(0,10),time=value.slice(11,16)||'09:00';
 const updateDate=(day:string)=>{if(isValidHHMM(time))onChange(`${day}T${time}`);};
 const updateTime=(clock:string)=>{if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&vnWheelISO(fromISO(date))===date)onChange(`${date}T${clock}`);};
 return <div className={'gu-vn-datetime'+(readOnly?' is-readonly':'')} aria-label={ariaLabel}>
  <VNDateFields value={date} onChange={updateDate} ariaLabel={(ariaLabel||'Thời gian')+' ngày DD/MM/YYYY'} readOnly={readOnly}/>
  <VNTimeFields value={time} onChange={updateTime} ariaLabel={(ariaLabel||'Thời gian')+' giờ (24h)'} readOnly={readOnly}/>
  <NativeDatePicker value={date} onChange={updateDate} ariaLabel={(ariaLabel||'Thời gian')+' chọn ngày bằng lịch'} readOnly={readOnly}/>
 </div>;
}
export function GuVNDateInput({value,onChange,className='input',ariaLabel}:{value:string;onChange:(v:string)=>void;className?:string;ariaLabel?:string}){
 void className;
 return <div className="gu-vn-date-only">
  <VNDateFields value={value} onChange={onChange} ariaLabel={ariaLabel||'Ngày DD/MM/YYYY'}/>
  <NativeDatePicker value={value} onChange={onChange} ariaLabel={(ariaLabel||'Ngày')+' chọn ngày bằng lịch'}/>
 </div>;
}
