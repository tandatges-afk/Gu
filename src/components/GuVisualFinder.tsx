'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Search,RefreshCw,BrainCircuit,Image as ImageIcon} from 'lucide-react';
import {thumbCloudinaryUrl} from '@/lib/cloudinary-images';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
import {visualAiEmbedding,cropImage,readVisualVector,saveVisualVector,basicVisualFingerprint,basicVisualDistance} from '@/lib/visual-ai-client';
import {visualCacheKey,VISUAL_CACHE_MS,VISUAL_FAST_LIMIT,VISUAL_MAX_RESULTS,vectorSimilarity,type CropMode} from '@/lib/visual-search-v55';

type Candidate=Pick<InventoryItem,'id'|'name'|'sku'|'hangerCode'|'category'|'size'|'color'|'imagePaths'>;
type Match={item:Candidate;score:number};
type Progress={done:number;total:number};
const MAX_FILE_BYTES=12*1024*1024;
const MAX_PRODUCTS=2000;
const croppers:{id:CropMode;name:string}[]=[
 {id:'full',name:'Toàn ảnh'},{id:'center',name:'Vùng trang phục giữa ảnh'},
 {id:'lower',name:'Nửa dưới (váy/quần)'},{id:'left',name:'Nửa trái ảnh'},{id:'right',name:'Nửa phải ảnh'}
];
function loadSaved(uid:string,category:string):Candidate[]|null{
 try{const raw=sessionStorage.getItem(visualCacheKey(uid,category));if(!raw)return null;
  const data=JSON.parse(raw) as {at:number;items:Candidate[]};
  if(!data?.at||Date.now()-data.at>VISUAL_CACHE_MS||data.at<Number(sessionStorage.getItem('gu-visual-catalog-revision-v55')||0)||!Array.isArray(data.items))return null;
  return data.items;
 }catch{return null;}
}
function saveCatalog(uid:string,category:string,items:Candidate[]){
 try{sessionStorage.setItem(visualCacheKey(uid,category),JSON.stringify({at:Date.now(),items}));}
 catch{/* If catalog is large, the in-memory results remain usable. */}
}
export function GuVisualFinder({api,uid='unknown',categoryOptions=[],onChoose}:{
 api:ApiCall;uid?:string;categoryOptions?:string[];onChoose?:(item:InventoryItem)=>void;
}){
 const [file,setFile]=useState<File|null>(null);
 const [category,setCategory]=useState('');
 const [crop,setCrop]=useState<CropMode>('full');
 const [deep,setDeep]=useState(false);
 const [mode,setMode]=useState<'ai'|'basic'>('ai');
 const [chosen,setChosen]=useState<Candidate|null>(null);
 const [copyNote,setCopyNote]=useState('');
 const [results,setResults]=useState<Match[]>([]);
 const [loading,setLoading]=useState(false);
 const [note,setNote]=useState('');
 const [progress,setProgress]=useState<Progress>({done:0,total:0});
 const [previewUrl,setPreviewUrl]=useState('');
 const [cropPreviewUrl,setCropPreviewUrl]=useState('');
 const scanId=useRef(0);
 const categories=Array.from(new Set(categoryOptions.map(c=>c.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'vi'));
 useEffect(()=>{
  if(!file){setPreviewUrl('');return;}
  const url=URL.createObjectURL(file);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);
 },[file]);
 useEffect(()=>{
  if(!file||crop==='full'){setCropPreviewUrl('');return;}
  let cancelled=false;let url:string|undefined;
  void cropImage(file,crop).then(blob=>{url=URL.createObjectURL(blob);if(!cancelled)setCropPreviewUrl(url);else URL.revokeObjectURL(url);}).catch(()=>{if(!cancelled)setCropPreviewUrl('');});
  return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
 },[file,crop]);
 // If page is left, ignore stale asynchronous inference results.
 useEffect(()=>()=>{scanId.current++;},[]);
 const chooseFile=(next:File|null)=>{
  if(next&&(!next.type.startsWith('image/')||next.size>MAX_FILE_BYTES)){
   setNote('Hãy chọn ảnh JPG/PNG/WEBP tối đa 12 MB.');return;
  }
  scanId.current++;setLoading(false);setFile(next);setResults([]);setChosen(null);setProgress({done:0,total:0});setNote('');
 };
 const pasteFile=async()=>{
  try{if(!navigator.clipboard?.read)throw Error('Trình duyệt không hỗ trợ đọc ảnh clipboard.');
   const clips=await navigator.clipboard.read();for(const clip of clips){const mime=clip.types.find(x=>x.startsWith('image/'));if(mime){const blob=await clip.getType(mime);chooseFile(new File([blob],'anh-dan.'+(mime.split('/')[1]||'png'),{type:mime}));return;}}
   throw Error('Clipboard không có hình ảnh.');
  }catch(e){setNote(e instanceof Error?e.message:'Không dán được ảnh.');}
 };
 useEffect(()=>{const onPaste=(e:ClipboardEvent)=>{const f=Array.from(e.clipboardData?.files||[]).find(x=>x.type.startsWith('image/'));if(f)chooseFile(f);};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);},[]);
 const clearCachedCategory=()=>{
  try{sessionStorage.removeItem(visualCacheKey(uid,category));}catch{}setNote('Danh mục sẽ được tải mới ở lần tìm tiếp theo.');
 };
 const loadCatalog=async():Promise<{items:Candidate[];cached:boolean}>=>{
  const saved=loadSaved(uid,category);if(saved)return {items:saved,cached:true};
  const catalog:Candidate[]=[];let cursor:string|null=null;
  for(let page=0;page<Math.ceil(MAX_PRODUCTS/50);page++){
   const path='v5/visual-catalog?category='+encodeURIComponent(category)+(cursor?'&cursor='+encodeURIComponent(cursor):'');
   const response:{results:Candidate[];cursor:string|null}=await api(path);
   catalog.push(...response.results);cursor=response.cursor;
   if(!cursor)break;
  }
  if(cursor)throw Error('Danh mục vượt giới hạn 2.000 sản phẩm. Cần chia nhỏ thêm danh mục.');
  saveCatalog(uid,category,catalog);return {items:catalog,cached:false};
 };
 const scan=async()=>{
  if(!file||!category||loading)return;
  const myScan=++scanId.current;
  setLoading(true);setResults([]);setChosen(null);setProgress({done:0,total:0});setNote('Đang chuẩn bị ảnh…');
  let blobUrl:string|undefined;
  try{
   const cropBlob=await cropImage(file,crop);blobUrl=URL.createObjectURL(cropBlob);
   const pictureUrl=blobUrl;
   const {items,cached}=await loadCatalog();
   if(myScan!==scanId.current)return;
   const candidates=items.filter(item=>Array.isArray(item.imagePaths)&&item.imagePaths.length);
   if(!candidates.length){setNote('Danh mục này chưa có ảnh sản phẩm.');return;}
   setNote(cached?'Đang dùng danh mục đã tải gần đây (không đọc lại kho).':'Đã tải danh mục; sẽ lưu tạm 5 phút để giảm Firestore Reads.');
   const ref=mode==='ai'?await visualAiEmbedding(pictureUrl):await basicVisualFingerprint(pictureUrl);
   if(myScan!==scanId.current)return;
   // Quick mode keeps the UI responsive. Deep mode checks every product in the selected category.
   // Light first-pass colour rank is only a shortlist, never the final AI similarity score.
   let target=candidates;
   const basicRef=mode==='ai'&&!deep&&candidates.length>VISUAL_FAST_LIMIT?await basicVisualFingerprint(pictureUrl):ref;
   if(!deep&&candidates.length>VISUAL_FAST_LIMIT){
    const colours:Array<{item:Candidate;distance:number}>=[];
    for(let i=0;i<candidates.length;i++){
     const item=candidates[i];try{
      const candidate=await basicVisualFingerprint(thumbCloudinaryUrl(item.imagePaths![0],120));
      colours.push({item,distance:basicVisualDistance(basicRef,candidate)});
     }catch{/* inaccessible thumbnail */}
     if(myScan!==scanId.current)return;
     if(i%20===0)setProgress({done:i+1,total:candidates.length});
    }
    colours.sort((a,b)=>a.distance-b.distance);
    target=colours.slice(0,VISUAL_FAST_LIMIT).map(x=>x.item);
   }
   const total=target.reduce((sum,item)=>sum+Math.min(3,item.imagePaths?.length||0),0);
   setProgress({done:0,total});
   const score=new Map<string,Match>();let done=0;
   for(const item of target){
    for(const photoUrl of (item.imagePaths||[]).slice(0,3)){
     if(myScan!==scanId.current)return;
     try{
      const thumb=thumbCloudinaryUrl(photoUrl,256);
      let similarity:number;
      if(mode==='ai'){
       const vector=await readVisualVector(photoUrl)||await (async()=>{
        const output=await visualAiEmbedding(thumb);await saveVisualVector(photoUrl,output);return output;
       })();
       similarity=vectorSimilarity(ref,vector);
      }else{
       const fingerprint=await basicVisualFingerprint(thumb);
       similarity=-basicVisualDistance(ref,fingerprint);
      }
      const previous=score.get(item.id);
      if(!previous||similarity>previous.score)score.set(item.id,{item,score:similarity});
     }catch{/* product image unavailable: try its remaining angles */}
     done++;if(done%3===0||done===total){setProgress({done,total});const ranked=[...score.values()].sort((a,b)=>b.score-a.score).slice(0,VISUAL_MAX_RESULTS);setResults(ranked);}
    }
   }
   if(myScan!==scanId.current)return;
   setResults([...score.values()].sort((a,b)=>b.score-a.score).slice(0,VISUAL_MAX_RESULTS));
   setNote(score.size?`Đã đối chiếu ${score.size} sản phẩm, ${done} ảnh bằng ${mode==='ai'?'AI CLIP':'phương pháp màu cơ bản'}. Điểm AI chỉ để xếp hạng, không xác nhận cùng một sản phẩm.`:'Không đọc được ảnh sản phẩm. Kiểm tra Cloudinary và kết nối mạng.');
  }catch(e){if(myScan===scanId.current)setNote((e instanceof Error?e.message:'Tìm ảnh thất bại.')+(mode==='ai'?' Có thể chuyển sang chế độ cơ bản nếu mô hình AI chưa tải được.':''));}
  finally{if(blobUrl)URL.revokeObjectURL(blobUrl);if(myScan===scanId.current)setLoading(false);}
 };
 return <section className="gu-v5-finder gu-v55-visual">
  <div className="gu-v55-heading"><div><h3><BrainCircuit size={22}/> AI tìm sản phẩm bằng hình ảnh</h3><p>Chọn đúng danh mục trước khi tìm để giảm lượt đọc Firestore. Ảnh khách chỉ được xử lý trên thiết bị, không tải lên GU.</p></div></div>
  <div className="gu-v55-layout">
   <div className="gu-v55-form">
    <label className="form-field"><span>1 · Danh mục sản phẩm</span><select className="input" value={category} onChange={e=>{scanId.current++;setLoading(false);setCategory(e.target.value);setResults([]);setChosen(null);}}>
      <option value="">— Chọn danh mục —</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}<option value="ALL">Tất cả (tốn Reads hơn)</option>
    </select></label>
    <div className="gu-v55-file-actions"><label className="btn btn-white"><ImageIcon size={17}/> Chọn ảnh<input type="file" hidden accept="image/*" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label><label className="btn btn-white"><Camera size={17}/> Chụp ảnh<input type="file" hidden accept="image/*" capture="environment" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label><button className="btn btn-white" type="button" onClick={()=>void pasteFile()}>Dán ảnh</button></div>
    {previewUrl&&<div className="gu-v55-image-preview"><img src={cropPreviewUrl||previewUrl} alt="Vùng ảnh khách sẽ được dùng để tìm kiếm"/><small>{file?.name} · Vùng được dùng để so sánh</small></div>}
    <label className="form-field"><span>2 · Tập trung vào phần ảnh cần tìm</span><select className="input" value={crop} onChange={e=>{scanId.current++;setLoading(false);setCrop(e.target.value as CropMode);setResults([]);}}>{croppers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="form-field"><span>3 · Cách so sánh</span><select className="input" value={mode} onChange={e=>{scanId.current++;setLoading(false);setMode(e.target.value as 'ai'|'basic');setResults([]);}}><option value="ai">AI CLIP (hình dáng và phong cách)</option><option value="basic">So sánh màu cơ bản (dự phòng)</option></select></label>
    <label className="gu-v55-check"><input type="checkbox" checked={deep} onChange={e=>{scanId.current++;setLoading(false);setDeep(e.target.checked);setResults([]);}}/> Quét kỹ toàn danh mục (chậm hơn ở lần đầu, chính xác hơn chế độ nhanh)</label>
    <div className="gu-v55-buttons"><button className="btn btn-dark" type="button" disabled={!file||!category||loading} onClick={()=>void scan()}><Search size={17}/>{loading?'Đang xử lý…':'Tìm sản phẩm'}</button><button className="btn btn-white" type="button" onClick={clearCachedCategory} disabled={!category||loading}><RefreshCw size={16}/> Cập nhật danh mục</button>{loading&&<button className="btn btn-white" type="button" onClick={()=>{scanId.current++;setLoading(false);setNote('Đã dừng tìm.');}}>Dừng tìm</button>}</div>
   </div>
   <div className="gu-v55-result-panel">
    <div className="gu-v55-result-title"><h4>Kết quả phù hợp</h4><span>{results.length} sản phẩm</span></div>
    {loading&&<div className="gu-v55-progress" role="status" aria-live="polite"><span>{progress.total?`Đang so sánh ảnh ${progress.done}/${progress.total}`:'Đang tải dữ liệu hoặc mô hình AI…'}</span>{progress.total>0&&<progress value={progress.done} max={progress.total}/>}</div>}
    {note&&<p className="gu-v5-search-note" role="status">{note}</p>}
    {!results.length&&!loading&&<div className="gu-v55-empty"><Search size={28}/><p>Chọn danh mục, tải ảnh và nhấn <b>Tìm sản phẩm</b>. Ảnh sản phẩm chỉ tải và so sánh khi cần thiết.</p></div>}
    <div className="gu-v5-search-results gu-v55-result-grid">{results.map(({item,score},index)=><button key={item.id} type="button" className="gu-v5-product" onClick={()=>{setChosen(item);}}><ProductImage paths={item.imagePaths}/><span><b>{item.name}</b><small>{item.hangerCode||item.sku} · {item.category}</small><small>{mode==='ai'?`Độ tương đồng CLIP: ${score.toFixed(3)}`:'Mức gần màu: '+(-score).toFixed(2)}</small></span><strong>#{index+1}</strong></button>)}</div>
    {chosen&&<div className="panel gu-v5-found-detail"><h4>Đã chọn để đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><strong>Mã sản phẩm: {chosen.hangerCode||chosen.sku}</strong> · {chosen.category}</p><button className="btn btn-white" type="button" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã.')).catch(()=>setCopyNote('Không thể sao chép mã.'))}>Sao chép mã sản phẩm</button>{onChoose&&<button className="btn btn-dark" type="button" onClick={()=>onChoose(chosen as InventoryItem)}>Xem lịch thuê của sản phẩm</button>}{copyNote&&<small>{copyNote}</small>}</div>}
   </div>
  </div>
 </section>;
}
