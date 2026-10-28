/** Present true persisted amounts only; never infer an extra charge from overpayment. */
export function paymentReview(order:{total:number;paid:number;otherFeeTotal?:number;compensationTotal?:number;lateFeeTotal?:number;cameraOvertimeFeeTotal?:number}){
 const includedOvertime=Math.max(0,order.cameraOvertimeFeeTotal||0);
 const rent=Math.max(0,order.total-includedOvertime);
 const extra=Math.max(0,order.otherFeeTotal||0)+Math.max(0,order.compensationTotal||0)+Math.max(0,order.lateFeeTotal||0)+includedOvertime;
 const amountDue=order.total+Math.max(0,order.otherFeeTotal||0)+Math.max(0,order.compensationTotal||0)+Math.max(0,order.lateFeeTotal||0);
 return {rent,extra,amountDue,overpaid:Math.max(0,order.paid-amountDue)};
}
