import {addDays} from './rental.ts';

export type CalendarDayTone='toneToday'|'toneTomorrow'|'toneAfterTomorrow'|null;
/** Compare absolute ISO day keys, not the displayed column index. */
export function calendarDayTone(day:string,today:string):CalendarDayTone{
 if(day===today)return 'toneToday';
 if(day===addDays(today,1))return 'toneTomorrow';
 if(day===addDays(today,2))return 'toneAfterTomorrow';
 return null;
}

export type CalendarVisualClass='stateWarning'|'stateOverdue'|'statePicked'|'stateReserved'|'stateBlocked'|'statePast'|'stateFree';
export function calendarVisualState(input:{late:boolean;warning:boolean;orderStatus?:string;blocked:boolean;isPast:boolean;blockedLabel?:string}):{className:CalendarVisualClass;label:string}{
 if(input.late)return {className:'stateOverdue',label:'Trả trễ'};
 if(input.warning)return {className:'stateWarning',label:'Cảnh báo'};
 if(input.orderStatus==='PICKED_UP')return {className:'statePicked',label:'Đã lấy'};
 if(input.orderStatus==='RESERVED')return {className:'stateReserved',label:'Đã giữ'};
 if(input.blocked)return {className:'stateBlocked',label:input.blockedLabel||'Không sẵn sàng'};
 if(input.isPast)return {className:'statePast',label:'Đã qua'};
 return {className:'stateFree',label:'Còn trống'};
}
