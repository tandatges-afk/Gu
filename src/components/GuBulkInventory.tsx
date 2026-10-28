'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AlertCircle,Check,CheckCircle2,CopyPlus,Images,LoaderCircle,Plus,ShieldCheck,Trash2,ChevronDown,ChevronRight,Search} from 'lucide-react';
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
const nameIsReady=(value:string)=>Boolean(value.trim());
const anglesAreReady=(value:string)=>{const angles=value.split(',').map(a=>a.trim()).filter(Boolean);return angles.length>=1&&angles.length<=10&&new Set(angles).size===angles.length&&angles.every(a=>a.length<=70);};

export function GuBulkInventory({api,categories,existingNames,isAdmin,onSaved}:{api:Api;categories:string[];existingNames:string[];isAdmin:boolean;onSaved:()=>Promise<void>}){
 const nextKey=useRef(2);
 const rootRef=useRef<HTMLElement>(null);
 const focusKey=useRef<number|null>(null);
 const [rows,setRows]=useState<Draft[]>([createRow(1)]);
 const [expanded,setExpanded]=useState<Set<number>>(new Set([1]));
 const [rowQuery,setRowQuery]=useState('');
 const [onlyIncomplete,setOnlyIncomplete]=useState(false);
 const [remoteIssues,setRemoteIssues]=useState<ServerIssue[]>([]);
 const [checking,setChecking]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [attempted,setAttempted]=useState(false);
 const [uploading,setUploading]=useState<Set<number>>(new Set());
 const requestId=useRef('');
 const requestVersion=useRef(0);
 const update=(key:number,patch:Partial<Draft>)=>{
  requestVersion.current++;
  requestId.current='';setRemoteIssues([]);setSuccess('');setError('');
  setRows(previous=>previous.map(row=>row.key===key?{...row,...patch}:row));
 };
 const append=(source?:Draft)=>{
  if(rows.length>=MAX_BULK_ITEMS||saving)return;
  const key=nextKey.current++;
  const item=source?{...createRow(key),category:source.category,color:source.color,requiresLaundry:source.requiresLaundry,replacementValue:source.replacementValue,inspectionAngles:source.inspectionAngles,cameraModel:source.cameraModel}:createRow(key);
  requestVersion.current++;requestId.current='';setRemoteIssues([]);setError('');setSuccess('');
  focusKey.current=key;setRowQuery('');setOnlyIncomplete(false);
  setRows(previous=>[...previous,item]);
  setExpanded(new Set([key]));
 };
 const addRow=()=>append();
 const removeRow=(key:number)=>{
  if(rows.length<=1||saving||uploading.size)return;
  requestVersion.current++;requestId.current='';setRemoteIssues([]);setError('');setSuccess('');
  setRows(previous=>previous.filter(row=>row.key!==key));
  setExpanded(previous=>{const next=new Set(previous);next.delete(key);return next;});
 };
 useEffect(()=>{
  if(focusKey.current===null)return;
  const input=rootRef.current?.querySelector<HTMLInputElement>(`[data-bulk-name-key="${focusKey.current}"]`);
  input?.focus();
  focusKey.current=null;
 },[rows.length]);
 const localIssues=validateBulkNames(rows.map(x=>x.name),existingNames);
 // The client-side catalog can be paginated. The server also checks its global name index.
 useEffect(()=>{
  const names=rows.map(row=>row.name.trim());
  if(!names.some(Boolean)){setRemoteIssues([]);setChecking(false);return;}
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
 const errorFor=(row:number)=>issues.find(i=>i.row===row&&(i.code!=='EMPTY'||attempted))?.message;
 const rowComplete=(r:Draft,i:number)=>nameIsReady(r.name)&&!errorFor(i)&&anglesAreReady(r.inspectionAngles)&&Number.isSafeInteger(r.replacementValue)&&r.replacementValue>0;
 const visibleRows=rows.map((r,i)=>({r,i})).filter(({r,i})=>(!onlyIncomplete||!rowComplete(r,i))&&(!rowQuery.trim()||r.name.toLocaleLowerCase('vi-VN').includes(rowQuery.toLocaleLowerCase('vi-VN').trim())||String(i+1)===rowQuery.trim()));
 const readyCount=rows.filter(rowComplete).length;
 const showRowError=(index:number,message:string)=>{setRowQuery('');setOnlyIncomplete(false);setExpanded(new Set([rows[index].key]));setError(`Dòng ${index+1}: ${message}`);};
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setAttempted(true);setError('');setSuccess('');
  if(uploading.size)return setError('Hãy đợi ảnh tải xong trước khi lưu.');
  if(issues.length){showRowError(issues[0].row,issues[0].message);return;}
  const items=rows.map(r=>({name:r.name.trim(),category:r.category,color:r.color.trim(),requiresLaundry:r.requiresLaundry,replacementValue:r.replacementValue,imagePaths:r.imagePaths,inspectionAngles:r.inspectionAngles.split(',').map(x=>x.trim()).filter(Boolean),...(isCameraCategory(r.category)?{cameraModel:r.cameraModel,cameraSerial:r.cameraSerial}:{}),referenceShots:{}}));
  for(let i=0;i<items.length;i++){
   if(!items[i].name)return showRowError(i,'Chưa nhập tên sản phẩm.');
   if(!items[i].inspectionAngles.length||items[i].inspectionAngles.length>10||new Set(items[i].inspectionAngles).size!==items[i].inspectionAngles.length||items[i].inspectionAngles.some(v=>v.length>70))return showRowError(i,'Nhập 1–10 góc chụp khác nhau, tối đa 70 ký tự mỗi góc.');
   if(!Number.isSafeInteger(items[i].replacementValue)||items[i].replacementValue<=0)return showRowError(i,'Nhập giá trị đền bù lớn hơn 0.');
  }
  setSaving(true);
  try{
   if(!requestId.current){
    const check=await api<{issues:ServerIssue[]}>('items/bulk',{method:'POST',body:JSON.stringify({action:'check',names:items.map(x=>x.name)})});
    if(check.issues.length){setRemoteIssues(check.issues);throw new Error(`Dòng ${check.issues[0].row+1}: ${check.issues[0].message}`);}
    requestId.current=crypto.randomUUID();
   }
   const indexEntries=await Promise.all(rows.map(async row=>{
    if(!row.imagePaths[0])return [];
    try{return [{imagePath:row.imagePaths[0],signature:await imageSignature(row.imagePaths[0])}];}
    catch{return [];}
   }));
   const indexedItems=items.map((item,i)=>({...item,visualSignatures:indexEntries[i]}));
   const saved=await api<{created:number;items:{id:string;name:string;hangerCode:string}[]}>('items/bulk',{method:'POST',body:JSON.stringify({action:'save',items:indexedItems,requestId:requestId.current})});
   setSuccess(`Đã lưu ${saved.created} sản phẩm: ${saved.items.map(x=>x.hangerCode).join(', ')}`);
   const key=nextKey.current++;setRows([createRow(key)]);setExpanded(new Set([key]));setRowQuery('');setOnlyIncomplete(false);setRemoteIssues([]);requestId.current='';setAttempted(false);
   try{await onSaved();}catch{setError('Đã lưu sản phẩm nhưng chưa tải lại được danh sách. Hãy chuyển sang Danh sách kho để làm mới.');}
  }catch(e){setError(e instanceof Error?e.message:'Không thể lưu kho. Nếu giao dịch thất bại, không sản phẩm nào được tạo.');}
  finally{setSaving(false);}
 };
 return <section ref={rootRef} className={ui.root} aria-label="Nhập kho nhiều sản phẩm">
  <header className={ui.heading}>
   <div className={ui.headingMain}>
    <span className={ui.kicker}><ShieldCheck size={15}/> NHẬP KHO THÔNG MINH</span>
    <h2>Thêm sản phẩm vào kho</h2>
    <p>Nhập tối đa 100 món/lượt. Mỗi món là một hàng thu gọn; chọn hàng để sửa chi tiết và lọc nhanh các dòng cần bổ sung.</p>
   </div>
   <div className={ui.counter}><strong>{rows.length}<span>/{MAX_BULK_ITEMS}</span></strong><small>Sản phẩm / lượt</small></div>
  </header>
  <div className={ui.progress} role="status" aria-live="polite">
   <div className={ui.progressLeft}><CheckCircle2 size={18}/><span><strong>{readyCount} / {rows.length} món đủ thông tin</strong><small>{checking?'Đang đối chiếu tên với toàn bộ kho…':issues.filter(issue=>issue.code!=='EMPTY'||attempted).length?`${issues.filter(issue=>issue.code!=='EMPTY'||attempted).length} tên cần kiểm tra lại`:'Kiểm tra tên trùng tự động, không phân biệt dấu và chữ hoa'}</small></span></div>
   <div className={ui.progressTrack} aria-hidden="true"><span style={{width:`${rows.length?readyCount/rows.length*100:0}%`}}/></div>
  </div>
  <form onSubmit={e=>void submit(e)}>
   <div className={ui.listTools}>
    <label className={ui.rowSearch}><Search size={16}/><input aria-label="Tìm trong danh sách đang nhập" placeholder="Tìm sản phẩm đang nhập…" value={rowQuery} onChange={e=>setRowQuery(e.target.value)}/></label>
    <label className={ui.problemFilter}><input type="checkbox" checked={onlyIncomplete} onChange={e=>setOnlyIncomplete(e.target.checked)}/> Chỉ xem món cần bổ sung ({rows.length-readyCount})</label>
    <button type="button" className={ui.compactButton} onClick={()=>setExpanded(new Set())}>Thu gọn tất cả</button>
    <span className={ui.rowTotal}>{visibleRows.length}/{rows.length} món</span>
   </div>
   <div className={ui.entries} role="group" aria-label="Danh sách sản phẩm chuẩn bị nhập kho">
    {visibleRows.map(({r,i})=>{
     const nameIssue=errorFor(i);
     const complete=rowComplete(r,i);
     const isOpen=expanded.has(r.key);
     const showRequired=attempted;
     return <article className={`${ui.entry} ${nameIssue?ui.entryError:''}`} key={r.key}>
      <div className={ui.entryTop}>
       <button type="button" aria-expanded={isOpen} aria-label={`${isOpen?'Thu gọn':'Mở chỉnh sửa'} sản phẩm ${i+1}`} className={ui.expandRow} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(next.has(r.key))next.delete(r.key);else next.add(r.key);return next;})}>
        {isOpen?<ChevronDown size={18}/>:<ChevronRight size={18}/>}<span className={ui.entryIndex}>{String(i+1).padStart(2,'0')}</span>
        <span className={ui.entryIdentity}><strong>{r.name.trim()||`Sản phẩm ${i+1}`}</strong><span>{r.category} · {r.replacementValue?`${r.replacementValue.toLocaleString('vi-VN')}đ`:'Chưa có giá trị đền bù'} · {r.inspectionAngles.trim()?'Đã nhập góc chụp':'Chưa có góc chụp'}</span></span>
       </button>
       <span className={`${ui.entryStatus} ${complete?ui.statusReady:''}`}>{complete?<><Check size={14}/> Đủ thông tin</>:'Đang nhập'}</span>
       <div className={ui.entryActions}>
        <button type="button" className={ui.iconAction} title="Thêm món tương tự (sao chép danh mục, màu, giá và góc chụp; không sao chép ảnh)" aria-label={`Thêm sản phẩm tương tự dòng ${i+1}`} disabled={rows.length>=MAX_BULK_ITEMS||saving} onClick={()=>append(r)}><CopyPlus size={17}/><span>Nhân bản thiết lập</span></button>
        <button type="button" className={`${ui.iconAction} ${ui.deleteAction}`} title="Xóa dòng" aria-label={`Bỏ sản phẩm dòng ${i+1}`} disabled={rows.length===1||saving||uploading.size>0} onClick={()=>removeRow(r.key)}><Trash2 size={17}/></button>
       </div>
      </div>
      {isOpen&&<>
      <div className={ui.fields}>
       <label className={`${ui.field} ${ui.nameField}`}><span className={ui.fieldTitle}>Tên sản phẩm <b>*</b></span><input data-bulk-name-key={r.key} className="input" required maxLength={120} aria-invalid={Boolean(nameIssue)} placeholder="Ví dụ: Váy hoa cổ vuông" value={r.name} onChange={e=>update(r.key,{name:e.target.value})}/>{nameIssue&&<small className={ui.invalid} role="alert"><AlertCircle size={13}/>{nameIssue}</small>}{showRequired&&!r.name.trim()&&<small className={ui.invalid}>Hãy nhập tên sản phẩm.</small>}</label>
       <label className={`${ui.field} ${ui.categoryField}`}><span className={ui.fieldTitle}>Danh mục</span><select className="input" value={r.category} onChange={e=>{const category=e.target.value;update(r.key,{category,requiresLaundry:!isNonLaundryCategory(category)})}}>{categorySelectOptions(categories,r.category).filter(x=>isAdmin||!isCameraCategory(x)).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
       <label className={`${ui.field} ${ui.colorField}`}><span className={ui.fieldTitle}>Màu sắc</span><input className="input" maxLength={40} value={r.color} onChange={e=>update(r.key,{color:e.target.value})} placeholder="Không bắt buộc"/></label>
       <label className={`${ui.field} ${ui.priceField}`}><span className={ui.fieldTitle}>Giá trị đền bù <b>*</b></span><GuMoneyInput required className="input" maxLength={17} value={r.replacementValue||''} placeholder="Nhập số tiền" onValueChange={raw=>update(r.key,{replacementValue:Number(raw)})}/>{showRequired&&r.replacementValue<=0&&<small className={ui.invalid}>Nhập giá trị lớn hơn 0.</small>}</label>
       <div className={`${ui.field} ${ui.angleField}`}><label htmlFor={`bulk-angle-${r.key}`} className={ui.fieldTitle}>Góc chụp giao / nhận <b>*</b></label><div className={ui.angleControl}><input id={`bulk-angle-${r.key}`} className="input" maxLength={700} value={r.inspectionAngles} placeholder="Ví dụ: Mặt trước, Mặt sau" onChange={e=>update(r.key,{inspectionAngles:e.target.value})}/><div className={ui.anglePresets}><button type="button" disabled={saving} onClick={()=>update(r.key,{inspectionAngles:'Mặt trước, Mặt sau'})}>Trước + sau</button><button type="button" disabled={saving} onClick={()=>update(r.key,{inspectionAngles:'Mặt trước, Mặt sau, Tem sản phẩm'})}>+ Tem</button></div></div>{showRequired&&!anglesAreReady(r.inspectionAngles)&&<small className={ui.invalid}>Nhập 1–10 góc chụp không trùng.</small>}</div>
       <label className={`${ui.laundry} ${ui.field}`}><span className={ui.fieldTitle}>Sau khi trả</span><span className={ui.laundryChoice}><input type="checkbox" disabled={isNonLaundryCategory(r.category)} checked={r.requiresLaundry} onChange={e=>update(r.key,{requiresLaundry:e.target.checked})}/><span>Cần giặt</span></span></label>
      </div>
      {isCameraCategory(r.category)&&<div className={ui.cameraFields}><label className={ui.field}><span className={ui.fieldTitle}>Mẫu máy</span><select className="input" value={r.cameraModel} onChange={e=>update(r.key,{cameraModel:e.target.value})}><option>Canon EOS R50</option><option>Canon M50</option></select></label><label className={ui.field}><span className={ui.fieldTitle}>Serial</span><input className="input" value={r.cameraSerial} onChange={e=>update(r.key,{cameraSerial:e.target.value.toUpperCase()})} placeholder="Số serial"/></label></div>}
      <details className={ui.details}><summary><span className={ui.photosTitle}><Images size={17}/> Hình ảnh sản phẩm <small>{r.imagePaths.length?`${r.imagePaths.length}/5 ảnh`:'Bổ sung nếu có'}</small></span><span className={ui.expandHint}>Mở để tải ảnh</span></summary><div className={ui.photos}><ImageUploader paths={r.imagePaths} disabled={saving} onChange={paths=>update(r.key,{imagePaths:paths})} onUploading={v=>setUploading(s=>{const n=new Set(s);if(v)n.add(r.key);else n.delete(r.key);return n;})}/></div></details>
      </>}
     </article>;
    })}
   </div>
   {visibleRows.length===0&&<p className={ui.emptyList}>Không có dòng phù hợp. Tắt bộ lọc để xem tất cả sản phẩm đang nhập.</p>}
   <div className={ui.toolbar}>
    <button type="button" className={ui.addButton} onClick={addRow} disabled={rows.length>=MAX_BULK_ITEMS||saving}><Plus size={19}/> Thêm dòng sản phẩm</button>
    <div className={ui.saveArea}><span className={ui.hint}>{uploading.size?'Đang tải ảnh…':checking?'Đang kiểm tra tên…':`${rows.length} món sẽ được lưu cùng một lần`}</span><button className="btn btn-dark" type="submit" disabled={saving||uploading.size>0||checking||issues.some(issue=>issue.code!=='EMPTY')}>{saving?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>} {saving?'Đang lưu…':`Lưu ${rows.length} sản phẩm`}</button></div>
   </div>
   {error&&<p className="inline-alert danger-alert" role="alert"><AlertCircle size={17}/>{error}</p>}
   {success&&<p className="inline-alert success-alert" role="status"><CheckCircle2 size={17}/>{success}</p>}
  </form>
 </section>;
}
