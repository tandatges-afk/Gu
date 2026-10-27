import type { RentalLine } from './types';
import { lateBaseCharge, lateDays } from './rental.ts';

export type ReturnChoice = 'OK'|'MISSING'|'';

/** Local preview only. The server recalculates every amount within the RETURN transaction. */
export function previewReturnSettlement(input:{
  lines: Pick<RentalLine,'itemId'|'replacementValue'|'dailyRate'>[];
  returnDate:string;
  actualDate:string;
  rentalTotal:number;
  alreadyPaid:number;
  checks:Record<string,ReturnChoice>;
  replacementValues?:Record<string,number>;
  otherFee?:number;
}) {
  const verified=input.lines.filter(l=>input.checks[l.itemId]==='OK'||input.checks[l.itemId]==='MISSING').length;
  const missing=input.lines.filter(l=>input.checks[l.itemId]==='MISSING');
  const unresolved=missing.filter(l=>(l.replacementValue||input.replacementValues?.[l.itemId]||0)<=0).map(l=>l.itemId);
  const compensation=missing.reduce((sum,l)=>sum+(l.replacementValue||input.replacementValues?.[l.itemId]||0),0);
  const days=lateDays(input.returnDate,input.actualDate);
  const lateFee=lateBaseCharge(input.lines,input.returnDate,input.actualDate);
  const otherFee=input.otherFee||0;
  const total=input.rentalTotal+compensation+lateFee+otherFee;
  return {
    verified,complete:verified===input.lines.length && input.lines.length>0,
    missingCount:missing.length,unresolved,compensation,
    days,lateFee,otherFee,total,
    remaining:Math.max(0,total-input.alreadyPaid),
  };
}
