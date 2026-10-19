'use client';
import {useEffect,useState} from 'react';
import {thumbCloudinaryUrl} from '@/lib/cloudinary-images';
import {ProductImage,type ApiCall} from './GuExtras';
import type {InventoryItem} from '@/lib/types';
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
export function GuVisualFinder({api,onChoose}:{api:ApiCall;onChoose?:(item:InventoryItem)=>void}){
 const [file,setFile]=useState<File|null>(null);const [chosen,setChosen]=useState<InventoryItem|null>(null);const [copyNote,setCopyNote]=useState('');const [results,setResults]=useState<Array<{item:InventoryItem;score:number}>>([]);const [loading,setLoading]=useState(false);const [note,setNote]=useState('');
 const pasteFile=async()=>{try{if(!navigator.clipboard?.read)throw Error('Trình duyệt không hỗ trợ đọc ảnh clipboard.');const clips=await navigator.clipboard.read();for(const clip of clips){const mime=clip.types.find(x=>x.startsWith('image/'));if(mime){const blob=await clip.getType(mime);setFile(new File([blob],'anh-dan.'+(mime.split('/')[1]||'png'),{type:mime}));setNote('Đã nhận ảnh từ clipboard.');return;}}throw Error('Clipboard chưa có ảnh.');}catch(e){setNote(e instanceof Error?e.message:'Không thể dán ảnh.');}};
 useEffect(()=>{const onPaste=(e:ClipboardEvent)=>{const file=Array.from(e.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));if(file){setFile(file);setNote('Đã dán ảnh bằng Ctrl+V.');}};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);},[]);
 const scan=async()=>{if(!file)return;setLoading(true);setNote('');setResults([]);setChosen(null);
 try{const ref=await photoVector(file);let cursor:string|null=null;const catalog:InventoryItem[]=[];
 for(let page=0;page<3;page++){const q='v5/visual-catalog?size=50'+(cursor?'&cursor='+encodeURIComponent(cursor):'');const r:{results:InventoryItem[];cursor:string|null}=await api(q);catalog.push(...r.results);cursor=r.cursor;if(!cursor)break;}
 const candidates=catalog.filter(i=>!i.archivedAt&&i.imagePaths?.[0]);const scored:Array<{item:InventoryItem;score:number}>=[];
 let index=0;await Promise.all(Array.from({length:6},async()=>{while(index<candidates.length){const item=candidates[index++];try{const fp=await photoVector(thumbCloudinaryUrl(item.imagePaths![0],120));scored.push({item,score:distance(ref,fp)});}catch{/* image unavailable */}}}));
 scored.sort((a,b)=>a.score-b.score);setResults(scored.slice(0,12));
 
 }catch(e){setNote(e instanceof Error?e.message:'Không tìm được ảnh.');}finally{setLoading(false);}};
 return <section className="gu-v5-finder"><h3>Tìm sản phẩm bằng hình ảnh</h3><div className="gu-v5-photo-actions"><label className="btn btn-white">Chọn ảnh <input hidden type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label className="btn btn-white">Chụp ảnh <input hidden type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button type="button" className="btn btn-white" onClick={()=>void pasteFile()}>Dán ảnh</button><button type="button" className="btn btn-dark" disabled={!file||loading} onClick={()=>void scan()}>{loading?'Đang so sánh…':'Tìm sản phẩm'}</button></div>{file&&<small>Ảnh: {file.name}</small>}{note&&<p className="gu-v5-search-note">{note}</p>}
 <div className="gu-v5-search-results">{results.map(({item},index)=><button key={item.id} type="button" className="gu-v5-product" onClick={()=>{setChosen(item);onChoose?.(item);}}><ProductImage paths={item.imagePaths}/><span><b>{item.name}</b><small>{item.hangerCode||item.sku} · {item.category}</small></span><strong>#{index+1}</strong></button>)}</div>{chosen&&<div className="panel gu-v5-found-detail"><h4>Đã chọn để đối chiếu: {chosen.name}</h4><ProductImage paths={chosen.imagePaths}/><p><strong>Mã sản phẩm: {chosen.hangerCode||chosen.sku}</strong> · {chosen.category}</p>{chosen.cameraSerial&&<p>Serial thân máy: {chosen.cameraSerial}</p>}<button type="button" className="btn btn-white" onClick={()=>void navigator.clipboard.writeText(chosen.hangerCode||chosen.sku).then(()=>setCopyNote('Đã sao chép mã sản phẩm.')).catch(()=>setCopyNote('Thiết bị không cho phép sao chép.'))}>Sao chép mã sản phẩm</button>{copyNote&&<small>{copyNote}</small>}</div>}</section>;
}
