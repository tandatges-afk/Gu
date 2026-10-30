import type {InventoryItem,RentalOrder} from './types.ts';
import {sortCalendarProductsForDay} from './calendar-presentation.ts';
import {calendarItemState,type CalendarFilter} from './smart-calendar.ts';
import {productGroup,type RentalGroup} from './order-group.ts';
import {matchesProductSearch} from './product-search.ts';
import {getProductCode} from './hanger-code.ts';

/** Global sort must happen BEFORE slicing pages. Never sort only 25 loaded rows. */
export function globalCalendarPage(input:{
 items:InventoryItem[];orders:RentalOrder[];start:string;today:string;group:RentalGroup;
 page:number;pageSize?:number;query?:string;category?:string;status?:CalendarFilter;creator?:string;
 riskItemIds?:ReadonlySet<string>;
}){
 const {items,orders,start,today,group,page,query='',category='ALL',status='ALL',creator='ALL'}=input;
 const pageSize=input.pageSize??25;
 if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)throw Error('Trang lịch không hợp lệ.');
 const q=query.trim();const digits=q.replace(/\D/g,'');
 const list=items.filter(item=>{
  if(item.archivedAt||productGroup(item.category)!==group||category!=='ALL'&&item.category!==category)return false;
  if(status!=='ALL'&&calendarItemState(item,orders,start,7,today)!==status)return false;
  if(creator!=='ALL'&&!orders.some(order=>order.createdBy===creator&&order.lines.some(line=>line.itemId===item.id)&&order.returnDate>=start))return false;
  if(!q)return true;
  const code=String(getProductCode(item)||item.hangerCode||item.sku||'');
  const related=orders.filter(o=>o.lines.some(l=>l.itemId===item.id));
  const customers=related.map(o=>[o.customerName,o.customerPhone,o.code].join(' ')).join(' ');
  const haystack=[item.name,item.category,item.color,code,item.sku||''].join(' ');
  return matchesProductSearch(haystack,q)||Boolean(digits&&code.replace(/\D/g,'').replace(/^0+/,'').endsWith(digits))||
   Boolean(customers&&(matchesProductSearch(customers,q)||digits&&customers.replace(/\D/g,'').includes(digits)));
 });
 const sorted=sortCalendarProductsForDay(list,start,orders,today,input.riskItemIds);
 const total=sorted.length,totalPages=Math.max(1,Math.ceil(total/pageSize));
 const safePage=Math.min(page,totalPages);
 return {results:sorted.slice((safePage-1)*pageSize,safePage*pageSize),total,totalPages,page:safePage,hasMore:safePage<totalPages};
}
