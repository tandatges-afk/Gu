'use client';
import {useRef,useState} from 'react';
import {Wallet,CheckCircle2} from 'lucide-react';
import type {RentalOrder} from '@/lib/types';
import {money} from '@/lib/rental';
import {GuMoneyInput} from './GuMoneyInput';
import type {ApiCall} from './GuExtras';
import styles from './GuOrderPaymentPanel.module.css';
export function GuOrderPaymentPanel({order,api,onPaid}:{order:RentalOrder;api:ApiCall;onPaid:()=>Promise<void>}){
 const due=Math.max(0,order.total+(order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0)-order.paid);
 const surplus=Math.max(0,order.paid-order.total-(order.compensationTotal||0)-(order.otherFeeTotal||0)-(order.lateFeeTotal||0));
 const [custom,setCustom]=useState('');const [method,setMethod]=useState<'CASH'|'TRANSFER'>('CASH');
 const [reference,setReference]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 // Retain the same UUID if a network request fails ambiguously; retry is idempotent.
 const pending=useRef<{requestId:string;amount:number}|null>(null);
 const collect=async(amount:number)=>{
  if(busy||!Number.isSafeInteger(amount)||amount<=0||amount>due)return;
  if(method==='TRANSFER'&&reference.trim().length<4){setError('Cần nhập mã giao dịch chuyển khoản.');return;}
  setBusy(true);setError('');
  const key=pending.current?.amount===amount?pending.current:{requestId:crypto.randomUUID(),amount};pending.current=key;
  try{
   await api('v5/orders/'+order.id,{method:'PATCH',body:JSON.stringify({action:'PAY',amount,method,reference,requestId:key.requestId})});
   pending.current=null;setCustom('');await onPaid();
  }catch(e){setError(e instanceof Error?e.message:'Không lưu được tiền đã thu.');}
  finally{setBusy(false);}
 };
 return <section className={styles.panel} aria-label="Thu tiền đơn thuê">
  <div className={styles.heading}><Wallet size={20}/><strong>Đối soát và thu tiền</strong></div>
  <div className={styles.metrics}><span>Tiền thuê <b>{money(order.total)}</b></span><span>Phụ thu/đền bù <b>{money((order.compensationTotal||0)+(order.otherFeeTotal||0)+(order.lateFeeTotal||0))}</b></span><span>Đã nhận ròng <b>{money(order.paid)}</b></span></div>
  {due>0?<><div className={styles.remaining}>Còn cần thu <strong>{money(due)}</strong></div>
   <div className={styles.fields}><label>Phương thức<select className="input" value={method} onChange={e=>{setMethod(e.target.value as 'CASH'|'TRANSFER');pending.current=null;}}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></label>
    {method==='TRANSFER'&&<label>Mã / nội dung chuyển khoản<input className="input" value={reference} onChange={e=>{setReference(e.target.value);pending.current=null;}} placeholder="Mã giao dịch ngân hàng"/></label>}</div>
   <div className={styles.actions}><GuMoneyInput className="input" placeholder="Nhập số tiền khác (nếu cần)" value={custom} onValueChange={v=>{setCustom(v);pending.current=null;}}/>
    <button type="button" className="btn btn-white" disabled={busy||!Number(custom)||Number(custom)>due} onClick={()=>void collect(Number(custom))}>Thu số khác</button>
    <button type="button" className="btn btn-dark" disabled={busy} onClick={()=>void collect(due)}>{busy?'Đang lưu…':`Thu đủ ${money(due)}`}</button></div>
   </>:surplus>0?<p className={styles.warning}>Thu dư {money(surplus)}. Admin cần xác minh và hoàn tiền, không tự ghi là phụ thu.</p>:<p className={styles.success}><CheckCircle2 size={17}/> Đã thu đủ theo đơn hiện tại, không cần thu lại.</p>}
  {error&&<p className={styles.warning} role="alert">{error}</p>}
 </section>;
}
