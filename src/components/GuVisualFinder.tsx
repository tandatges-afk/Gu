'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCcw} from 'lucide-react';
import {thumbCloudinaryUrl} from '@/lib/cloudinary-images';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
import {visibleStockLabel,type VisualAvailabilityState} from '@/lib/visual-availability';
/** Low-cost image candidate ranking: browser color-and-outline fingerprint, NOT AI or identity proof. */
function fingerprint(canvas:HTMLCanvasElement):number[]{const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Thiết bị không hỗ trợ so sánh ảnh.');
 const {data}=ctx.getImageData(0,0,32,32);const out=Array(24).fill(0) as number[];
 for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];out[Math.min(3,Math.floor(r/64))]++;out[4+Math.min(3,Math.floor(g/64))]++;out[8+Math.min(3,Math.floor(b/64))]++;const avg=(r+g+b)/3;out[12+Math.min(3,Math.floor(avg/64))]++;}
 // 8 additional entries capture left/right and top/bottom brightness.
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const p=(y*32+x)*4,lum=(data[p]+data[p+1]+data[p+2])/3;const sector=(y>=16?2:0)+(x>=16?1:0);out[16+sector]+=lum/255;out[20+sector]+=lum<128?1:0;}
 return out.map(v=>v/1024);
}
async function photoVector(source:File|string){return new Promise<number[]>((resolve,reject)=>{
 const url=typeof source==='string'?source:URL.createObjectURL(source);const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{try{const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d');if(!ctx)throw Error();ctx.drawImage(img,0,0,32,32);resolve(fingerprint(c));}catch{reject(Error('Không thể đọc ảnh.'));}finally{if(typeof source!=='string')URL.revokeObjectURL(url);}};
 img.onerror=()=>{if(typeof source!=='string')URL.revokeObjectURL(url);reject(Error('Ảnh không tải được.'));};img.src=url;
 });}
function distance(a:number[],b:number[]){return a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0);}
const describeTime=(time:string|null,date:string)=>time?new Date(time).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Ho_Chi_Minh'}):date.split('-').reverse().join('/');
function StatusInfo({info,pending}:{info:VisualAvailabilityState|undefined;pending:boolean}){
 const status=info?.status||'UNKNOWN';
 const label=pending?'Đang kiểm tra…':info?visibleStockLabel(status):'Chưa xác minh';
 const tone=pending||!info?'unknown':status==='AVAILABLE'?'available':status==='RENTED'?'rented':'blocked';
 return <div className="gu-visual-availability">
   <span className={'gu-visual-status gu-visual-status-'+tone}><i aria-hidden="true"/>{label}</span>
   {!pending&&info&&<div className="gu-visual-next-bookings"><strong>{info.upcoming.length?'Lịch đặt trong 7 ngày tới':'Chưa có lịch đặt trong 7 ngày tới'}</strong>
    {info.upcoming.map(booking=><div key={booking.orderId} className="gu-visual-booking"><span>Nhận: {describeTime(booking.pickupAt,booking.pickupDate)}</span><span>Trả: {describeTime(booking.returnAt,booking.returnDate)}</span></div>)}
   </div>}
 </div>;
}
export function GuVisualFinder({api,onChoose}:{api:ApiCall;onChoose?:(item:InventoryItem)=>void}){
 const [file,setFile]=useState<File|null>(null);
 const [chosen,setChosen]=useState<InventoryItem|null>(null);
 const [copyNote,setCopyNote]=useState('');
 const [results,setResults]=useState<Array<{item:InventoryItem;score:number}>>([]);
 const [loading,setLoading]=useState(false);
 const [availabilityLoading,setAvailabilityLoading]=useState(false);
 const [availability,setAvailability]=useState<Record<string,VisualAvailabilityState>>({});
 const [availabilityError,setAvailabilityError]=useState('');
 const [note,setNote]=useState('');
 const scanToken=useRef(0);
 const pasteFile=async()=>{try{if(!navigator.clipboard?.read)throw Error('Trình duyệt không hỗ trợ đọc ảnh clipboard.');const clips=await navigator.clipboard.read();for(const clip of clips){const mime=clip.types.find(x=>x.startsWith('image/'));if(mime){const blob=await clip.getType(mime);setFile(new File([blob],'anh-dan.'+(mime.split('/')[1]||'png'),{type:mime}));setNote('Đã nhận ảnh từ clipboard.');return;}}throw Error('Clipboard chưa có ảnh.');}catch(e){setNote(e instanceof Error?e.message:'Không thể dán ảnh.');}};
 useEffect(()=>{const onPaste=(e:ClipboardEvent)=>{const file=Array.from(e.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));if(file){setFile(file);setNote('Đã dán ảnh bằng Ctrl+V.');}};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);},[]);
 const loadAvailability=async(items:InventoryItem[],seq:number)=>{
  if(!items.length)return;
  setAvailabilityLoading(true);setAvailabilityError('');
  try{
   const response=await api<{states:Record<string,VisualAvailabilityState>}>('v5/visual-availability',{method:'POST',body:JSON.stringify({itemIds:items.map(i=>i.id)})});
   if(seq===scanToken.current)setAvailability(response.states||{});
  }catch(e){if(seq===scanToken.current)setAvailabilityError(e instanceof Error?e.message:'Không kiểm tra được trạng thái kho và lịch đặt.');}
  finally{if(seq===scanToken.current)setAvailabilityLoading(false);}
 };
 const scan=async()=>{
  if(!file)return;
  const seq=++scanToken.current;
  setLoading(true);setAvailabilityLoading(false);setAvailability({});setAvailabilityError('');setNote('');setResults([]);setChosen(null);
  try{
   const ref=await photoVector(file);let cursor:string|null=null;const catalog:InventoryItem[]=[];
   for(let page=0;page<200;page++){const q='v5/visual-catalog?size=50'+(cursor?'&cursor='+encodeURIComponent(cursor):'');const r:{results:InventoryItem[];cursor:string|null}=await api(q);catalog.push(...r.results);cursor=r.cursor;if(!cursor)break;}
   if(cursor)throw Error('Kho quá lớn để so sánh toàn bộ trong trình duyệt. Hãy lọc kho trước hoặc sử dụng mã sản phẩm.');
   const candidates=catalog.filter(i=>!i.archivedAt&&i.imagePaths?.[0]);const scored:Array<{item:InventoryItem;score:number}>=[];
   let index=0;await Promise.all(Array.from({length:6},async()=>{while(index<candidates.length){const item=candidates[index++];try{const fp=await photoVector(thumbCloudinaryUrl(item.imagePaths![0],120));scored.push({item,score:distance(ref,fp)});}catch{/* image unavailable */}}}));
   scored.sort((a,b)=>a.score-b.score);
   const matches=scored.slice(0,12);
   if(seq!==scanToken.current)return;
   setResults(matches);
   if(!matches.length){setNote('Không tìm thấy sản phẩm có ảnh đối chiếu.');return;}
   await loadAvailability(matches.map(r=>r.item),seq);
  }catch(e){if(seq===scanToken.current)setNote(e instanceof Error?e.message:'Không tìm được ảnh.');}
  finally{if(seq===scanToken.current)setLoading(false);}
 };
 return <section className="gu-v5-finder"><h3>Tìm sản phẩm bằng hình ảnh</h3><p>Đối chiếu ảnh trong kho, xem trạng thái hiện tại và lịch đặt trong 7 ngày tới.</p>
  <div className="gu-v5-photo-actions"><label className="btn btn-white">Chọn ảnh <input hidden type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label className="btn btn-white">Chụp ảnh <input hidden type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button type="button" className="btn btn-white" onClick={()=>void pasteFile()}>Dán ảnh</button><button type="button" className="btn btn-dark" disabled={!file||loading} onClick={()=>void scan()}>{loading?'Đang tìm…':'Tìm sản phẩm'}</button></div>
  {file&&<small>Ảnh: {file.name}</small>}{note&&<p className="gu-v5-search-note" role="status">{note}</p>}
  {availabilityError&&<div className="inline-alert danger-alert" role="alert">{availabilityError} Không đánh dấu xanh/đỏ khi chưa có trạng thái đã xác minh. <button type="button" className="btn btn-white" onClick={()=>{const seq=scanToken.current;void loadAvailability(results.map(r=>r.item),seq);}}>Thử lại</button></div>}
  {results.length>0&&<div className="gu-visual-result-toolbar"><strong>{results.length} sản phẩm tương đồng</strong><button type="button" className="btn btn-white" disabled={availabilityLoading} onClick={()=>void loadAvailability(results.map(r=>r.item),scanToken.current)}><RefreshCcw size={15}/> Cập nhật tình trạng và lịch</button></div>}
  <div className="gu-visual-results" aria-live="polite">{results.map(({item},index)=><button key={item.id} type="button" className="gu-visual-result-card" onClick={()=>{setChosen(item);onChoose?.(item);}}><ProductImage paths={item.imagePaths}/><div className="gu-visual-result-copy"><div className="gu-visual-result-head"><strong>{item.name}</strong><small>#{index+1}</small></div><span className="gu-visual-product-code">{item.hangerCode||item.sku} · {item.category}</span><StatusInfo info={availability[item.id]} pending={availabilityLoading}/></div></button>)}</div>
  {chosen&&<div className="panel gu-v5-found-detail"><h4>Đã chọn để đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><strong>Mã sản phẩm: {chosen.hangerCode||chosen.sku}</strong> · {chosen.category}</p>{chosen.cameraSerial&&<p>Serial thân máy: {chosen.cameraSerial}</p>}
    <StatusInfo info={availability[chosen.id]} pending={availabilityLoading}/>
    <button type="button" className="btn btn-white" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã sản phẩm.')).catch(()=>setCopyNote('Thiết bị không cho phép sao chép.'))}>Sao chép mã sản phẩm</button>{copyNote&&<small>{copyNote}</small>}
   </div>}
 </section>;
}
