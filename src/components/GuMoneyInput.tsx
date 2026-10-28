'use client';

import {useLayoutEffect,useRef,type InputHTMLAttributes} from 'react';
import {formatVndInput,vndCaretPosition,vndDigits} from '@/lib/vnd-input';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'|'inputMode'> & {
  value:number|string;
  onValueChange:(rawDigits:string)=>void;
};
/** One reusable money field: 1000 -> 1.000, but callbacks receive "1000". */
export function GuMoneyInput({value,onValueChange,className='input',...props}:Props){
  const el=useRef<HTMLInputElement>(null);
  const wantedCaret=useRef<number|null>(null);
  const formatted=formatVndInput(value);
  useLayoutEffect(()=>{
    if(wantedCaret.current===null||!el.current)return;
    const position=vndCaretPosition(formatted,wantedCaret.current);
    el.current.setSelectionRange(position,position);
    wantedCaret.current=null;
  },[formatted]);
  return <input {...props} ref={el} className={className} type="text" inputMode="numeric"
    autoComplete="off" value={formatted} onChange={e=>{
      const current=e.currentTarget;
      const raw=vndDigits(current.value);
      const digitsAhead=current.value.slice(0,current.selectionStart??current.value.length).replace(/\D/g,'').length;
      wantedCaret.current=Math.min(digitsAhead,raw.length);
      onValueChange(raw);
    }}/>
}
