import {type VisualSignatureV2} from './visual-index';
import {thumbCloudinaryUrl} from './cloudinary-images';

/** Client-only foreground-aware image fingerprint. No customer image is sent to
 * a third-party vision API; only the in-browser descriptor is compared. */
export function imageSignature(source:File|string):Promise<VisualSignatureV2>{
 return new Promise((resolve,reject)=>{
  const objectUrl=typeof source!=='string'?URL.createObjectURL(source):null;
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas không hỗ trợ.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,160,160);
    const scale=Math.min(160/img.width,160/img.height);
    const width=img.width*scale,height=img.height*scale;
    ctx.drawImage(img,(160-width)/2,(160-height)/2,width,height);
    const original=ctx.getImageData(0,0,160,160).data;
    const pixel=(x:number,y:number)=>{const i=(y*160+x)*4;return [original[i]/255,original[i+1]/255,original[i+2]/255] as const;};
    // Background elimination is used only when all four corners agree. If the
    // reference is a busy photo, do not aggressively erase its actual subject.
    const corners=[pixel(5,5),pixel(154,5),pixel(5,154),pixel(154,154)];
    const bg=[0,1,2].map(i=>corners.reduce((s,c)=>s+c[i],0)/4);
    const delta=(rgb:readonly number[])=>Math.sqrt(rgb.reduce((s,v,i)=>s+(v-bg[i])**2,0)/3);
    const flatBg=corners.every(c=>delta(c)<.09);
    const left=Math.max(0,Math.floor((160-width)/2));const right=Math.min(159,Math.ceil((160+width)/2));
    const top=Math.max(0,Math.floor((160-height)/2));const bottom=Math.min(159,Math.ceil((160+height)/2));
    const included=(x:number,y:number)=>x>=left&&x<=right&&y>=top&&y<=bottom&&(!flatBg||delta(pixel(x,y))>.13);
    let bounds={x0:160,y0:160,x1:0,y1:0},count=0;
    for(let y=top;y<=bottom;y+=2)for(let x=left;x<=right;x+=2){
      if(included(x,y)){count++;bounds.x0=Math.min(bounds.x0,x);bounds.y0=Math.min(bounds.y0,y);bounds.x1=Math.max(bounds.x1,x);bounds.y1=Math.max(bounds.y1,y);}
    }
    const subjectOk=flatBg&&count>=90&&count<Math.max(1,((right-left+1)*(bottom-top+1))/4)*.96;
    const pad=6;
    const crop=subjectOk?{
      x0:Math.max(0,bounds.x0-pad),y0:Math.max(0,bounds.y0-pad),x1:Math.min(159,bounds.x1+pad),y1:Math.min(159,bounds.y1+pad)
    }:{x0:left,y0:top,x1:right,y1:bottom};
    const W=64,H=64;
    const values=Array(58).fill(0) as number[];
    const grays=new Float32Array(W*H);const mask=new Uint8Array(W*H);
    let total=0,foreground=0,sumR=0,sumG=0,sumB=0;
    const sample=(x:number,y:number)=>pixel(Math.max(0,Math.min(159,Math.floor(crop.x0+(x+.5)*(crop.x1-crop.x0+1)/W))),Math.max(0,Math.min(159,Math.floor(crop.y0+(y+.5)*(crop.y1-crop.y0+1)/H))));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const rgb=sample(x,y),[r,g,b]=rgb;
      const max=Math.max(r,g,b),min=Math.min(r,g,b),diff=max-min;
      const l=(r*.299+g*.587+b*.114);const index=y*W+x;
      grays[index]=l;
      const fg=!subjectOk||delta(rgb)>.13;
      if(!fg)continue;
      mask[index]=1;foreground++;
      const s=max===0?0:diff/max;
      let h=0;
      if(diff>1e-6){if(max===r)h=((g-b)/diff+6)%6;else if(max===g)h=(b-r)/diff+2;else h=(r-g)/diff+4;h/=6;}
      if(s>.17&&l>.06){values[Math.min(11,Math.floor(h*12))]+=s;total+=s;}
      values[12+Math.min(4,Math.floor(s*5))]++;
      values[17+Math.min(4,Math.floor(l*5))]++;
      values[22+Math.min(15,Math.floor(y/16)*4+Math.floor(x/16))]++;
      values[46+Math.min(7,Math.floor(l*8))]++;
      sumR+=r;sumG+=g;sumB+=b;
    }
    const norm=(from:number,to:number,n:number)=>{for(let i=from;i<to;i++)values[i]=n?values[i]/n:0;};
    norm(0,12,total);norm(12,17,foreground);norm(17,22,foreground);norm(22,38,foreground);norm(46,54,foreground);
    let edgeCount=0;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const i=y*W+x;if(!mask[i])continue;
      const gx=grays[i+1]-grays[i-1],gy=grays[i+W]-grays[i-W];
      const magnitude=Math.hypot(gx,gy);if(magnitude<.12)continue;
      const angle=(Math.atan2(gy,gx)+Math.PI)/(2*Math.PI);
      values[38+Math.min(7,Math.floor(angle*8))]+=magnitude;
      edgeCount+=magnitude;
    }
    norm(38,46,edgeCount);
    const denominator=Math.max(foreground,1);
    values[54]=sumR/denominator;values[55]=sumG/denominator;values[56]=sumB/denominator;
    values[57]=foreground/(W*H);
    // dHash samples are spread across normalized content, not two adjacent
    // pixels, which used to collapse different images to the same hash.
    const hashBits:string[]=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const yy=Math.min(63,Math.round((y+.5)*64/8)),xa=Math.min(63,Math.round((x+.2)*64/9)),xb=Math.min(63,Math.round((x+1.2)*64/9));
      hashBits.push(grays[yy*64+xa]>grays[yy*64+xb]?'1':'0');
    }
    const hash=Array.from({length:16},(_,i)=>parseInt(hashBits.slice(i*4,i*4+4).join(''),2).toString(16)).join('');
    resolve({version:2,features:values.map(v=>Math.round(Math.min(1,Math.max(0,v))*10000)/10000),hash});
   }catch(e){reject(e instanceof Error?e:Error('Không thể phân tích ảnh.'));}
   finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}
  };
  img.onerror=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);reject(Error('Không tải được ảnh để đối chiếu. Kiểm tra kết nối và quyền truy cập ảnh trên VPS.'));};
  img.src=objectUrl||thumbCloudinaryUrl(source as string,500);
 });
}
