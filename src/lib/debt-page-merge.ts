import type {DebtAccount,DebtSummary} from './debts';

/** Merge paginated debt results without mutating React state or server response data.
 * Global totals are supplied by the server, rather than summed from partial pages.
 */
export function mergeDebtPages(current:DebtSummary|null,next:DebtSummary):DebtSummary {
 if(!current)return next;
 const accounts=new Map<string,DebtAccount>();
 for(const account of current.accounts)accounts.set(account.key,{...account,orders:[...account.orders]});
 for(const account of next.accounts){
  const previous=accounts.get(account.key);
  if(!previous){accounts.set(account.key,{...account,orders:[...account.orders]});continue;}
  const known=new Set(previous.orders.map(order=>order.id));
  const orders=[...previous.orders,...account.orders.filter(order=>!known.has(order.id))];
  accounts.set(account.key,{...previous,orders,
   outstanding:orders.reduce((total,order)=>total+order.outstanding,0),orderCount:orders.length});
 }
 return {...next,accounts:[...accounts.values()].sort((a,b)=>b.outstanding-a.outstanding||a.customerName.localeCompare(b.customerName,'vi'))};
}
