'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Search,BrainCircuit,Image as ImageIcon} from 'lucide-react';
import {thumbCloudinaryUrl} from '@/lib/cloudinary-images';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
import {visualAiEmbedding,cropImage,readVisualVector,saveVisualVector,basicVisualFingerprint,basicVisualDistance} from '@/lib/visual-ai-client';
import {visualCacheKey,VISUAL_CACHE_MS,VISUAL_FAST_LIMIT,VISUAL_MAX_RESULTS,vectorSimilarity,automaticVisualCrops} from '@/lib/visual-search-v55';

type Candidate=Pick<InventoryItem,'id'|'name'|'sku'|'hangerCode'|'category'|'size'|'color'|'imagePaths'>;
type Match={item:Candidate;score:number};
type Progress={done:number;total:number};
const MAX_FILE_BYTES=12*1024*1024;
const MAX_PRODUCTS=2000;
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
 const [chosen,setChosen]=useState<Candidate|null>(null);
 const [copyNote,setCopyNote]=useState('');
 const [results,setResults]=useState<Match[]>([]);
 const [loading,setLoading]=useState(false);
 const [note,setNote]=useState('');
 const [progress,setProgress]=useState<Progress>({done:0,total:0});
 const [previewUrl,setPreviewUrl]=useState('');
 const scanId=useRef(0);
 const categories=Array.from(new Set(categoryOptions.map(c=>c.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'vi'));
 useEffect(()=>{
  if(!file){setPreviewUrl('');return;}
  const url=URL.createObjectURL(file);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);
 },[file]);
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
  const pictureUrls:string[]=[];
  try{
   // The user only chooses a category. The app selects suitable photo regions automatically.
   const regions=automaticVisualCrops(category);
   for(const region of regions){
    const imageBlob=await cropImage(file,region);
    pictureUrls.push(URL.createObjectURL(imageBlob));
   }
   const {items}=await loadCatalog();
   if(myScan!==scanId.current)return;
   const candidates=items.filter(item=>Array.isArray(item.imagePaths)&&item.imagePaths.length);
   if(!candidates.length){setNote('Danh mục này chưa có ảnh sản phẩm.');return;}
   setNote('Đang tìm sản phẩm tương tự…');
   const referenceVectors:number[][]=[];
   for(const url of pictureUrls){
    referenceVectors.push(await visualAiEmbedding(url));
    if(myScan!==scanId.current)return;
   }
   // Small catalog: compare everything. Large catalog: short-list automatically,
   // but the final similarity score is always calculated with AI CLIP.
   let target=candidates;
   if(candidates.length>VISUAL_FAST_LIMIT){
    const basicRef=await basicVisualFingerprint(pictureUrls[0]);
    const colours:Array<{item:Candidate;distance:number}>=[];
    for(let i=0;i<candidates.length;i++){
     const item=candidates[i];
     try{
      const candidate=await basicVisualFingerprint(thumbCloudinaryUrl(item.imagePaths![0],120));
      colours.push({item,distance:basicVisualDistance(basicRef,candidate)});
     }catch{/* Image cannot be loaded for approximate preselection. */}
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
      const vector=await readVisualVector(photoUrl)||await (async()=>{
       const output=await visualAiEmbedding(thumb);
       await saveVisualVector(photoUrl,output);
       return output;
      })();
      const similarity=Math.max(...referenceVectors.map(ref=>vectorSimilarity(ref,vector)));
      const previous=score.get(item.id);
      if(!previous||similarity>previous.score)score.set(item.id,{item,score:similarity});
     }catch{/* product image unavailable: try its remaining angles */}
     done++;
     if(done%3===0||done===total){
      setProgress({done,total});
      setResults([...score.values()].sort((a,b)=>b.score-a.score).slice(0,VISUAL_MAX_RESULTS));
     }
    }
   }
   if(myScan!==scanId.current)return;
   setResults([...score.values()].sort((a,b)=>b.score-a.score).slice(0,VISUAL_MAX_RESULTS));
   setNote(score.size?'':'Chưa so sánh được ảnh sản phẩm. Kiểm tra kết nối Cloudinary.');
  }catch(e){
   if(myScan===scanId.current)setNote(e instanceof Error?`Không thể tìm bằng AI: ${e.message}`:'Không thể tìm bằng AI. Hãy thử lại.');
  }finally{
   for(const url of pictureUrls)URL.revokeObjectURL(url);
   if(myScan===scanId.current)setLoading(false);
  }
 };
 return <section className="gu-v5-finder gu-v55-visual">
  <div className="gu-v55-heading"><h3><BrainCircuit size={22}/> AI tìm sản phẩm bằng hình ảnh</h3></div>
  <div className="gu-v55-layout">
   <div className="gu-v55-form">
    <label className="form-field"><span>Danh mục sản phẩm</span><select className="input" value={category} onChange={e=>{scanId.current++;setLoading(false);setCategory(e.target.value);setResults([]);setChosen(null);}}>
      <option value="">— Chọn danh mục —</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}<option value="ALL">Tất cả danh mục</option>
    </select></label>
    <div className="gu-v55-file-actions"><label className="btn btn-white"><ImageIcon size={17}/> Chọn ảnh<input type="file" hidden accept="image/*" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label><label className="btn btn-white"><Camera size={17}/> Chụp ảnh<input type="file" hidden accept="image/*" capture="environment" onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label><button className="btn btn-white" type="button" onClick={()=>void pasteFile()}>Dán ảnh</button></div>
    {previewUrl&&<div className="gu-v55-image-preview"><img src={previewUrl} alt="Ảnh khách chọn để tìm kiếm"/></div>}
    <div className="gu-v55-buttons"><button className="btn btn-dark" type="button" disabled={!file||!category||loading} onClick={()=>void scan()}><Search size={17}/>{loading?'Đang xử lý…':'Tìm sản phẩm'}</button>{loading&&<button className="btn btn-white" type="button" onClick={()=>{scanId.current++;setLoading(false);setNote('Đã dừng tìm.');}}>Dừng tìm</button>}</div>
   </div>
   <div className="gu-v55-result-panel">
    <div className="gu-v55-result-title"><h4>Kết quả phù hợp</h4><span>{results.length} sản phẩm</span></div>
    {loading&&<div className="gu-v55-progress" role="status" aria-live="polite"><span>{progress.total?`Đang so sánh ảnh ${progress.done}/${progress.total}`:'Đang tải dữ liệu hoặc mô hình AI…'}</span>{progress.total>0&&<progress value={progress.done} max={progress.total}/>}</div>}
    {note&&<p className="gu-v5-search-note" role="status">{note}</p>}
    {!results.length&&!loading&&<div className="gu-v55-empty"><Search size={28}/><p>Chưa có kết quả.</p></div>}
    <div className="gu-v5-search-results gu-v55-result-grid">{results.map(({item},index)=><button key={item.id} type="button" className="gu-v5-product" onClick={()=>{setChosen(item);}}><ProductImage paths={item.imagePaths}/><span><b>{item.name}</b><small>{item.hangerCode||item.sku} · {item.category}</small></span><strong>#{index+1}</strong></button>)}</div>
    {chosen&&<div className="panel gu-v5-found-detail"><h4>Đã chọn để đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><strong>Mã sản phẩm: {chosen.hangerCode||chosen.sku}</strong> · {chosen.category}</p><button className="btn btn-white" type="button" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã.')).catch(()=>setCopyNote('Không thể sao chép mã.'))}>Sao chép mã sản phẩm</button>{onChoose&&<button className="btn btn-dark" type="button" onClick={()=>onChoose(chosen as InventoryItem)}>Xem lịch thuê của sản phẩm</button>}{copyNote&&<small>{copyNote}</small>}</div>}
   </div>
  </div>
 </section>;
}
