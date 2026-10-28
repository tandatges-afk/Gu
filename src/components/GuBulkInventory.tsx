'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Check,Plus,Trash2} from 'lucide-react';
import {ImageUploader} from '@/components/GuExtras';
import {imageSignature} from '@/lib/visual-image';
import {GuMoneyInput} from '@/components/GuMoneyInput';
import {categorySelectOptions,isNonLaundryCategory} from '@/lib/product-policies';
import {isCameraCategory} from '@/lib/camera-rental';
import {MAX_BULK_ITEMS,validateBulkNames} from '@/lib/bulk-inventory-rules';
import ui from './GuBulkInventory.module.css';

type Api=<T=unknown>(path:string,init?:RequestInit)=>Promise<T>;
type Draft={key:number;name:string;category:string;color:string;requiresLaundry:boolean;replacementValue:number;imagePaths:string[];inspectionAngles:string;cameraModel:string;cameraSerial:string};
type ServerIssue={row:number;code:string;message:string};
const createRow=(key:number):Draft=>({key,name:'',category:'Phụ kiện',color:'',requiresLaundry:false,replacementValue:0,imagePaths:[],inspectionAngles:'',cameraModel:'Canon EOS R50',cameraSerial:''});
export function GuBulkInventory({api,categories,existingNames,isAdmin,onSaved}:{api:Api;categories:string[];existingNames:string[];isAdmin:boolean;onSaved:()=>Promise<void>}){
 const nextKey=useRef(2);
 const [rows,setRows]=useState<Draft[]>([createRow(1)]);
 const [remoteIssues,setRemoteIssues]=useState<ServerIssue[]>([]);
 const [checking,setChecking]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [uploading,setUploading]=useState<Set<number>>(new Set());
 const requestId=useRef('');
 const requestVersion=useRef(0);
 const update=(key:number,patch:Partial<Draft>)=>{
  requestVersion.current++;
  requestId.current='';setRemoteIssues([]);setSuccess('');setError('');
  setRows(previous=>previous.map(row=>row.key===key?{...row,...patch}:row));
 };
 const addRow=()=>{if(rows.length>=MAX_BULK_ITEMS)return;requestId.current='';setRemoteIssues([]);setSuccess('');setRows(r=>[...r,createRow(nextKey.current++)]);};
 const removeRow=(key:number)=>{if(rows.length<=1||uploading.size)return;requestId.current='';setRemoteIssues([]);setRows(r=>r.filter(row=>row.key!==key));};
 const localIssues=validateBulkNames(rows.map(x=>x.name),existingNames);
 // Never trust catalog pagination for uniqueness: use the productNameIndex on the server.
 useEffect(()=>{
  const names=rows.map(row=>row.name.trim());
  if(!names.some(Boolean)){setRemoteIssues([]);return;}
  const version=++requestVersion.current;
  const timer=setTimeout(async()=>{
   setChecking(true);
   try{
    const result=await api<{issues:ServerIssue[]}>('items/bulk',{method:'POST',body:JSON.stringify({action:'check',names})});
    if(version===requestVersion.current)setRemoteIssues(result.issues);
   }catch(e){if(version===requestVersion.current)setError(e instanceof Error?e.message:'Không kiểm tra được tên trong kho.');}
   finally{if(version===requestVersion.current)setChecking(false);}
  },650);
  return()=>clearTimeout(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[rows.map(r=>r.name).join('\u0000')]);
 const issues=[...localIssues,...remoteIssues];
 const errorFor=(row:number)=>issues.find(i=>i.row===row)?.message;
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setError('');setSuccess('');
  if(uploading.size)return setError('Chờ ảnh tải xong trước khi lưu.');
  if(issues.length){setError(`Dòng ${issues[0].row+1}: ${issues[0].message}`);return;}
  const items=rows.map(r=>({name:r.name.trim(),category:r.category,color:r.color.trim(),requiresLaundry:r.requiresLaundry,replacementValue:r.replacementValue,imagePaths:r.imagePaths,inspectionAngles:r.inspectionAngles.split(',').map(x=>x.trim()).filter(Boolean),...(isCameraCategory(r.category)?{cameraModel:r.cameraModel,cameraSerial:r.cameraSerial}:{}),referenceShots:{}}));
  for(let i=0;i<items.length;i++){
   if(!items[i].inspectionAngles.length||items[i].inspectionAngles.length>10||new Set(items[i].inspectionAngles).size!==items[i].inspectionAngles.length||items[i].inspectionAngles.some(v=>v.length>70))return setError(`Dòng ${i+1}: nhập 1–10 góc chụp khác nhau, tối đa 70 ký tự mỗi góc.`);
   if(!Number.isSafeInteger(items[i].replacementValue)||items[i].replacementValue<=0)return setError(`Dòng ${i+1}: nhập giá trị đền bù lớn hơn 0.`);
  }
  setSaving(true);
  try{
   if(!requestId.current){
    const check=await api<{issues:ServerIssue[]}>('items/bulk',{method:'POST',body:JSON.stringify({action:'check',names:items.map(x=>x.name)})});
    if(check.issues.length){setRemoteIssues(check.issues);throw new Error(`Dòng ${check.issues[0].row+1}: ${check.issues[0].message}`);}
    requestId.current=crypto.randomUUID();
   }
   // Index the cover photo for the existing visual-search workflow, without failing stock entry if canvas is unavailable.
   const indexEntries=await Promise.all(rows.map(async row=>{
    if(!row.imagePaths[0])return [];
    try{return [{imagePath:row.imagePaths[0],signature:await imageSignature(row.imagePaths[0])}];}
    catch{return [];}
   }));
   const indexedItems=items.map((item,i)=>({...item,visualSignatures:indexEntries[i]}));
   const saved=await api<{created:number;items:{id:string;name:string;hangerCode:string}[]}>('items/bulk',{method:'POST',body:JSON.stringify({action:'save',items:indexedItems,requestId:requestId.current})});
   setSuccess(`Đã lưu ${saved.created} sản phẩm: ${saved.items.map(x=>x.hangerCode).join(', ')}`);
   setRows([createRow(nextKey.current++)]);setRemoteIssues([]);requestId.current='';
   try{await onSaved();}catch{setError("Đã lưu sản phẩm nhưng không tải lại được danh sách kho. Hãy bấm vào Danh sách kho để làm mới.");}
  }catch(e){setError(e instanceof Error?e.message:'Lỗi lưu kho. Không có sản phẩm nào được lưu nếu giao dịch thất bại.');}
  finally{setSaving(false);}
 };
 return <section className={ui.root} aria-label="Nhập kho nhiều sản phẩm">
  <div className={ui.heading}><div><h2>Nhập kho hàng loạt</h2><p>Mỗi sản phẩm một dòng. Thêm tối đa {MAX_BULK_ITEMS} món/lần, lưu chung một giao dịch — nếu một món bị trùng tên, không món nào được tạo.</p></div><span>{rows.length}/{MAX_BULK_ITEMS} món</span></div>
  <form onSubmit={e=>void submit(e)}>
  <div className={ui.horizontal}>
   <div className={ui.table} role="group" aria-label="Danh sách sản phẩm chuẩn bị nhập kho">
    <div className={ui.labels} aria-hidden="true"><span>STT</span><span>Tên sản phẩm</span><span>Danh mục</span><span>Màu sắc</span><span>Giá trị đền bù</span><span>Giặt</span><span>Thao tác</span></div>
    {rows.map((r,i)=><div className={ui.rowGroup} key={r.key}>
     <div className={ui.row}>
      <span className={ui.number}>{i+1}</span>
      <label className={ui.cell}><span className={ui.mobileLabel}>Tên sản phẩm</span><input className="input" required maxLength={120} aria-invalid={Boolean(errorFor(i))} placeholder="Ví dụ: Váy đen đính hoa" value={r.name} onChange={e=>update(r.key,{name:e.target.value})}/>{errorFor(i)&&<small className={ui.invalid} role="alert">{errorFor(i)}</small>}</label>
      <label className={ui.cell}><span className={ui.mobileLabel}>Danh mục</span><select className="input" value={r.category} onChange={e=>{const category=e.target.value;update(r.key,{category,requiresLaundry:!isNonLaundryCategory(category)})}}>{categorySelectOptions(categories,r.category).filter(x=>isAdmin||!isCameraCategory(x)).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className={ui.cell}><span className={ui.mobileLabel}>Màu sắc</span><input className="input" maxLength={40} value={r.color} onChange={e=>update(r.key,{color:e.target.value})} placeholder="Màu sắc"/></label>
      <label className={ui.cell}><span className={ui.mobileLabel}>Giá trị đền bù</span><GuMoneyInput required className="input" maxLength={17} value={r.replacementValue||''} placeholder="0" onValueChange={raw=>update(r.key,{replacementValue:Number(raw)})}/></label>
      <label className={ui.laundry}><input type="checkbox" disabled={isNonLaundryCategory(r.category)} checked={r.requiresLaundry} onChange={e=>update(r.key,{requiresLaundry:e.target.checked})}/><span className={ui.mobileLabel}>Cần giặt</span></label>
      <button type="button" className="icon-btn" title="Bỏ dòng" aria-label={`Bỏ sản phẩm dòng ${i+1}`} disabled={rows.length===1||saving||uploading.size>0} onClick={()=>removeRow(r.key)}><Trash2 size={17}/></button>
     </div>
     <details className={ui.details}><summary>Ảnh, góc chụp{r.imagePaths.length?` · ${r.imagePaths.length} ảnh`:''}{r.inspectionAngles.trim()?' · đã nhập góc chụp':''}</summary>
      <div className={ui.detailsGrid}>
       <label className={ui.cell}>Các góc chụp giao/nhận (cách nhau bằng dấu phẩy)<input className="input" maxLength={700} value={r.inspectionAngles} placeholder="Mặt trước, Mặt sau, Tem sản phẩm" onChange={e=>update(r.key,{inspectionAngles:e.target.value})}/></label>
       {isCameraCategory(r.category)&&<><label className={ui.cell}>Mẫu máy<select className="input" value={r.cameraModel} onChange={e=>update(r.key,{cameraModel:e.target.value})}><option>Canon EOS R50</option><option>Canon M50</option></select></label><label className={ui.cell}>Serial<input className="input" value={r.cameraSerial} onChange={e=>update(r.key,{cameraSerial:e.target.value.toUpperCase()})}/></label></>}
       <div className={ui.photos}><strong>Ảnh sản phẩm (tối đa 5)</strong><ImageUploader paths={r.imagePaths} disabled={saving} onChange={paths=>update(r.key,{imagePaths:paths})} onUploading={v=>setUploading(s=>{const n=new Set(s);if(v)n.add(r.key);else n.delete(r.key);return n;})}/></div>
      </div>
     </details>
    </div>)}
   </div>
  </div>
  <div className={ui.toolbar}><button type="button" className="btn btn-white" onClick={addRow} disabled={rows.length>=MAX_BULK_ITEMS||saving}><Plus size={17}/> Thêm dòng</button><span className={ui.hint}>{checking?'Đang kiểm tra tên với kho…':'Tên được kiểm tra không phân biệt dấu và chữ hoa/thường.'}</span><button className="btn btn-dark" type="submit" disabled={saving||uploading.size>0||checking||issues.length>0}><Check size={17}/>{saving?'Đang lưu…':`Lưu ${rows.length} sản phẩm`}</button></div>
  {error&&<p className="inline-alert danger-alert" role="alert">{error}</p>}
  {success&&<p className="inline-alert" role="status">{success}</p>}
  </form>
 </section>;
}
