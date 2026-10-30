/** Vietnam display format: HH:MM DD/MM/YYYY, 24-hour clock, Asia/Ho_Chi_Minh. */
const VN='Asia/Ho_Chi_Minh';
const dt=new Intl.DateTimeFormat('en-GB',{timeZone:VN,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function formatVNDateKey(key:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return key||'—';
 return `${key.slice(8,10)}/${key.slice(5,7)}/${key.slice(0,4)}`;
}
export function formatVNDateTime(iso:string|undefined|null):string{
 if(!iso)return '—';
 const d=new Date(iso);if(Number.isNaN(d.getTime()))return iso;
 const parts=Object.fromEntries(dt.formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}
export function isoDayFromVN(value:string):string|null{
 const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
 if(!m)return null;
 const key=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 const d=new Date(key+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===key?key:null;
}
export function isValidHHMM(value:string):boolean{return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function formatVNHour(iso?:string):string{
 const value=formatVNDateTime(iso);return value==='—'?'--:--':value.slice(0,5);
}
