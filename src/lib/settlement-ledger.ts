/** Expected charge and refund on return: paid is NET collected, not gross turnover. */
export function returnReconciliation(input:{rent:number;compensation:number;otherFee:number;netPaid:number}){
 const values=Object.values(input);
 if(values.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Số tiền đối soát không hợp lệ.');
 const due=input.rent+input.compensation+input.otherFee;
 if(!Number.isSafeInteger(due))throw Error('Tổng tiền quá lớn.');
 const refund=Math.max(0,input.netPaid-due);
 return {due,refund,netPaidAfterRefund:input.netPaid-refund,outstanding:Math.max(0,due-input.netPaid)};
}
