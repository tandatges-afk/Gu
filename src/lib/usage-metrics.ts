/** Dashboard quota helpers. Never represent missing provider data as zero. */
export const FIRESTORE_FREE={reads:50000,writes:20000,deletes:20000,storageBytes:1024**3} as const;
export const CLOUDINARY_FREE_CREDITS=25;
export type UsageValue={used:number|null;limit:number|null;updatedAt?:string|null;error?:string};
export function usageStatus(used:number|null,limit:number|null):'unknown'|'ok'|'warning'|'critical'{
  if(used===null||limit===null||limit<=0)return 'unknown';
  return used/limit>=.9?'critical':used/limit>=.75?'warning':'ok';
}
export function pacificDayWindow(now:Date):{start:string;end:string;resetsAt:string;pacificDate:string}{
  // Cloud Firestore resets around midnight America/Los_Angeles, including DST.
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(fmt.formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const y=Number(parts.year),m=Number(parts.month),d=Number(parts.day);
  const midnight=(dayOffset:number)=>{
    const guess=new Date(Date.UTC(y,m-1,d+dayOffset,8));
    const localOffset=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'shortOffset'}).formatToParts(guess).find(p=>p.type==='timeZoneName')?.value||'GMT-8';
    const match=localOffset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const offset=match?(match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]||0)):0;
    return new Date(Date.UTC(y,m-1,d+dayOffset)-offset*60000).toISOString();
  };
  return {start:midnight(0),end:now.toISOString(),resetsAt:midnight(1),pacificDate:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`};
}
export function sumMonitoringSeries(raw:unknown):number|null{
  const obj=raw as {timeSeries?:Array<{points?:Array<{value?:{int64Value?:string;doubleValue?:number}}>}>}|null;
  if(!obj||!Array.isArray(obj.timeSeries)||!obj.timeSeries.some(series=>Array.isArray(series.points)&&series.points.length>0))return null;
  let total=0;
  for(const series of obj.timeSeries)for(const p of series.points||[]){
    const val=Number(p.value?.int64Value??p.value?.doubleValue);
    if(Number.isFinite(val))total+=val;
  }
  return total;
}
export function latestMonitoringValue(raw:unknown):number|null{
  const obj=raw as {timeSeries?:Array<{points?:Array<{interval?:{endTime?:string};value?:{int64Value?:string;doubleValue?:number}}>}>}|null;
  if(!obj||!Array.isArray(obj.timeSeries))return null;
  const samples=(obj.timeSeries||[]).flatMap(s=>s.points||[]);
  samples.sort((a,b)=>String(b.interval?.endTime||'').localeCompare(String(a.interval?.endTime||'')));
  const first=samples[0];if(!first)return null;
  const n=Number(first.value?.int64Value??first.value?.doubleValue);
  return Number.isFinite(n)?n:null;
}
export function metricUsage(value:unknown,limit:number|null=null):UsageValue{
 const n=Number(value);return{used:value===null||value===undefined||!Number.isFinite(n)?null:Math.max(0,n),limit};
}
