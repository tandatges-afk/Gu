'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCcw,Search,AlertCircle} from 'lucide-react';
import {imageSignature} from '@/lib/visual-image';
import {preparePhonePhoto} from '@/lib/mobile-images';
import {rankVisualCandidates,type VisualIndexEntry} from '@/lib/visual-index';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
import {visibleStockLabel,type VisualAvailabilityState} from '@/lib/visual-availability';
import {formatVNDateTime,formatVNDateKey} from '@/lib/vn-datetime';
import styles from './GuVisualFinder.module.css';
const describeTime=(time:string|null,date:string)=>time?formatVNDateTime(time):formatVNDateKey(date);
type IndexRow={id:string;category:string;signatures:VisualIndexEntry[];missingImages?:string[];imagePath?:string};
type Hit={item:InventoryItem;distance:number;referenceCount:number};
function StatusInfo({info,pending}:{info:VisualAvailabilityState|undefined;pending:boolean}){
 const status=info?.status||'UNKNOWN';const label=pending?'Đang kiểm tra…':info?visibleStockLabel(status):'Chưa xác minh';
 const tone=pending||!info?'unknown':status==='AVAILABLE'?'available':status==='RENTED'?'rented':'blocked';
 return <div className="gu-visual-availability"><span className={'gu-visual-status gu-visual-status-'+tone}><i aria-hidden="true"/>{label}</span>
  {!pending&&info&&<div className="gu-visual-next-bookings"><strong>{info.upcoming.length?'Lịch đặt trong 7 ngày tới':'Chưa có lịch đặt trong 7 ngày tới'}</strong>
   {info.upcoming.map(booking=><div key={booking.orderId} className="gu-visual-booking"><span>Nhận: {describeTime(booking.pickupAt,booking.pickupDate)}</span><span>Trả: {describeTime(booking.returnAt,booking.returnDate)}</span></div>)}
  </div>}
 </div>;
}
export function GuVisualFinder({api,onChoose,active=true,isAdmin=false,availableCategories=[]}:{api:ApiCall;onChoose?:(item:InventoryItem)=>void;active?:boolean;isAdmin?:boolean;availableCategories?:string[]}){
 const [file,setFile]=useState<File|null>(null);const [chosen,setChosen]=useState<InventoryItem|null>(null);
 const [copyNote,setCopyNote]=useState('');const [results,setResults]=useState<Hit[]>([]);
 const [loading,setLoading]=useState(false);
 const [availabilityLoading,setAvailabilityLoading]=useState(false);const [availability,setAvailability]=useState<Record<string,VisualAvailabilityState>>({});
 const [availabilityError,setAvailabilityError]=useState('');const [note,setNote]=useState('');
 const [category,setCategory]=useState('ALL');
 const categories=Array.from(new Set(availableCategories.filter(Boolean))).sort((a,b)=>a.localeCompare(b,'vi'));
 useEffect(()=>{if(category!=='ALL'&&!categories.includes(category))setCategory('ALL');},[availableCategories.join('\u0000')]);
 const indexRef=useRef<{rows:IndexRow[];checked:number}|null>(null);
 const token=useRef(0);const availabilityLastChecked=useRef(0);
 const [preview,setPreview]=useState<string|null>(null);
 useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const chooseFile=(next:File|null)=>{
  token.current++;setFile(next);setChosen(null);setResults([]);setAvailability({});setNote('');setAvailabilityError('');
 };
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
  if(pic)chooseFile(pic);};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);},[active]);
 useEffect(()=>{if(active&&results.length&&Date.now()-availabilityLastChecked.current>60_000)void loadAvailability(results.map(r=>r.item),token.current);},[active]);
 const pasteFile=async()=>{try{const clips=await navigator.clipboard.read();for(const clip of clips){const mime=clip.types.find(x=>x.startsWith('image/'));
   if(mime){const blob=await clip.getType(mime);chooseFile(new File([blob],'anh-dan.'+(mime.split('/')[1]||'png'),{type:mime}));return;}}
   throw Error('Clipboard chưa có ảnh.');}catch(e){setNote(e instanceof Error?e.message:'Không thể dán ảnh.');}};
 const scan=async()=>{
  if(!file)return;const seq=++token.current;setLoading(true);setAvailability({});setAvailabilityError('');setResults([]);setChosen(null);setNote('');
  try{
   // Genuine image-model inference on the VPS is opt-in, with a graceful
   // fallback to the existing browser descriptor when the worker is offline.
   // No UI switches, chatbot, or extra employee actions are introduced.
   let aiRanked:{id:string;score:number}[]|null=null;
   try{
    const optimized=await preparePhonePhoto(file);
    const ai=await api<{ready:boolean;hits:{id:string;score:number}[]}>(
     'v5/visual-ai-search?category='+encodeURIComponent(category),
     {method:'POST',body:optimized,headers:{'Content-Type':optimized.type}}
    );
    if(ai.ready&&ai.hits.length)aiRanked=ai.hits;
   }catch{/* AI service disabled, unindexed or unavailable: use the proven finder. */}
   if(seq!==token.current)return;
   if(aiRanked){
    const response=await api<{results:InventoryItem[]}>('catalog?kind=items&ids='+encodeURIComponent(aiRanked.map(x=>x.id).join(',')));
    const byId=new Map(response.results.map(item=>[item.id,item]));
    const hits=aiRanked.filter(x=>byId.has(x.id)&&(category==='ALL'||byId.get(x.id)?.category===category))
     .map(x=>({item:byId.get(x.id)!,distance:Math.max(0,1-x.score),referenceCount:1}));
    if(seq!==token.current)return;
    if(hits.length){setResults(hits);await loadAvailability(hits.map(hit=>hit.item),seq);return;}
   }
   const [needle,rows]=await Promise.all([imageSignature(file),loadIndex()]);
   const candidates=rows.map(row=>({id:row.id,category:row.category,signatures:(row.signatures||[]).map(x=>x.signature)}))
    .filter(row=>row.signatures.length);
   if(!candidates.length)throw Error('Kho chưa có ảnh tham chiếu để tìm. Hãy thêm hoặc cập nhật ảnh sản phẩm trong Kho sản phẩm.');
   const ranked=rankVisualCandidates(candidates,needle,{category,relaxed:false,take:6});
   if(seq!==token.current)return;
   if(!ranked.length){
    setNote('Chưa tìm thấy sản phẩm đủ giống ảnh mẫu. Thử ảnh chụp rõ toàn bộ món và chọn đúng danh mục. GU không hiển thị những món chỉ xếp gần nhất nhưng không liên quan.');
    return;
   }
   const response=await api<{results:InventoryItem[]}>('catalog?kind=items&ids='+encodeURIComponent(ranked.map(x=>x.row.id).join(',')));
   const byId=new Map(response.results.map(item=>[item.id,item]));
   const hits=ranked.filter(x=>byId.has(x.row.id)).map(x=>({item:byId.get(x.row.id)!,distance:x.distance,referenceCount:x.referenceCount}));
   if(seq!==token.current)return;
   setResults(hits);
   if(!hits.length)setNote('Không tìm được món đang hoạt động có ảnh tham chiếu hợp lệ.');
   await loadAvailability(hits.map(hit=>hit.item),seq);
  }catch(e){if(seq===token.current)setNote(e instanceof Error?e.message:'Không thể tìm theo ảnh.');}
  finally{if(seq===token.current)setLoading(false);}
 };
 return <section className={styles.finder} aria-label="Tìm sản phẩm bằng ảnh">
  <div className={styles.heading}><Search size={23}/><div><h3>Tìm sản phẩm bằng hình ảnh</h3></div></div>
  <div className={styles.actions}><label className="btn btn-white">Chọn ảnh<input hidden type="file" accept="image/*" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label>
   <label className="btn btn-white">Chụp ảnh<input hidden type="file" accept="image/*" capture="environment" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label>
   <button type="button" className="btn btn-white" onClick={()=>void pasteFile()}>Dán ảnh</button>
   <button type="button" className="btn btn-dark" disabled={!file||loading} onClick={()=>void scan()}>{loading?'Đang đối chiếu…':'Tìm sản phẩm'}</button>

  </div>
  <div className={styles.searchSettings}>
   {preview&&<img src={preview} alt="Ảnh mẫu dùng tìm kiếm" className={styles.preview}/>}
   <div className={styles.filters}>
    <label>Danh mục cần tìm<select value={category} onChange={e=>{token.current++;setCategory(e.target.value);setResults([]);setChosen(null);setAvailability({});}}><option value="ALL">Tất cả danh mục</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   </div>
  </div>
  {file&&<small>Ảnh mẫu: {file.name}</small>}
  {note&&<p className={styles.note} role="status"><AlertCircle size={16}/>{note}</p>}
  {availabilityError&&<div className="inline-alert danger-alert" role="alert">{availabilityError} <button type="button" className="btn btn-white" onClick={()=>void loadAvailability(results.map(r=>r.item),token.current)}>Thử lại</button></div>}
  {!!results.length&&<div className={styles.toolbar}><strong>{results.length} món vượt ngưỡng tương đồng</strong><button className="btn btn-white" type="button" disabled={availabilityLoading} onClick={()=>void loadAvailability(results.map(r=>r.item),token.current)}><RefreshCcw size={15}/> Cập nhật tình trạng</button></div>}
  <div className={styles.grid} aria-live="polite">{results.map(({item,distance,referenceCount},i)=><button key={item.id} className={styles.result} type="button" onClick={()=>{setChosen(item);onChoose?.(item);}}><ProductImage paths={item.imagePaths}/>
    <div><div className={styles.resultHeading}><strong>{item.name}</strong><small>#{i+1}</small></div><p>{item.hangerCode||item.sku} · {item.category}</p><span className={styles.matchLabel}>{distance<.12?'Rất gần ảnh mẫu':'Có nét tương đồng'} · so với {referenceCount} ảnh</span><StatusInfo info={availability[item.id]} pending={availabilityLoading}/></div>
  </button>)}</div>
  {chosen&&<aside className={`${styles.chosen} gu-v5-found-detail`}><h4>Đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><b>{chosen.hangerCode||chosen.sku}</b> · {chosen.category}</p><StatusInfo info={availability[chosen.id]} pending={availabilityLoading}/><button className="btn btn-white" type="button" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã sản phẩm.')).catch(()=>setCopyNote('Không thể sao chép trên thiết bị này.'))}>Sao chép mã</button>{copyNote&&<small>{copyNote}</small>}</aside>}
 </section>;
}
