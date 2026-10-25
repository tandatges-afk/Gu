/** Lazy, on-device CLIP embeddings. No uploaded customer picture reaches GU servers. */
import {VISUAL_MODEL_ID,normalizedVector,type CropMode,cropBounds} from './visual-search-v55';
let extractor:Promise<(url:string)=>Promise<number[]>>|null=null;

async function getExtractor():Promise<(url:string)=>Promise<number[]>> {
 if(!extractor)extractor=(async()=>{
  const {pipeline}=await import('@huggingface/transformers');
  // The ONNX model downloads once and is cached by the browser. CPU/WASM on any PC;
  // on some phones the first inference may be slow.
  const model=await pipeline('image-feature-extraction',VISUAL_MODEL_ID,{device:'wasm'});
  return async(url:string)=>{
   const output=await model(url);
   const tensor=output as unknown as {data?:Float32Array|number[]};
   if(!tensor.data||tensor.data.length!==512)throw Error('Mô hình AI không trả về embedding CLIP 512 chiều.');
   return normalizedVector(tensor.data);
  };
 })().catch(e=>{extractor=null;throw e;});
 return extractor;
}

export async function visualAiEmbedding(url:string):Promise<number[]>{return (await getExtractor())(url);}

function loadPicture(source:File):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(source);const picture=new Image();
 picture.onload=()=>{URL.revokeObjectURL(url);resolve(picture);};
 picture.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Không đọc được ảnh khách gửi.'));};
 picture.src=url;
});}

export async function cropImage(file:File,mode:CropMode):Promise<Blob>{
 if(mode==='full')return file;
 const picture=await loadPicture(file);const [x,y,w,h]=cropBounds(mode);
 const canvas=document.createElement('canvas');const sw=Math.floor(picture.naturalWidth*w);const sh=Math.floor(picture.naturalHeight*h);
 canvas.width=Math.min(896,Math.max(32,sw));canvas.height=Math.max(32,Math.round(canvas.width*sh/Math.max(1,sw)));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Không thể cắt ảnh trên thiết bị.');
 ctx.drawImage(picture,Math.floor(picture.naturalWidth*x),Math.floor(picture.naturalHeight*y),sw,sh,0,0,canvas.width,canvas.height);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Không tạo được vùng ảnh.')),'image/jpeg',.85));
}

function openVectorDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const request=indexedDB.open('gu-v55-visual-vectors',1);
 request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('embeddings'))db.createObjectStore('embeddings');};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
/** Persistent cache of PUBLIC catalog image embeddings only (never store customer inputs). */
export async function readVisualVector(photoUrl:string):Promise<number[]|null>{
 try{const db=await openVectorDb();const result=await new Promise<unknown>((resolve,reject)=>{
  const request=db.transaction('embeddings','readonly').objectStore('embeddings').get(VISUAL_MODEL_ID+'|'+photoUrl);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });db.close();return Array.isArray(result)&&result.length===512?result as number[]:null;
 }catch{return null;}
}
export async function saveVisualVector(photoUrl:string,vector:number[]):Promise<void>{
 try{const db=await openVectorDb();await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('embeddings','readwrite');tx.objectStore('embeddings').put(vector,VISUAL_MODEL_ID+'|'+photoUrl);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });db.close();}catch{/* Private browser mode may block IndexedDB. */}
}

/** Lightweight fallback for when AI model cannot be downloaded. */
export async function basicVisualFingerprint(url:string):Promise<number[]>{
 return new Promise((resolve,reject)=>{
  const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{
   try{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error();
    ctx.drawImage(img,0,0,32,32);const {data}=ctx.getImageData(0,0,32,32);const v=Array(24).fill(0) as number[];
    for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];v[Math.min(3,r>>6)]++;v[4+Math.min(3,g>>6)]++;v[8+Math.min(3,b>>6)]++;v[12+Math.min(3,Math.floor((r+g+b)/3/64))]++;}
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const p=(y*32+x)*4,lum=(data[p]+data[p+1]+data[p+2])/3,sector=(y>=16?2:0)+(x>=16?1:0);v[16+sector]+=lum/255;v[20+sector]+=lum<128?1:0;}
    resolve(v.map(n=>n/1024));
   }catch{reject(Error('Ảnh không hỗ trợ so sánh; hãy kiểm tra Cloudinary/CORS.'));}
  };img.onerror=()=>reject(Error('Không tải được ảnh sản phẩm.'));img.src=url;
 });
}
export function basicVisualDistance(a:number[],b:number[]):number{return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);}
