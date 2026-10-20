'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCcw,ImageSearch,Database,AlertCircle} from 'lucide-react';
import {imageSignature} from '@/lib/visual-image';
import {rankVisualItems,type VisualSignature} from '@/lib/visual-index';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
import {visibleStockLabel,type VisualAvailabilityState} from '@/lib/visual-availability';
import {formatVNDateTime,formatVNDateKey} from '@/lib/vn-datetime';
import styles from './GuVisualFinder.module.css';
const describeTime=(time:string|null,date:string)=>time?formatVNDateTime(time):formatVNDateKey(date);
type IndexRow={id:string;signature?:VisualSignature;imagePath?:string};
type Hit={item:InventoryItem;score:number};
function StatusInfo({info,pending}:{info:VisualAvailabilityState|undefined;pending:boolean}){
 const status=info?.status||'UNKNOWN';const label=pending?'Đang kiểm tra…':info?visibleStockLabel(status):'Chưa xác minh';
 const tone=pending||!info?'unknown':status==='AVAILABLE'?'available':status==='RENTED'?'rented':'blocked';
 return <div className="gu-visual-availability"><span className={'gu-visual-status gu-visual-status-'+tone}><i aria-hidden="true"/>{label}</span>
  {!pending&&info&&<div className="gu-visual-next-bookings"><strong>{info.upcoming.length?'Lịch đặt trong 7 ngày tới':'Chưa có lịch đặt trong 7 ngày tới'}</strong>
   {info.upcoming.map(booking=><div key={booking.orderId} className="gu-visual-booking"><span>Nhận: {describeTime(booking.pickupAt,booking.pickupDate)}</span><span>Trả: {describeTime(booking.returnAt,booking.returnDate)}</span></div>)}
  </div>}
 </div>;
}
export function GuVisualFinder({api,onChoose,active=true,isAdmin=false}:{api:ApiCall;onChoose?:(item:InventoryItem)=>void;active?:boolean;isAdmin?:boolean}){
 const [file,setFile]=useState<File|null>(null);const [chosen,setChosen]=useState<InventoryItem|null>(null);
 const [copyNote,setCopyNote]=useState('');const [results,setResults]=useState<Hit[]>([]);
 const [loading,setLoading]=useState(false);const [indexing,setIndexing]=useState(false);const [progress,setProgress]=useState('');
 const [availabilityLoading,setAvailabilityLoading]=useState(false);const [availability,setAvailability]=useState<Record<string,VisualAvailabilityState>>({});
 const [availabilityError,setAvailabilityError]=useState('');const [note,setNote]=useState('');
 const indexRef=useRef<{rows:IndexRow[];checked:number}|null>(null);
 const token=useRef(0);const availabilityLastChecked=useRef(0);
 const loadIndex=async(force=false):Promise<IndexRow[]>=>{
  if(!force&&indexRef.current&&Date.now()-indexRef.current.checked<5*60_000)return indexRef.current.rows;
  const rows:IndexRow[]=[];let cursor:string|null=null;
  for(let page=0;page<120;page++){
   const response:{results:IndexRow[];cursor:string|null}=await api('v5/visual-catalog'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
   rows.push(...response.results);cursor=response.cursor;
   if(!cursor){indexRef.current={rows,checked:Date.now()};return rows;}
  }
  throw Error('Chỉ mục quá lớn để đọc đủ. Liên hệ Admin tối ưu chia trang.');
 };
 const loadAvailability=async(items:InventoryItem[],seq:number)=>{
  if(!items.length)return;setAvailabilityLoading(true);setAvailabilityError('');
  try{const response=await api<{states:Record<string,VisualAvailabilityState>}>('v5/visual-availability',{method:'POST',body:JSON.stringify({itemIds:items.map(i=>i.id)})});
   if(seq===token.current){setAvailability(response.states||{});availabilityLastChecked.current=Date.now();}}
  catch(e){if(seq===token.current)setAvailabilityError(e instanceof Error?e.message:'Không đọc được tình trạng kho.');}
  finally{if(seq===token.current)setAvailabilityLoading(false);}
 };
 useEffect(()=>{if(!active)return;const onPaste=(e:ClipboardEvent)=>{const pic=Array.from(e.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));
  if(pic){setFile(pic);setNote('Đã dán ảnh từ clipboard.');}};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);},[active]);
 useEffect(()=>{if(active&&results.length&&Date.now()-availabilityLastChecked.current>60_000)void loadAvailability(results.map(r=>r.item),token.current);},[active]);
 const pasteFile=async()=>{try{const clips=await navigator.clipboard.read();for(const clip of clips){const mime=clip.types.find(x=>x.startsWith('image/'));
   if(mime){const blob=await clip.getType(mime);setFile(new File([blob],'anh-dan.'+(mime.split('/')[1]||'png'),{type:mime}));return;}}
   throw Error('Clipboard chưa có ảnh.');}catch(e){setNote(e instanceof Error?e.message:'Không thể dán ảnh.');}};
 const backfill=async()=>{
  setIndexing(true);setNote('');try{
   const entries=await loadIndex(true);const missing=entries.filter(row=>!row.signature&&row.imagePath);let completed=0,updated=0;
   for(let i=0;i<missing.length;i+=12){
    const slice=missing.slice(i,i+12);const signatures=await Promise.all(slice.map(async row=>{
      try{return {id:row.id,imagePath:row.imagePath!,signature:await imageSignature(row.imagePath!)};}
      catch{return null;}
    }));
    const valid=signatures.filter((x):x is NonNullable<typeof x>=>x!==null);
    if(valid.length){const response=await api<{updated:number}>('v5/visual-catalog',{method:'POST',body:JSON.stringify({entries:valid})});updated+=response.updated;}
    completed+=slice.length;setProgress(`${completed}/${missing.length} ảnh cũ · đã lập ${updated} chỉ mục`);
   }
   await loadIndex(true);setNote(`Đã lập chỉ mục ${updated}/${missing.length} ảnh cũ. Những ảnh không truy cập được cần tải lại ảnh chuẩn.`);
  }catch(e){setNote(e instanceof Error?e.message:'Không thể lập chỉ mục.');}
  finally{setIndexing(false);}
 };
 const scan=async()=>{
  if(!file)return;const seq=++token.current;setLoading(true);setAvailability({});setAvailabilityError('');setResults([]);setChosen(null);setNote('');
  try{
   const [needle,rows]=await Promise.all([imageSignature(file),loadIndex()]);
   const candidates=rows.filter((row):row is IndexRow&{signature:VisualSignature}=>Boolean(row.signature));
   if(!candidates.length)throw Error('Kho chưa có chỉ mục ảnh. Admin cần bấm “Lập chỉ mục ảnh cũ” một lần.');
   const best=rankVisualItems(candidates,needle,12);
   const response=await api<{results:InventoryItem[]}>('catalog?kind=items&ids='+encodeURIComponent(best.map(x=>x.id).join(',')));
   const byId=new Map(response.results.map(item=>[item.id,item]));
   const hits=best.filter(row=>byId.has(row.id)).map(row=>({item:byId.get(row.id)!,score:0}));
   // Scores are similarity order, not probabilities of correct identity.
   if(seq!==token.current)return;setResults(hits);
   if(!hits.length)setNote('Không tìm thấy sản phẩm có chỉ mục hợp lệ.');
   else{const missing=rows.filter(row=>!row.signature).length;if(missing)setNote(`${missing} sản phẩm chưa có chỉ mục ảnh và chưa được so sánh; Admin có thể bổ sung chỉ mục.`);await loadAvailability(hits.map(hit=>hit.item),seq);}
  }catch(e){if(seq===token.current)setNote(e instanceof Error?e.message:'Không thể tìm theo ảnh.');}
  finally{if(seq===token.current)setLoading(false);}
 };
 return <section className={styles.finder} aria-label="Tìm sản phẩm bằng ảnh">
  <div className={styles.heading}><ImageSearch size={23}/><div><h3>Tìm sản phẩm bằng hình ảnh</h3><p>So khớp màu, bố cục và đường nét trong chỉ mục. Kết quả gần đúng để nhân viên đối chiếu, không cam kết nhận dạng 100%.</p></div></div>
  <div className={styles.actions}><label className="btn btn-white">Chọn ảnh<input hidden type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <label className="btn btn-white">Chụp ảnh<input hidden type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <button type="button" className="btn btn-white" onClick={()=>void pasteFile()}>Dán ảnh</button>
   <button type="button" className="btn btn-dark" disabled={!file||loading||indexing} onClick={()=>void scan()}>{loading?'Đang đối chiếu…':'Tìm sản phẩm'}</button>
   <button type="button" className="btn btn-white" disabled={loading||indexing} onClick={()=>{indexRef.current=null;setNote('Đã làm mới bộ đệm chỉ mục. Lần tìm tiếp theo sẽ đọc chỉ mục mới nhất từ máy chủ.');}}>Làm mới chỉ mục</button>
   {isAdmin&&<button type="button" className="btn btn-white" disabled={loading||indexing} onClick={()=>void backfill()}><Database size={15}/>{indexing?'Đang lập chỉ mục…':'Lập chỉ mục ảnh cũ'}</button>}
  </div>
  {file&&<small>Ảnh mẫu: {file.name}</small>}{progress&&<p className={styles.note}>{progress}</p>}
  {note&&<p className={styles.note} role="status"><AlertCircle size={16}/>{note}</p>}
  {availabilityError&&<div className="inline-alert danger-alert" role="alert">{availabilityError} <button type="button" className="btn btn-white" onClick={()=>void loadAvailability(results.map(r=>r.item),token.current)}>Thử lại</button></div>}
  {!!results.length&&<div className={styles.toolbar}><strong>{results.length} món gần giống nhất</strong><button className="btn btn-white" type="button" disabled={availabilityLoading} onClick={()=>void loadAvailability(results.map(r=>r.item),token.current)}><RefreshCcw size={15}/> Cập nhật tình trạng</button></div>}
  <div className={styles.grid} aria-live="polite">{results.map(({item},i)=><button key={item.id} className={styles.result} type="button" onClick={()=>{setChosen(item);onChoose?.(item);}}><ProductImage paths={item.imagePaths}/>
    <div><div className={styles.resultHeading}><strong>{item.name}</strong><small>#{i+1}</small></div><p>{item.hangerCode||item.sku} · {item.category}</p><StatusInfo info={availability[item.id]} pending={availabilityLoading}/></div>
  </button>)}</div>
  {chosen&&<aside className={`${styles.chosen} gu-v5-found-detail`}><h4>Đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><b>{chosen.hangerCode||chosen.sku}</b> · {chosen.category}</p><StatusInfo info={availability[chosen.id]} pending={availabilityLoading}/><button className="btn btn-white" type="button" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã sản phẩm.')).catch(()=>setCopyNote('Không thể sao chép trên thiết bị này.'))}>Sao chép mã</button>{copyNote&&<small>{copyNote}</small>}</aside>}
 </section>;
}
