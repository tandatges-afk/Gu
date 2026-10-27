'use client';
import {useState} from 'react';
import {GuSecureUpload} from './GuSecureUpload';
import {money} from '@/lib/rental';
import styles from './GuOrderPaymentPanel.module.css';
/** Used only when an already-prepaid RESERVED order is changed. Server computes its own price. */
export function GuPrepaidAdjustment({amount,onConfirm,busy,label,hideMethod=false}:{amount:number|null;onConfirm:(payment:{paymentProofId:string;paymentDraftId:string;confirmPaid:true;expectedTopup:number;paymentMethod:'CASH'|'TRANSFER'|'PHOTO_PROOF';paymentReference:string})=>void;busy:boolean;label:string;hideMethod?:boolean}){
 const [draft]=useState(()=>crypto.randomUUID());const [proof,setProof]=useState('');const [confirmed,setConfirmed]=useState(false);
 const [method,setMethod]=useState<'CASH'|'TRANSFER'>('CASH');const [reference,setReference]=useState('');
 if(amount===null)return <p className={styles.warning}>Chưa đủ dữ liệu để tính giá. Tải đầy đủ sản phẩm hoặc kiểm tra giờ thuê.</p>;
 if(amount<=0)return <button type="button" className="btn btn-dark" disabled={busy} onClick={()=>onConfirm({paymentProofId:'',paymentDraftId:draft,confirmPaid:true,expectedTopup:0,paymentMethod:hideMethod?'PHOTO_PROOF':method,paymentReference:hideMethod?'':reference})}>{label} · Không phát sinh tiền</button>;
 return <div className={styles.panel}><b>Đơn đặt trước · Thu bổ sung {money(amount)} trước khi cập nhật</b>
  <p>Chụp bằng chứng tiền đã nhận. Máy chủ sẽ tính lại giá và chỉ lưu đồng thời việc giữ lịch và khoản thu nếu số tiền khớp.</p>
  {!hideMethod&&<label>Phương thức<select className="input" value={method} onChange={e=>setMethod(e.target.value as 'CASH'|'TRANSFER')}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></label>}
  {!hideMethod&&method==='TRANSFER'&&<label>Mã giao dịch<input className="input" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Mã / nội dung chuyển khoản"/></label>}
  <GuSecureUpload purpose="reservation" draftId={draft} onUploaded={id=>{setProof(id);setConfirmed(false);}} label="Chụp tiền mặt / chứng từ chuyển khoản đã nhận"/>
  <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Tôi xác nhận đã thực nhận đủ {money(amount)} tiền thuê bổ sung.</label>
  <button type="button" className="btn btn-dark" disabled={busy||!proof||!confirmed||(method==='TRANSFER'&&reference.trim().length<4)} onClick={()=>onConfirm({paymentProofId:proof,paymentDraftId:draft,confirmPaid:true,expectedTopup:amount,paymentMethod:hideMethod?'PHOTO_PROOF':method,paymentReference:hideMethod?'':reference})}>{label} và lưu khoản thu</button>
 </div>;
}
