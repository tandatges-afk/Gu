/** Pure wheel/date helpers shared by booking and calendar. No browser timezone dependency. */
export type VNWheelPart='day'|'month'|'year'|'hour'|'minute';
export type VNWheelDate={day:number;month:number;year:number};

export function vnWheelRange(current:number,min:number,max:number,radius=4):number[]{
 if(!Number.isInteger(current)||!Number.isInteger(min)||!Number.isInteger(max)||min>max)return [];
 const selected=Math.max(min,Math.min(max,current));
 return Array.from({length:Math.min(max,selected+radius)-Math.max(min,selected-radius)+1},
  (_,i)=>Math.max(min,selected-radius)+i);
}
export function vnWheelBounds(part:VNWheelPart,year=2026):{min:number;max:number}{
 if(part==='day')return {min:1,max:31};
 if(part==='month')return {min:1,max:12};
 if(part==='hour')return {min:0,max:23};
 if(part==='minute')return {min:0,max:59};
 const century=Math.floor(year/100)*100;
 return {min:century,max:century+99};
}
export function vnWheelMove(current:number,step:number,bounds:{min:number;max:number}):number{
 return Math.min(bounds.max,Math.max(bounds.min,current+step));
}
export const vnWheelPad=(value:number)=>String(value).padStart(2,'0');
export function vnWheelDateError({day,month,year}:VNWheelDate):string|null{
 if(!Number.isInteger(year)||year<1000||year>9999)return 'Năm không hợp lệ.';
 if(!Number.isInteger(month)||month<1||month>12)return 'Tháng phải nằm trong khoảng 1–12.';
 if(!Number.isInteger(day)||day<1||day>31)return 'Ngày phải nằm trong khoảng 1–31.';
 // Date.UTC handles full 4-digit years and February leap day without local TZ.
 const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
 if(day<=lastDay)return null;
 if(month===2){
  const leap=year%4===0&&(year%100!==0||year%400===0);
  return leap?`Tháng 2/${year} chỉ có 29 ngày.`:`Tháng 2/${year} không phải năm nhuận, chỉ có 28 ngày.`;
 }
 return `Tháng ${month} không có ngày ${day} (chỉ có ${lastDay} ngày).`;
}
export function vnWheelISO({day,month,year}:VNWheelDate):string|null{
 if(vnWheelDateError({day,month,year}))return null;
 return `${year}-${vnWheelPad(month)}-${vnWheelPad(day)}`;
}
