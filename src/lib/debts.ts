import type {RentalOrder, OrderStatus} from './types';

export type DebtOrder = {
  id:string; code:string; customerId:string; customerName:string; customerPhone:string;
  status:OrderStatus; pickupDate:string; returnDate:string;
  amount:number; paid:number; outstanding:number; cameraLateFeePending?:boolean;
};
export type DebtAccount = {
  key:string; customerId:string; customerName:string; customerPhone:string;
  outstanding:number; orderCount:number; orders:DebtOrder[];
};
export type DebtSummary = {cursor?:string|null;hasMore?:boolean;pageSize?:number;pageNote?:string;accounts:DebtAccount[]; totalOutstanding:number; unpaidOrders:number; futureReservations:number; reservationUnpaid:number; pendingCameraLateCount?:number};
const number=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,x):0;
const accountKey=(o:RentalOrder)=>{const phone=(o.customerPhone||'').replace(/\D/g,'');return o.customerId || (phone?'phone:'+phone:'order:'+o.id);};

/**
 * Actual receivables start only when the customer receives the goods.
 * RESERVED is an uncollected future booking, not a customer debt.
 * Use order snapshots so historic receipts remain attributable after a customer edit.
 */
export function buildDebtSummary(orders:readonly RentalOrder[]):DebtSummary {
  const accounts=new Map<string,DebtAccount>();
  let futureReservations=0, reservationUnpaid=0, unpaidOrders=0, totalOutstanding=0, pendingCameraLateCount=0;
  for(const order of orders){
    if(order.status==='CANCELLED')continue;
    const amount=number(order.total)+number(order.compensationTotal)+number(order.lateFeeTotal)+number(order.otherFeeTotal);
    const paid=number(order.paid);
    const outstanding=Math.max(0,amount-paid);
    if(order.status==='RESERVED'){
      if(outstanding>0){futureReservations++;reservationUnpaid+=outstanding;}
      continue;
    }
    if(order.status!=='PICKED_UP'&&order.status!=='RETURNED')continue;
    if(outstanding<=0&&!order.cameraLateFeePending)continue;
    if(order.cameraLateFeePending)pendingCameraLateCount++;
    const key=accountKey(order);
    const record:DebtOrder={id:order.id,code:order.code,customerId:order.customerId,
      customerName:order.customerName||'Khách chưa có tên',customerPhone:order.customerPhone||'',
      status:order.status,pickupDate:order.pickupDate,returnDate:order.returnDate,
      amount,paid,outstanding,cameraLateFeePending:Boolean(order.cameraLateFeePending)};
    let account=accounts.get(key);
    if(!account){
      account={key,customerId:order.customerId,customerName:record.customerName,
        customerPhone:record.customerPhone,outstanding:0,orderCount:0,orders:[]};
      accounts.set(key,account);
    }
    account.outstanding+=outstanding;
    account.orderCount++;
    account.orders.push(record);
    unpaidOrders++;
    totalOutstanding+=outstanding;
  }
  const sorted=[...accounts.values()].sort((a,b)=>b.outstanding-a.outstanding||a.customerName.localeCompare(b.customerName,'vi'));
  for(const account of sorted)account.orders.sort((a,b)=>b.returnDate.localeCompare(a.returnDate));
  return {accounts:sorted,totalOutstanding,unpaidOrders,futureReservations,reservationUnpaid,pendingCameraLateCount};
}
