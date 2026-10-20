import {type VisualSignature} from './visual-index';
import {thumbCloudinaryUrl} from './cloudinary-images';
/** Client only. Capture 24 colour / quadrant metrics and 64 gradient comparisons. */
export function imageSignature(source:File|string):Promise<VisualSignature>{
 return new Promise((resolve,reject)=>{
  const objectUrl=typeof source!=='string'?URL.createObjectURL(source):null;
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas không hỗ trợ');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,32,32);
    const scale=Math.min(32/img.width,32/img.height);
    const w=img.width*scale,h=img.height*scale;
    ctx.drawImage(img,(32-w)/2,(32-h)/2,w,h);
    const pixels=ctx.getImageData(0,0,32,32).data;
    const values=Array(24).fill(0) as number[];
    const lum=(x:number,y:number)=>{const i=(y*32+x)*4;return (pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)/255;};
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const i=(y*32+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      values[Math.min(3,Math.floor(r/64))]++;
      values[4+Math.min(3,Math.floor(g/64))]++;
      values[8+Math.min(3,Math.floor(b/64))]++;
      values[12+Math.min(3,Math.floor(((r+g+b)/3)/64))]++;
      const q=(y>=16?2:0)+(x>=16?1:0);
      values[16+q]+=lum(x,y);
      values[20+q]+=lum(x,y)<0.5?1:0;
    }
    const hashBits:string[]=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const xa=Math.min(30,Math.floor(x*31/8)),xb=xa+1,yy=Math.floor((y+.5)*32/8);
      hashBits.push(lum(xa,yy)>lum(xb,yy)?'1':'0');
    }
    const hash=Array.from({length:16},(_,i)=>parseInt(hashBits.slice(i*4,i*4+4).join(''),2).toString(16)).join('');
    resolve({version:1,features:values.map(v=>Math.round(v/1024*10000)/10000),hash});
   }catch{reject(Error('Không thể phân tích đặc trưng ảnh, kiểm tra CORS Cloudinary.'));}
   finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}
  };
  img.onerror=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);reject(Error('Ảnh không tải được để phân tích.'));};
  img.src=objectUrl||thumbCloudinaryUrl(source as string,320);
 });
}
