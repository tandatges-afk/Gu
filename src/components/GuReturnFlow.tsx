'use client';

import {useState} from 'react';
import {ArrowLeft, CheckCircle2, ClipboardCheck, Plus, Wallet} from 'lucide-react';
import {money} from '@/lib/rental';
import {GuMoneyInput} from '@/components/GuMoneyInput';
import {previewReturnSettlement, type ReturnChoice} from '@/lib/return-settlement';
import type {InventoryItem, RentalOrder} from '@/lib/types';

type ReturnPayload={
  inspection:{itemId:string;status:'OK'|'MISSING'}[];
  otherFeeTotal:number;
  surchargeNote:string;
  collectRemainingAtReturn:boolean;
};

export function GuReturnFlow({order,items,today,busy,onSubmit}:{
  order:RentalOrder;
  items:InventoryItem[];
  today:string;
  busy:boolean;
  onSubmit:(payload:ReturnPayload)=>Promise<boolean>;
}) {
  const [stage,setStage]=useState<'check'|'settle'>('check');
  const [checks,setChecks]=useState<Record<string,ReturnChoice>>({});
  const [showExtra,setShowExtra]=useState(false);
  const [extraText,setExtraText]=useState('');
  const [extraReason,setExtraReason]=useState('');
  const [collected,setCollected]=useState(false);
  const extraNumber=extraText.trim()?Number(extraText):0;
  const extraValid=Number.isSafeInteger(extraNumber)&&extraNumber>=0&&extraNumber<=1_000_000_000;
  const replacementValues=Object.fromEntries(items.map(i=>[i.id,i.replacementValue]));
  const estimate=previewReturnSettlement({
    lines:order.lines,returnDate:order.returnDate,actualDate:today,
    rentalTotal:order.total,alreadyPaid:order.paid,checks,replacementValues,
    otherFee:extraValid?extraNumber:0,
  });
  const hasUnpriced=estimate.unresolved.length>0;
  const validExtras=extraValid&&(extraNumber===0||extraReason.trim().length>0)&&extraReason.trim().length<=300;

  const submit=async()=>{
    if(!estimate.complete||hasUnpriced||!validExtras||busy)return;
    await onSubmit({
      inspection:order.lines.map(l=>({itemId:l.itemId,status:checks[l.itemId] as 'OK'|'MISSING'})),
      otherFeeTotal:extraNumber,surchargeNote:extraNumber>0?extraReason.trim():'',
      collectRemainingAtReturn:collected&&estimate.remaining>0,
    });
  };

  return <section className="gu-return-flow" aria-label="Quy trình nhận trả đồ">
    <div className="gu-return-heading">
      <ClipboardCheck size={20}/>
      <div><strong>Nhận trả đồ</strong><small>{stage==='check'?'Bước 1/2 · Kiểm tra đủ / thiếu từng món':'Bước 2/2 · Xem tiền hệ thống tính tự động'}</small></div>
    </div>
    {stage==='check'?<>

      <div className="gu-return-progress">Đã kiểm <b>{estimate.verified}/{order.lines.length}</b> món</div>
      {order.lines.map(line=><div className="gu-return-item" key={line.itemId}>
        <div className="gu-return-item-title">
          <strong>{line.name}</strong>
          <small>Mã sản phẩm: {items.find(i=>i.id===line.itemId)?.hangerCode||line.hangerCode||'Chưa cấp mã'}</small>
        </div>
        <div className="gu-return-choices" role="group" aria-label={'Kiểm nhận '+line.name}>
          <button type="button" className={'gu-return-choice '+(checks[line.itemId]==='OK'?'is-ok':'')} aria-pressed={checks[line.itemId]==='OK'} onClick={()=>setChecks(v=>({...v,[line.itemId]:'OK'}))}>Đã nhận đủ</button>
          <button type="button" className={'gu-return-choice '+(checks[line.itemId]==='MISSING'?'is-missing':'')} aria-pressed={checks[line.itemId]==='MISSING'} onClick={()=>setChecks(v=>({...v,[line.itemId]:'MISSING'}))}>Thiếu đồ</button>
        </div>
      </div>)}
      {hasUnpriced&&<p className="gu-return-error">Có đồ thiếu chưa được Admin định giá đền bù. Cần Admin cập nhật giá trước khi hoàn tất.</p>}
      <div className="gu-return-actions">
        <button type="button" className="btn btn-dark" disabled={!estimate.complete||hasUnpriced||busy} onClick={()=>setStage('settle')}>Tiếp tục · Xem tiền <span aria-hidden="true">→</span></button>
      </div>
    </>:<>
      <div className="gu-return-summary" aria-live="polite">
        <div><span>Giá thuê theo đơn</span><strong>{money(order.total)}</strong></div>
        <div><span>Trả trễ ({estimate.days} ngày)</span><strong>{money(estimate.lateFee)}</strong></div>
        {estimate.compensation>0&&<div><span>Đền bù ({estimate.missingCount} món thiếu)</span><strong>{money(estimate.compensation)}</strong></div>}
        {estimate.otherFee>0&&<div><span>Phụ phí khác</span><strong>{money(estimate.otherFee)}</strong></div>}
        <div><span>Đã thanh toán</span><strong>− {money(order.paid)}</strong></div>
        <div className="gu-return-total"><span>Còn phải thu</span><strong>{money(estimate.remaining)}</strong></div>
      </div>

      {!showExtra?<button className="gu-return-add-fee" type="button" onClick={()=>setShowExtra(true)}><Plus size={15}/> Thêm phụ phí khác (nếu có)</button>:<div className="gu-return-extras">
        <label className="form-field"><span>Phụ phí khác (VND)</span><GuMoneyInput className="input" maxLength={17} placeholder="Để trống nếu không có" value={extraText} onValueChange={raw=>{setExtraText(raw);setCollected(false);}}/></label>
        {extraNumber>0&&<label className="form-field"><span>Lý do phụ phí</span><input className="input" maxLength={300} placeholder="Ví dụ: vệ sinh đặc biệt, hỏng phụ kiện…" value={extraReason} onChange={e=>setExtraReason(e.target.value)}/></label>}
        <button className="gu-return-add-fee" type="button" onClick={()=>{setShowExtra(false);setExtraText('');setExtraReason('');}}>Bỏ phụ phí khác</button>
        {!validExtras&&<p className="gu-return-error">Nhập số tiền hợp lệ và lý do khi có phụ phí khác.</p>}
      </div>}
      {estimate.remaining>0?<label className="gu-return-collect"><input type="checkbox" checked={collected} onChange={e=>setCollected(e.target.checked)}/><span><strong>Đã thực nhận đủ {money(estimate.remaining)}</strong><small>Chỉ đánh dấu khi cửa hàng đã nhận tiền. Nếu không, GU giữ lại công nợ để Admin xử lý.</small></span></label>:<p className="gu-return-paid"><CheckCircle2 size={17}/> Đơn đã được thanh toán đủ.</p>}
      <div className="gu-return-actions">
        <button type="button" className="btn btn-white" onClick={()=>{setStage('check');setCollected(false);}} disabled={busy}><ArrowLeft size={16}/> Sửa kiểm nhận</button>
        <button type="button" className="btn btn-dark" disabled={busy||!validExtras} onClick={()=>void submit()}><Wallet size={16}/> {busy?'Đang lưu…':'Hoàn tất nhận trả'}</button>
      </div>

    </>}
  </section>;
}
