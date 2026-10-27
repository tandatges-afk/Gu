import type {RentalOrder} from './types';
import {CLOTHING_SETTLEMENT_VERSION} from './clothing-collateral.ts';
/** Cash held for an active clothing rental covers an equal part of rent; it is not customer receivable. */
export function collectibleRentDue(o:RentalOrder):number{
 const security=o.settlementPolicyVersion===CLOTHING_SETTLEMENT_VERSION&&!o.collateralReturnedAt?(o.handoverCashCollateralAmount||0):0;
 return Math.max(0,(o.total||0)+(o.compensationTotal||0)+(o.lateFeeTotal||0)+(o.otherFeeTotal||0)-(o.paid||0)-security);
}
import type {Transaction,Firestore} from '@/lib/pg-firestore';
import type {DebtAccount} from './debts';
/** Only open receivables and future bookings are indexed. Historical paid orders are not re-scanned. */
export function debtIndexKind(o:RentalOrder):'open'|'reserved'|null{
 if(o.status==='CANCELLED'||o.status==='VOIDED')return null;
 const outstanding=collectibleRentDue(o);
 if(outstanding<=0&&!o.cameraLateFeePending)return null;
 return o.status==='RESERVED'?'reserved':o.status==='PICKED_UP'||o.status==='RETURNED'?'open':null;
}
export function debtIndexRecord(o:RentalOrder){
 const kind=debtIndexKind(o);
 const balance=collectibleRentDue(o);
 return {kind,orderId:o.id,customerId:o.customerId,customerName:o.customerName,customerPhone:o.customerPhone,
   code:o.code,status:o.status,pickupDate:o.pickupDate,returnDate:o.returnDate,
   amount:balance+(o.paid||0),paid:o.paid||0,outstanding:balance,cameraLateFeePending:Boolean(o.cameraLateFeePending),updatedAt:o.updatedAt||o.createdAt||''};
}
export function syncDebtIndex(tx:Transaction,store:Firestore,o:RentalOrder){
 const ref=store.collection('debtLedger').doc(o.id);
 if(!debtIndexKind(o)){tx.delete(ref);return;}
 tx.set(ref,debtIndexRecord(o));
}
export function summaryFromDebtIndex(rows:readonly ReturnType<typeof debtIndexRecord>[]){
 const accounts=new Map<string,DebtAccount>();
 let totalOutstanding=0,unpaidOrders=0,futureReservations=0,reservationUnpaid=0,pendingCameraLateCount=0;
 for(const r of rows){
   if(!r.kind)continue;
   if(r.kind==='reserved'){futureReservations++;reservationUnpaid+=r.outstanding;continue;}
   const key=r.customerId||'phone:'+r.customerPhone.replace(/\D/g,'');
   if(r.cameraLateFeePending)pendingCameraLateCount++;
   const item={id:r.orderId,code:r.code,customerId:r.customerId,customerName:r.customerName,customerPhone:r.customerPhone,cameraLateFeePending:Boolean(r.cameraLateFeePending),
     status:r.status,pickupDate:r.pickupDate,returnDate:r.returnDate,amount:r.amount,paid:r.paid,outstanding:r.outstanding};
   let account=accounts.get(key);
   if(!account){account={key,customerId:r.customerId,customerName:r.customerName,customerPhone:r.customerPhone,outstanding:0,orderCount:0,orders:[]};accounts.set(key,account);}
   account.orders.push(item);account.outstanding+=r.outstanding;account.orderCount++;
   totalOutstanding+=r.outstanding;unpaidOrders++;
 }
 const sorted=[...accounts.values()].sort((a,b)=>b.outstanding-a.outstanding||a.customerName.localeCompare(b.customerName,'vi'));
 for(const account of sorted)account.orders.sort((a,b)=>b.returnDate.localeCompare(a.returnDate));
 return {accounts:sorted,totalOutstanding,unpaidOrders,futureReservations,reservationUnpaid,pendingCameraLateCount};
}
