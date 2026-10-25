'use client';
import {categorySelectOptions,isNonLaundryCategory,LEGACY_DEFAULT_CATEGORIES} from '@/lib/product-policies';
import {normalizeProductName} from '@/lib/product-name';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import {
  AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Boxes, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, CreditCard,
  Download, Filter, LayoutDashboard, LoaderCircle, LogOut, Menu, MoreHorizontal,
  Package, Plus, RefreshCcw, Search, ShieldCheck, Shirt, ShoppingBag, Sparkles, Pencil, Trash2,
  TrendingUp, Users, Wallet, WashingMachine, Settings2, X, BellRing, ClipboardCheck, ScrollText, UserCog, PhoneCall, CalendarSearch, ListTodo
} from 'lucide-react';
import { clientAuth } from '@/lib/firebase-client';
import { addDays, daysInclusive, money, vietnamToday } from '@/lib/rental';
import type { Customer, DashboardData, InventoryItem, OrderStatus, RentalOrder } from '@/lib/types';
import {AdminStaffPanel,AuditPanel,ImageUploader,ProductImage} from '@/components/GuExtras';
import {NewRentalForm,OrderAddItems} from '@/components/GuRentalForms';
import {GuV5Booking} from '@/components/GuV5Booking';
import {GuOrderCapture} from '@/components/GuOrderCapture';
import {matchesProductSearch} from '@/lib/product-search';
import {tomorrowReturnRisk,vnClock as vnCurrentTime} from '@/lib/return-risk';
import {vnClock as vnDisplayHour} from '@/lib/gu-v52-workflow';
import {GuVisualFinder} from '@/components/GuVisualFinder';
import {GuV5Review,GuV5OrderDetail} from '@/components/GuV5Review';
import {GuEvidenceHistory} from '@/components/GuEvidenceHistory';
import {GuReturnFlow} from '@/components/GuReturnFlow';
import {GuDebts} from '@/components/GuDebts';
import {GuSystem} from '@/components/GuSystem';
import {GuMoneyInput} from '@/components/GuMoneyInput';
import type {DebtSummary} from '@/lib/debts';
import {mergeDebtPages} from '@/lib/debt-page-merge';
import {GuPwaSetup,GuInstallApp} from '@/components/GuPwa';
import {GuStaffShifts} from '@/components/GuStaffShifts';
import {calendarItemState,type CalendarFilter} from '@/lib/smart-calendar';
import {getProductCode} from '@/lib/hanger-code';
import {orderCreatorName} from '@/lib/order-creator';

type Page = 'visual'|'reviews'|'overview'|'calendar'|'orders'|'debts'|'inventory'|'laundry'|'customers'|'reports'|'staff'|'shifts'|'audit'|'system';
type Modal = 'booking'|'item'|'customer'|'category'|'detail'|null;
type Availability = { available:boolean;conflicts:{itemId:string;sku:string;date:string}[];reason:string };

const nav: {id:Page;label:string;icon:typeof LayoutDashboard}[] = [
  {id:'overview',label:'Tổng quan',icon:LayoutDashboard},
  {id:'visual',label:'Tìm bằng ảnh',icon:Search},
  {id:'reviews',label:'Duyệt ảnh giao nhận',icon:ClipboardCheck},
  {id:'calendar',label:'Lịch cho thuê',icon:CalendarDays},
  {id:'orders',label:'Đơn thuê',icon:ShoppingBag},
  {id:'debts',label:'Công nợ',icon:CreditCard},
  {id:'inventory',label:'Kho sản phẩm',icon:Boxes},
  {id:'laundry',label:'Quản lý giặt',icon:WashingMachine},
  {id:'customers',label:'Khách hàng',icon:Users},
  {id:'reports',label:'Báo cáo',icon:TrendingUp},
  {id:'staff',label:'Nhân viên',icon:UserCog},
  {id:'shifts',label:'Đăng ký ca',icon:Clock3},
  {id:'audit',label:'Nhật ký thao tác',icon:ScrollText},
  {id:'system',label:'Hệ thống',icon:Settings2},
];
const navSections:{label:string;ids:Page[]}[]=[
  {label:'ĐƠN HÀNG',ids:['overview','calendar','orders','customers']},
  {label:'KHO SẢN PHẨM',ids:['inventory','visual','laundry']},
  {label:'LỊCH NHÂN SỰ',ids:['shifts']},
  {label:'QUẢN TRỊ',ids:['reviews','debts','reports','staff','audit','system']}
];
const orderLabels: Record<OrderStatus,string>={RESERVED:'Chờ bàn giao',PICKED_UP:'Đã giao',RETURNED:'Đã trả',CANCELLED:'Đã hủy',VOIDED:'Admin đã xóa'};
const statusLabels:Record<InventoryItem['status'],string>={AVAILABLE:'Sẵn sàng',RENTED:'Đang cho thuê',LAUNDRY:'Đang giặt',MAINTENANCE:'Bảo trì',MISSING:'Thất lạc'};
const prettyDay=(iso:string)=>{try{return new Date(iso+'T00:00:00Z').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});}catch{return iso;}};
const initials=(s:string)=>s.trim().split(/\s+/).slice(-2).map(x=>x[0]||'').join('').toUpperCase();
const fmtShort=(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('vi-VN',{day:'2-digit',month:'short',timeZone:'UTC'});
const shortMoney=(n:number)=>n>=1_000_000?(n/1_000_000).toLocaleString('vi-VN',{maximumFractionDigits:1})+'tr':n>=1000?Math.round(n/1000)+'k':String(n);
const digitsOnly=(value:string)=>value.replace(/\D/g,'');
const trailingCodeDigits=(value:string)=>digitsOnly(value).replace(/^0+/,'');
const calendarCellTime=(order:RentalOrder)=>{
  const pickup=vnDisplayHour(order.pickupAt);
  const returnHour=vnDisplayHour(order.returnAt);
  const hasShortCameraPackage=order.lines.some(line=>line.cameraPackageHours===3||line.cameraPackageHours===6);
  return pickup===returnHour&&!hasShortCameraPackage?pickup:`${pickup} → ${returnHour}`;
};
const matchesCalendarSearch=(item:InventoryItem,orders:RentalOrder[],rawQuery:string)=>{
  const query=rawQuery.trim();
  if(!query)return true;
  const productText=[item.name,item.category,item.color,getProductCode(item)||'',item.hangerCode||'',item.sku||''].join(' ');
  const relatedOrders=orders.filter(order=>order.lines.some(line=>line.itemId===item.id));
  const customerText=relatedOrders.map(order=>[order.customerName,order.customerPhone,order.code].join(' ')).join(' ');
  const queryDigits=digitsOnly(query);
  const codeDigits=trailingCodeDigits(getProductCode(item)||item.hangerCode||item.sku||'');
  return matchesProductSearch(productText,query)||Boolean(queryDigits&&codeDigits.endsWith(queryDigits))||Boolean(customerText&&matchesProductSearch(customerText,query))||Boolean(queryDigits&&digitsOnly(customerText).includes(queryDigits));
};

export default function Home() {
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const wasWorkingRef=useRef(false);
  const dashboardLoadedRef=useRef(false);
  const dashboardSyncRef=useRef('');
  const lastForcedCalendarReloadRef=useRef(0);
  const [shiftSession,setShiftSession]=useState<{role:'admin'|'staff';name:string;access:'WORK'|'REGISTER'|'DENIED';message:string|null;shift?:{allowedUntil:string|null;grace:boolean;activeSlot:string|null;shiftEndedAt:string|null}|null}|null>(null);
  const [authErr,setAuthErr]=useState('');
  const [loginEmail,setLoginEmail]=useState('');
  const [loginPassword,setLoginPassword]=useState('');
  const [loginPending,setLoginPending]=useState(false);
  const [data,setData]=useState<DashboardData|null>(null);
  const [taskOrders,setTaskOrders]=useState<RentalOrder[]>([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [itemError,setItemError]=useState('');
  const [toast,setToast]=useState('');
  const [page,setPage]=useState<Page>('overview');
  const [mobileNav,setMobileNav]=useState(false);
  const [modal,setModal]=useState<Modal>(null);
  const [calendarMatches,setCalendarMatches]=useState<RentalOrder[]|null>(null);
  const [selectedOrder,setSelectedOrder]=useState<RentalOrder|null>(null);
  const [captureId,setCaptureId]=useState<string|null>(null);
  const [remoteRisks,setRemoteRisks]=useState<Array<{itemId:string;heldOrderId:string;nextOrderId:string}>>([]);
  const [evidenceItem,setEvidenceItem]=useState<InventoryItem|null>(null);
  const [busy,setBusy]=useState(false);
  const [debtSummary,setDebtSummary]=useState<DebtSummary|null>(null);
  const [debtLoading,setDebtLoading]=useState(false);
  const [debtLoadingMore,setDebtLoadingMore]=useState(false);
  const [debtError,setDebtError]=useState('');
  const [reportDaily,setReportDaily]=useState<{date:string;amount:number;payments:number}[]|null>(null);
  const [reportNote,setReportNote]=useState('');
  const [query,setQuery]=useState('');
  const [calendarStart,setCalendarStart]=useState(vietnamToday());
  const [orderStatus,setOrderStatus]=useState<'ALL'|OrderStatus>('ALL');
  const [itemStatus,setItemStatus]=useState<'ALL'|InventoryItem['status']>('ALL');
  const [reportMode,setReportMode]=useState<'day'|'month'|'year'>('month');
  const [newItem,setNewItem]=useState({name:'',category:'Phụ kiện',size:'Một size',color:'',dailyRate:50000,requiresLaundry:true,cameraModel:'' as string,cameraSerial:'',replacementValue:0,inspectionAngles:[] as string[],referenceShots:{} as Record<string,string>,imagePaths:[] as string[]});
  const [editingItem,setEditingItem]=useState<string|null>(null);
  const [angleDraft,setAngleDraft]=useState('');
  const [editingCategory,setEditingCategory]=useState<string|null>(null);
  const [calendarCategory,setCalendarCategory]=useState('ALL');
  const [calendarStatus,setCalendarStatus]=useState<CalendarFilter>('ALL');
  const [calendarCreator,setCalendarCreator]=useState('ALL');
  const [calendarRemote,setCalendarRemote]=useState<InventoryItem[]>([]);
  const [calendarLoaded,setCalendarLoaded]=useState(false);
  const [calendarNext,setCalendarNext]=useState<string|null>(null);
  const [calendarPageCursor,setCalendarPageCursor]=useState<string|null>(null);
  const [calendarQuery,setCalendarQuery]=useState('');
  const [calendarReload,setCalendarReload]=useState(0);
  const [calendarOrderRows,setCalendarOrderRows]=useState<RentalOrder[]|null>(null);
  const [smartStart,setSmartStart]=useState(vietnamToday());
  const [smartEnd,setSmartEnd]=useState(vietnamToday());
  const [smartStartHour,setSmartStartHour]=useState('09:00');
  const [smartEndHour,setSmartEndHour]=useState('09:00');
  const [smartLoading,setSmartLoading]=useState(false);
  const [smartResult,setSmartResult]=useState<{availableIds:string[];products?:InventoryItem[];pickupDate:string;returnDate:string;checkedAt:string;hasMore?:boolean}|null>(null);
  const [nearestLoading,setNearestLoading]=useState<string|null>(null);
  const [nearestResult,setNearestResult]=useState<{itemId:string;nextPickupDate:string|null;nextReturnDate:string|null;reason:string}|null>(null);
  const [taskView,setTaskView]=useState<'ALL'|'PICKUP_TODAY'|'RETURN_TODAY'|'OVERDUE'>('ALL');
  const [categoryName,setCategoryName]=useState('');
  const [inventoryCategory,setInventoryCategory]=useState('ALL');
  const [bookingMode,setBookingMode]=useState<'RESERVE'|'PICKUP'>('RESERVE');
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',note:''});
  const [booking,setBooking]=useState({customerId:'',itemIds:[] as string[],pickupDate:vietnamToday(),returnDate:vietnamToday(),pickupHour:'',returnHour:'',depositDue:0,note:''});
  const [payAmount,setPayAmount]=useState('');
  const [extendReturnDate,setExtendReturnDate]=useState('');
  const [imageUploading,setImageUploading]=useState(false);
  const [clockTick,setClockTick]=useState(0);
  const [,setMinuteTick]=useState(0);
  const [notificationsEnabled,setNotificationsEnabled]=useState(false);
  const [laundryRemote,setLaundryRemote]=useState<InventoryItem[]>([]);
  const [laundryLoaded,setLaundryLoaded]=useState(false);
  const [laundryReload,setLaundryReload]=useState(0);
  const [catalogReload,setCatalogReload]=useState(0);
  const [catalogData,setCatalogData]=useState<{kind:string;results:Array<InventoryItem|Customer|RentalOrder>;cursor:string|null;hasMore:boolean}|null>(null);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [catalogCursor,setCatalogCursor]=useState<string|null>(null);
  const [catalogQuery,setCatalogQuery]=useState('');


  useEffect(()=>{
    try {return onAuthStateChanged(clientAuth(),u=>{setUser(u);setAuthReady(true);if(!u){setData(null);setShiftSession(null);wasWorkingRef.current=false;dashboardLoadedRef.current=false;}},()=>{setAuthErr('Không thể xác thực với Firebase. Kiểm tra cấu hình.');setAuthReady(true);});}
    catch(e){setAuthErr(e instanceof Error?e.message:'Lỗi cấu hình Firebase.');setAuthReady(true);}
  },[]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4800);return()=>clearTimeout(id);},[toast]);

  const api=useCallback(async<T=unknown>(path:string,init?:RequestInit):Promise<T>=>{
    const a=clientAuth(); const current=a.currentUser;
    if(!current) throw new Error('Bạn chưa đăng nhập.');
    const send=async(forceRefresh:boolean)=>{
      const token=await current.getIdToken(forceRefresh);
      return fetch('/api/'+path,{...init,cache:'no-store',headers:{'Authorization':'Bearer '+token,...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers}});
    };
    let res=await send(false);
    // Retry once with a freshly issued token. A 503 is a server configuration error, not an expired session.
    if(res.status===401)res=await send(true);
    const json=await res.json().catch(()=>({error:'Máy chủ trả về dữ liệu không hợp lệ.'}));
    if(!res.ok){const detail=Array.isArray(json.details)?' — '+json.details.map((x:{sku:string;date:string})=>'Sản phẩm trùng lịch ngày '+prettyDay(x.date)).join(', '):'';throw new Error((json.error||'Yêu cầu thất bại.')+detail);}
    return json as T;
  },[]);
  const sessionCheck=useCallback(async(loadDashboard=false)=>{
    try{
      const access=await api<{role:'admin'|'staff';name:string;access:'WORK'|'REGISTER'|'DENIED';message:string|null;shift?:{allowedUntil:string|null;grace:boolean;activeSlot:string|null;shiftEndedAt:string|null}|null}>('v5/session');
      setShiftSession(access);
      if(access.access==='DENIED'){
        setData(null);setAuthErr(access.message||'Bạn không có ca làm việc lúc này.');
        await signOut(clientAuth());return false;
      }
      if(access.access==='REGISTER'){
        // Someone leaving a working shift must be signed out 15 minutes later.
        // A fresh Sunday login may use only the registration screen.
        if(wasWorkingRef.current){
          setAuthErr('Ca làm đã kết thúc hơn 15 phút. Bạn đã được đăng xuất tự động.');
          await signOut(clientAuth());return false;
        }
        dashboardLoadedRef.current=false;
        setData(null);setPage('shifts');setErr('');return false;
      }
      if(access.role==='staff')wasWorkingRef.current=true;
      if(loadDashboard||!dashboardLoadedRef.current){
        const since=new Date(Date.now()-3000).toISOString();
        setData(await api<DashboardData>(loadDashboard?'bootstrap?fresh=1':'bootstrap'));dashboardSyncRef.current=since;dashboardLoadedRef.current=true;setErr('');
      }
      return true;
    }catch(e){setErr(e instanceof Error?e.message:'Không thể kiểm tra ca làm việc.');return false;}
  },[api]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{await sessionCheck(true);}finally{setLoading(false);}
  },[sessionCheck]);
  const refreshDebts=useCallback(async()=>{
    setDebtLoading(true);
    try {setDebtSummary(await api<DebtSummary>('debts'));setDebtError('');}
    catch(e){setDebtError(e instanceof Error?e.message:'Không thể tải công nợ.');}
    finally{setDebtLoading(false);}
  },[api]);
  const loadMoreDebts=useCallback(async()=>{
    if(!debtSummary?.cursor||debtLoadingMore)return;
    setDebtLoadingMore(true);
    try{
      const next=await api<DebtSummary>('debts?cursor='+encodeURIComponent(debtSummary.cursor));
      setDebtSummary(current=>mergeDebtPages(current,next));
      setDebtError('');
    }catch(e){setDebtError(e instanceof Error?e.message:'Không thể tải thêm công nợ.');}
    finally{setDebtLoadingMore(false);}
  },[api,debtSummary?.cursor,debtLoadingMore]);
  useEffect(()=>{if(user)void refresh();},[user,refresh]);
  // Read incremental changes during normal work, instead of downloading the full
  // dashboard repeatedly. Full reload is still available after writes/manual refresh.
  useEffect(()=>{
    if(!user||!data||shiftSession?.access!=='WORK')return;
    let active=true;
    const tick=async()=>{
      if(document.visibilityState!=='visible'||!dashboardSyncRef.current)return;
      try{
        const delta=await api<{full:boolean;checkedAt:string;items?:InventoryItem[];customers?:Customer[];orders?:RentalOrder[];removedOrderIds?:string[]}>(
          'bootstrap/updates?since='+encodeURIComponent(dashboardSyncRef.current));
        if(!active)return;
        if(delta.full){await refresh();return;}
        setData(old=>{
          if(!old)return old;
          const merge=<T extends {id:string}>(previous:T[],incoming:T[])=>[...new Map([...previous,...incoming].map(v=>[v.id,v] as const)).values()];
          const removed=new Set(delta.removedOrderIds||[]);
          return {...old,items:merge(old.items,delta.items||[]).filter(i=>!i.archivedAt),
            customers:merge(old.customers,delta.customers||[]),
            orders:merge(old.orders,delta.orders||[]).filter(o=>!removed.has(o.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100)};
        });
        dashboardSyncRef.current=delta.checkedAt;
      }catch{if(active)void refresh();}
    };
    const timer=setInterval(()=>void tick(),180_000);
    return()=>{active=false;clearInterval(timer);};
  },[user,data?.me.uid,shiftSession?.access,api,refresh]);

  useEffect(()=>{if(user&&data?.me.role==='admin'&&['overview','reports','debts'].includes(page))void refreshDebts();},[user,data?.me.role,page,refreshDebts]);
  useEffect(()=>{if(!user)return;const interval=setInterval(()=>{if(document.visibilityState==='visible'){setClockTick(t=>t+1);void refresh();}},1_800_000);return()=>clearInterval(interval);},[user,refresh]);
  useEffect(()=>{const timer=setInterval(()=>setMinuteTick(n=>n+1),60_000);return()=>clearInterval(timer);},[]);
  // Low-frequency fallback; exact expiry uses the server-computed allowedUntil.
  // Every business API still checks actual shift time on the server.
  useEffect(()=>{if(!user)return;const timer=setInterval(()=>{void sessionCheck();},180_000);return()=>clearInterval(timer);},[user,sessionCheck]);
  useEffect(()=>{
    if(!user||shiftSession?.role!=='staff'||shiftSession.access!=='WORK'||!shiftSession.shift?.allowedUntil)return;
    const deadline=Date.parse(shiftSession.shift.allowedUntil);
    if(!Number.isFinite(deadline))return;
    const timer=setTimeout(()=>{void sessionCheck();},Math.max(150,Math.min(2_147_000_000,deadline-Date.now()+250)));
    return()=>clearTimeout(timer);
  },[user,shiftSession,sessionCheck]);
  useEffect(()=>{
    if(!user||page!=='overview')return;
    let cancel=false;
    api<{orders:RentalOrder[]}>('tasks').then(r=>{if(!cancel)setTaskOrders(r.orders);}).catch(e=>{if(!cancel)setErr(e instanceof Error?e.message:'Không tải được việc hôm nay.');});
    return()=>{cancel=true;};
  },[user,page,api,clockTick]);

  useEffect(()=>{
    if(!user||!data||!['inventory','customers','orders'].includes(page))return;
    const kind=page==='inventory'?'items':page==='customers'?'customers':'orders';
    let cancelled=false;
    const timer=setTimeout(()=>{
      setCatalogLoading(true);
      api<{kind:string;results:Array<InventoryItem|Customer|RentalOrder>;cursor:string|null;hasMore:boolean}>(
        'catalog?kind='+kind+'&size=40'+(query.trim()?'&q='+encodeURIComponent(query.trim()):'')+(catalogCursor?'&cursor='+encodeURIComponent(catalogCursor):''))
        .then(result=>{if(!cancelled)setCatalogData(result);}).catch(e=>{if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được danh sách.');})
        .finally(()=>{if(!cancelled)setCatalogLoading(false);});
    },300);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[user,data?.me.uid,page,query,catalogCursor,catalogReload,api]);
  useEffect(()=>{setCatalogCursor(null);setCatalogData(null);},[page,query]);
  useEffect(()=>{
    if(!user||page!=='laundry')return;
    let cancelled=false;setLaundryLoaded(false);
    (async()=>{try{
      const all:InventoryItem[]=[];let cursor:string|null=null;
      for(let i=0;i<10;i++){
        const r: {items:InventoryItem[];cursor:string|null}=await api<{items:InventoryItem[];cursor:string|null}>(
          'stock-state?status=LAUNDRY'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
        all.push(...r.items);cursor=r.cursor;
        if(!cursor)break;
        if(i===9)throw new Error('Vượt 1.000 đồ cần giặt. Hãy xử lý theo từng đợt.');
      }
      if(!cancelled){setLaundryRemote(all);setLaundryLoaded(true);}
    }catch(e){if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được danh sách giặt.');}})();
    return()=>{cancelled=true;};
  },[user,page,laundryReload,api]);
  useEffect(()=>{if(user&&data?.me.role==='admin'&&['overview','reports'].includes(page)){
    api<{rows:{date:string;amount:number;payments:number}[];note:string}>('reports?mode='+reportMode)
      .then(r=>{setReportDaily(r.rows);setReportNote(r.note);}).catch(e=>{setReportDaily(null);setReportNote(e instanceof Error?e.message:'Chưa có báo cáo.');});
  }},[user,data?.me.role,page,reportMode,api]);
  useEffect(()=>{
    if(!user||page!=='calendar')return;
    let cancelled=false;
    const timer=setTimeout(()=>{
      const url='catalog?kind=items&size=25'+(calendarQuery.trim()?'&q='+encodeURIComponent(calendarQuery.trim()):'')+(calendarPageCursor?'&cursor='+encodeURIComponent(calendarPageCursor):'');
      api<{results:InventoryItem[];cursor:string|null}>(url).then(r=>{if(!cancelled){setCalendarRemote(r.results.filter(i=>!i.archivedAt));setCalendarLoaded(true);setCalendarNext(r.cursor);}})
        .catch(e=>{if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được sản phẩm lịch.');});
    },250);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[user,page,calendarQuery,calendarPageCursor,catalogReload,api]);
  useEffect(()=>{setCalendarPageCursor(null);},[calendarQuery]);
  useEffect(()=>{
    if(!user||page!=='calendar'||!calendarRemote.length){setCalendarOrderRows(null);return;}
    let cancelled=false;
    const ids=calendarRemote.map(i=>i.id).slice(0,30).join(',');
    const fresh=calendarReload>0&&lastForcedCalendarReloadRef.current!==calendarReload;
    if(fresh)lastForcedCalendarReloadRef.current=calendarReload;
    api<{orders:RentalOrder[]}>('calendar?start='+encodeURIComponent(calendarStart)+'&ids='+encodeURIComponent(ids)+(fresh?'&fresh=1':''))
      .then(r=>{if(!cancelled)setCalendarOrderRows(r.orders);})
      .catch(e=>{if(!cancelled){setCalendarOrderRows(null);setErr(e instanceof Error?e.message:'Không lấy được khóa lịch.');}});
    return()=>{cancelled=true;};
  },[user,page,calendarStart,calendarRemote,calendarReload,api]);
  useEffect(()=>{if(!user)return;let live=true;const pull=async()=>{try{const r=await api<{risks:Array<{itemId:string;heldOrderId:string;nextOrderId:string}>}>('v5/return-risk');if(live)setRemoteRisks(r.risks);}catch{/* Do not affect renting when alert API fails. */}};
    void pull();const timer=setInterval(()=>void pull(),15*60_000);return()=>{live=false;clearInterval(timer);};},[user,api]);
  const items=(data?.items||[]).filter(i=>!i.archivedAt);
  const customers=data?.customers||[];
  const orders=Array.from(new Map([...(data?.orders||[]),...taskOrders].map(o=>[o.id,o] as const)).values());
  const categories=data?.categories||[];
  const today=vietnamToday();
  // After 17:00 VN, refresh true cross-order stock risks independently of the 80-row dashboard.
  const {hour:vnHour}=vnCurrentTime(new Date());
  const riskRows=vnHour>=17?[...tomorrowReturnRisk(orders,new Date()),...remoteRisks]:[];
  const riskIds=new Set(riskRows.map(r=>r.itemId));

  const liveOrders=orders.filter(o=>o.status!=='CANCELLED');
  const active=liveOrders.filter(o=>o.status==='RESERVED'||o.status==='PICKED_UP');
  const picked=orders.filter(o=>o.status==='PICKED_UP');
  const dueToday=orders.filter(o=>o.returnDate===today&&o.status==='PICKED_UP');
  const overdueOrders=orders.filter(o=>o.status==='PICKED_UP'&&o.returnDate<today);
  const isOverdue=(o:RentalOrder)=>o.status==='PICKED_UP'&&o.returnDate<today;
  const dueAmount=(o:RentalOrder)=>o.total+(o.compensationTotal||0)+(o.lateFeeTotal||0)+(o.otherFeeTotal||0);
  const collected=reportDaily?.reduce((s,o)=>s+o.amount,0);
  // Only fulfilled orders with unpaid balances are real receivables. Reservations are separate.
  const allOutstanding=debtSummary?.totalOutstanding;
  const search=(str:string)=>matchesProductSearch(str,query);
  const filteredOrders=(taskView!=='ALL'?taskOrders:page==='orders'&&catalogData?.kind==='orders'?catalogData.results as RentalOrder[]:orders).filter(o=>(data?.me.role==='admin'||!['RETURNED','CANCELLED','VOIDED'].includes(o.status))&&(orderStatus==='ALL'||o.status===orderStatus)&&
    (taskView==='ALL'||(taskView==='PICKUP_TODAY'&&o.status==='RESERVED'&&o.pickupDate===today)||(taskView==='RETURN_TODAY'&&o.status==='PICKED_UP'&&o.returnDate===today)||(taskView==='OVERDUE'&&o.status==='PICKED_UP'&&o.returnDate<today))&&
    (!query||search(o.code+' '+o.customerName+' '+o.customerPhone+' '+orderCreatorName(o,data?.staffNames)+' '+o.lines.map(l=>l.name).join(' '))));
  const customerPhoneHref=(phone:string)=>'tel:'+phone.replace(/[^+0-9]/g,'');
  const copyProductCode=async(code:string)=>{
    try{await navigator.clipboard.writeText(code);setToast('Đã sao chép mã sản phẩm '+code);}
    catch{setToast('Mã sản phẩm: '+code);}
  };
  const assignOldProductCodes=async()=>{
    setBusy(true);
    try{
      const result=await api<{assigned:number;hasMore:boolean}>('items/hanger-codes',{method:'POST'});
      setToast(result.assigned?`Đã cấp ${result.assigned} mã sản phẩm. ${result.hasMore?'Nhấn lại để cấp tiếp.':''}`:'Tất cả sản phẩm đã có mã sản phẩm.');
      await refresh();
    }catch(e){setErr(e instanceof Error?e.message:'Không cấp được mã sản phẩm.');}
    finally{setBusy(false);}
  };
  const openTaskOrders=(view:'PICKUP_TODAY'|'RETURN_TODAY'|'OVERDUE')=>{setPage('orders');setOrderStatus('ALL');setQuery('');setTaskView(view);};
  const filteredItems=(page==='inventory'&&catalogData?.kind==='items'?catalogData.results as InventoryItem[]:items).filter(i=>!i.archivedAt).filter(i=>(itemStatus==='ALL'||i.status===itemStatus)&&(inventoryCategory==='ALL'||inventoryCategory===i.category)&&(!query||search(i.name+' '+i.size+' '+i.color+' '+i.category+' '+(i.hangerCode||''))));
  const filteredCustomers=(page==='customers'&&catalogData?.kind==='customers'?catalogData.results as Customer[]:customers).filter(c=>!query||search(c.name+' '+c.phone));
  const nameFromId=(id:string)=>items.find(i=>i.id===id)?.name||'Sản phẩm đã xóa';
  const statusClass=(s:string)=>['AVAILABLE','RETURNED'].includes(s)?'success':['PICKED_UP','RENTED'].includes(s)?'blue':s==='LAUNDRY'?'purple':s==='MAINTENANCE'?'slate':['CANCELLED','MISSING'].includes(s)?'danger':'amber';
  const action=async(path:string,body:unknown,success:string,method='POST')=>{
    setBusy(true);try{await api(path,{method,body:JSON.stringify(body)});setToast(success);setModal(null);await refresh();setCatalogReload(v=>v+1);setLaundryReload(v=>v+1);setCalendarReload(v=>v+1);if(data?.me.role==='admin')void refreshDebts();return true;}
    catch(e){const message=e instanceof Error?e.message:'Lỗi thao tác.';setErr(message);if(modal==='item')setItemError(message);return false;}
    finally{setBusy(false);}
  };
  const openModal=(m:Modal)=>{setItemError('');if(m==='item'){setAngleDraft('');setEditingItem(null);setNewItem({name:'',category:'Phụ kiện',size:'Một size',color:'',dailyRate:20000,requiresLaundry:false,cameraModel:'',cameraSerial:'',replacementValue:0,inspectionAngles:[],referenceShots:{},imagePaths:[]});}if(m==='category'){setEditingCategory(null);setCategoryName('');}setErr('');setModal(m);};
  const editItem=(i:InventoryItem)=>{setItemError('');setAngleDraft('');setEditingItem(i.id);setNewItem({name:i.name,category:i.category,size:i.size,color:i.color,dailyRate:i.dailyRate,cameraModel:i.cameraModel||'',cameraSerial:i.cameraSerial||'',requiresLaundry:i.requiresLaundry??i.bufferDays>0,replacementValue:i.replacementValue,inspectionAngles:i.inspectionAngles||[],referenceShots:i.referenceShots||{},imagePaths:i.imagePaths||[]});setErr('');setModal('item');};
  const addAngle=()=>{const angle=angleDraft.trim();if(!angle)return;if(newItem.inspectionAngles.includes(angle)){setErr('Góc chụp đã tồn tại.');return;}if(newItem.inspectionAngles.length>=10){setErr('Mỗi sản phẩm tối đa 10 góc chụp.');return;}setNewItem(v=>({...v,inspectionAngles:[...v.inspectionAngles,angle]}));setAngleDraft('');setErr('');};
   const editCategory=(id:string,name:string)=>{setEditingCategory(id);setCategoryName(name);setErr('');setModal('category');};
  const removeItem=async(i:InventoryItem)=>{if(!confirm(`Lưu trữ sản phẩm ${i.name}? Các đơn lịch sử vẫn được giữ nguyên.`))return;setBusy(true);try{await api('items/'+i.id,{method:'DELETE'});setToast('Đã lưu trữ sản phẩm.');await refresh();setCatalogReload(v=>v+1);}catch(e){setErr(e instanceof Error?e.message:'Không thể xóa sản phẩm.');}finally{setBusy(false);}};
  const removeCategory=async(id:string,name:string)=>{if(!confirm(`Xóa danh mục ${name}? Danh mục đang có sản phẩm sẽ không được xóa.`))return;setBusy(true);try{await api('categories/'+id,{method:'DELETE'});setToast('Đã xóa danh mục.');await refresh();}catch(e){setErr(e instanceof Error?e.message:'Không thể xóa danh mục.');}finally{setBusy(false);}};
  const openBooking=(mode:'RESERVE'|'PICKUP',itemId?:string,date?:string,endDate?:string,pickupHour='',returnHour='')=>{const actualMode=date?(date===today?'PICKUP':'RESERVE'):mode;if(date&&date<today){setErr('Không thể tạo lịch thuê trong quá khứ.');return;}setBookingMode(actualMode);setBooking({customerId:'',itemIds:itemId?[itemId]:[],pickupDate:date||today,returnDate:endDate||date||today,pickupHour,returnHour,depositDue:0,note:''});openModal('booking');};
  const openDebtOrder=async(id:string)=>{
    try {const full=await api<RentalOrder>('orders/'+id);openDetail(full);}
    catch(e){setErr(e instanceof Error?e.message:'Không tải được đơn công nợ.');}
  };
  const openDetail=(o:RentalOrder)=>{setSelectedOrder(o);setExtendReturnDate(addDays(o.returnDate,1));setPayAmount(dueAmount(o)>o.paid?String(dueAmount(o)-o.paid):'');openModal('detail');};
  const runOrderAction=async(id:string,orderAction:string,amount?:number)=>{
    const ok=await action('orders/'+id,{action:orderAction,...(amount?{amount}:{})},'Đã cập nhật đơn hàng.', 'PATCH');
    if(ok)setSelectedOrder(null);
  };

  const chartRows=useMemo(()=>{
    const cash=reportDaily||[];
    const keys=reportMode==='day'?Array.from({length:14},(_,i)=>addDays(today,i-13)):reportMode==='month'?Array.from({length:12},(_,i)=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-11+i);return d.toISOString().slice(0,7);}):Array.from({length:5},(_,i)=>String(Number(today.slice(0,4))-4+i));
    return keys.map(k=>({label:reportMode==='day'?k.slice(5):reportMode==='month'?k.slice(5)+'/'+k.slice(2,4):k,
      key:k,value:cash.filter(x=>x.date.slice(0,k.length)===k).reduce((s,x)=>s+x.amount,0)}));
  },[reportDaily,reportMode,today]);
  const chartMax=Math.max(1,...chartRows.map(r=>r.value));
  const calendarDays=Array.from({length:7},(_,i)=>addDays(calendarStart,i));
  const calendarActive=calendarOrderRows??active;
  const calendarOverdue=calendarActive.filter(o=>o.status==='PICKED_UP'&&o.returnDate<today);
  const calendarCreators=Array.from(new Map(calendarActive.filter(o=>Boolean(o.createdBy)).map(o=>[o.createdBy,orderCreatorName(o,data?.staffNames)] as const)).entries()).sort((a,b)=>a[1].localeCompare(b[1],'vi'));
  const creatorName=(o:RentalOrder)=>orderCreatorName(o,data?.staffNames);
  const calendarBaseItems=calendarLoaded?calendarRemote:items.slice(0,25);
  const calendarSearchPool=calendarQuery.trim()?[...new Map([...calendarBaseItems,...items].map(item=>[item.id,item] as const)).values()]:calendarBaseItems;
  const calendarItems=calendarSearchPool.filter(i=>(calendarCategory==='ALL'||i.category===calendarCategory)&&
    (calendarCreator==='ALL'||calendarActive.some(o=>o.createdBy===calendarCreator&&o.lines.some(l=>l.itemId===i.id)&&o.pickupDate<=calendarDays[6]&&o.returnDate>=calendarStart))&&
    (calendarStatus==='ALL'||calendarItemState(i,calendarActive,calendarStart,7,today)===calendarStatus)&&
    matchesCalendarSearch(i,calendarActive,calendarQuery));
  const quickMatches=items.filter(i=>(calendarCategory==='ALL'||i.category===calendarCategory)&&matchesCalendarSearch(i,[],calendarQuery));
  const availableMatches=smartResult&&smartResult.pickupDate===smartStart&&smartResult.returnDate===smartEnd?
    (smartResult.products||quickMatches.filter(i=>smartResult.availableIds.includes(i.id))).filter(i=>(calendarCategory==='ALL'||i.category===calendarCategory)&&matchesCalendarSearch(i,[],calendarQuery)):[];
  const findAvailable=async()=>{
    setSmartLoading(true);setNearestResult(null);setSmartResult(null);
    try {
      const result=await api<{availableIds:string[];products?:InventoryItem[];pickupDate:string;returnDate:string;checkedAt:string;hasMore?:boolean}>('smart-calendar',{
        method:'POST',body:JSON.stringify({mode:'FIND_AVAILABLE',pickupDate:smartStart,returnDate:smartEnd,startHour:smartStartHour,endHour:smartEndHour,query:calendarQuery})});
      setSmartResult(result);
    }catch(e){setErr(e instanceof Error?e.message:'Không thể tra cứu lịch trống.');}
    finally{setSmartLoading(false);}
  };
  const findNearest=async(itemId:string)=>{
    setNearestLoading(itemId);setNearestResult(null);
    try {
      const result=await api<{itemId:string;nextPickupDate:string|null;nextReturnDate:string|null;reason:string}>('smart-calendar',{
        method:'POST',body:JSON.stringify({mode:'NEXT_AVAILABLE',itemId,pickupDate:smartStart,returnDate:smartEnd,startHour:smartStartHour,endHour:smartEndHour})});
      setNearestResult(result);
    }catch(e){setErr(e instanceof Error?e.message:'Không thể tìm ngày trống tiếp theo.');}
    finally{setNearestLoading(null);}
  };
  // Shared occupancy logic for desktop timeline and mobile product cards.
  // Keep both views on the exact same booking rules and click handlers.
  const renderCalendarCell=(item:InventoryItem,day:string,mobile=false)=>{
    const matching=calendarActive.filter(o=>o.lines.some(l=>l.itemId===item.id)&&day>=o.pickupDate&&day<=o.returnDate&&day>=(o.lines.find(l=>l.itemId===item.id)?.startDate||o.pickupDate));
    const order=matching[0];
    const lateOrder=calendarOverdue.find(o=>o.lines.some(l=>l.itemId===item.id));
    const shown=order||(lateOrder&&day>=lateOrder.pickupDate?lateOrder:undefined);
    const late=!!lateOrder&&day>lateOrder.returnDate;
    const nextDayRisk=riskIds.has(item.id)&&day>=today;
    const blocked=!shown&&(['LAUNDRY','MAINTENANCE','MISSING'].includes(item.status)||!(item.replacementValue>0));
    const isPast=day<today;
    const title=shown?shown.customerName+' · '+shown.code+' · Tạo bởi: '+creatorName(shown)+(late?' · TRẢ TRỄ':'')+(nextDayRisk?' · 17H: CHƯA TRẢ, MAI CÓ ĐƠN':''):blocked?statusLabels[item.status]||'Chưa được định giá':isPast?'Ngày đã qua':day===today?'Giao đồ ngay':'Đặt trước';
    const date=new Date(day+'T00:00:00Z');
    const week=['CN','T2','T3','T4','T5','T6','T7'][date.getUTCDay()];
    return <button key={day} type="button" title={title} aria-label={`${prettyDay(day)}: ${title}`} className={'calendar-cell '+(mobile?'gu-calendar-mobile-cell ':'')+(day===today?'gu-calendar-cell-today ':'')+(nextDayRisk?'gu-next-day-risk ':late?'late-flash ':shown?(shown.status==='PICKED_UP'?'occupied-picked':'occupied-reserved'):blocked?'cell-blocked':'cell-free')} disabled={!shown&&(blocked||isPast)} onClick={()=>matching.length>1?setCalendarMatches(matching):shown?openDetail(shown):openBooking(day===today?'PICKUP':'RESERVE',item.id,day)}>
      {mobile&&<span className="gu-calendar-cell-date"><strong>{week}</strong><small>{day.slice(8,10)}/{day.slice(5,7)}</small></span>}
      <span className="gu-calendar-cell-result">{shown?<>{nextDayRisk?'⏰ ':late?'⚠ ':''}{matching.length>1?matching.length+' lượt':shown.customerName.split(' ').slice(-1)[0]}</>:blocked?'—':isPast?'·':'+'}</span>
      {shown&&<span className="gu-calendar-cell-time" title={'Giờ nhận: '+vnDisplayHour(shown.pickupAt)+' · Giờ trả: '+vnDisplayHour(shown.returnAt)}>{calendarCellTime(shown)}</span>}
      {shown&&<span className="gu-calendar-cell-creator" title={'Tạo bởi: '+creatorName(shown)}>NV: {creatorName(shown).split(/\s+/).slice(-1)[0]}</span>}
    </button>;
  };

  useEffect(()=>{
    if(!notificationsEnabled||typeof Notification==='undefined'||Notification.permission!=='granted')return;
    overdueOrders.forEach(o=>{
      const key='gu-overdue-'+today+'-'+o.id;
      if(localStorage.getItem(key))return;
      new Notification('GU - Khách trả đồ trễ',{body:`${o.customerName} · ${o.code} · Hẹn ${prettyDay(o.returnDate)}`});
      localStorage.setItem(key,'1');
    });
  },[notificationsEnabled,orders,today]);
  const enableNotifications=async()=>{
    if(typeof Notification==='undefined'){setToast('Trình duyệt không hỗ trợ thông báo hệ thống.');return;}
    const permission=await Notification.requestPermission();
    if(permission==='granted')setNotificationsEnabled(true);else setToast('Hãy cho phép thông báo trong trình duyệt nếu muốn bật cảnh báo ngoài trang web.');
  };

  const exportCsv=()=>{
    const rows=[['Mã đơn','Khách hàng','Số điện thoại','Nhân viên tạo','Nhận','Trả','Trạng thái','Tổng','Đã thu'],...filteredOrders.map(o=>[o.code,o.customerName,o.customerPhone,creatorName(o),o.pickupDate,o.returnDate,orderLabels[o.status],String(dueAmount(o)),String(o.paid)])];
    const csv='\uFEFF'+rows.map(cols=>cols.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='don-thue-'+today+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  if(!authReady)return <div className="center-screen"><LoaderCircle className="spin" size={30}/><p>Đang kết nối hệ thống…</p></div>;
  if(!user)return <div className="login-page"><div className="login-art"><div className="brand brand-large"><span className="brandmark"><Sparkles size={24}/></span><span>GU<span className="brand-accent">.</span></span></div><div className="login-art-copy"><span className="eyebrow light">GU - THUÊ ĐỒ XINH</span><h1>Vận hành cửa hàng<br/>đẹp như cách bạn<br/><em>chăm chút từng bộ đồ.</em></h1><p>Quản lý lịch thuê, kho đồ, khách hàng và doanh thu trên một nền tảng gọn gàng.</p><div className="login-feature"><ShieldCheck size={20}/> Tự động chống đặt trùng lịch theo từng món đồ</div></div><div className="login-art-bottom">GU - THUÊ ĐỒ XINH</div></div><div className="login-pane"><div className="login-box"><div className="login-small-logo"><span className="brandmark"><Sparkles size={21}/></span> GU<span className="brand-accent">.</span></div><div className="eyebrow">WELCOME BACK</div><h2>Chào mừng trở lại</h2><p className="muted">Đăng nhập bằng tài khoản nhân viên đã được cửa hàng cấp quyền.</p><form onSubmit={async(e)=>{e.preventDefault();setLoginPending(true);setAuthErr('');try{await signInWithEmailAndPassword(clientAuth(),loginEmail,loginPassword);}catch{setAuthErr('Email hoặc mật khẩu chưa đúng.');}finally{setLoginPending(false);}}}><label className="field-label">Email công việc</label><input className="input" type="email" autoComplete="email" placeholder="nhanvien@cuahang.vn" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/><label className="field-label">Mật khẩu</label><input className="input" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/>{authErr&&<div className="inline-alert danger-alert"><AlertCircle size={17}/>{authErr}</div>}<button type="submit" className="btn btn-dark login-btn" disabled={loginPending}>{loginPending?<LoaderCircle size={17} className="spin"/>:null} Đăng nhập <ArrowRight size={17}/></button></form><div className="login-secure"><ShieldCheck size={16}/> Bảo vệ bởi Firebase Authentication</div></div></div></div>;

  if(shiftSession?.access==='REGISTER')return <div className="gu-signup-gate">
    <div className="gu-signup-top"><strong>GU · Chỉ đăng ký ca</strong><button type="button" className="btn btn-white" onClick={()=>void signOut(clientAuth())}><LogOut size={16}/> Đăng xuất</button></div>
    <GuStaffShifts api={api} registrationOnly/>
  </div>;
  if(!shiftSession||shiftSession.access==='DENIED')return <div className="center-screen"><LoaderCircle className="spin" size={26}/> Đang xác thực ca làm việc…</div>;
  return <div className="shell">
    <aside className={'sidebar '+(mobileNav?'sidebar-open':'')}>
      <div className="brand"><span className="brandmark"><Sparkles size={22}/></span><span>GU<span className="brand-accent">.</span><small>THUÊ ĐỒ XINH</small></span></div>
      <div className="workspace"><div className="workspace-logo">GU</div><div className="workspace-copy"><strong>GU - Thuê đồ xinh</strong><span>Workspace <CheckCircle2 size={12}/></span></div><MoreHorizontal size={17} color="#948c83"/></div>
      <div className="nav-heading">QUẢN LÝ</div>
      <nav className="navigation">{navSections.map(group=><div className="gu-nav-section" key={group.label}><div className="gu-nav-section-title">{group.label}</div>{group.ids.filter(id=>data?.me.role==='admin'||!['reviews','debts','reports','staff','audit','system'].includes(id)).map(id=>{const item=nav.find(n=>n.id===id)!;const Icon=item.icon;return <button type="button" key={id} aria-current={page===id?'page':undefined} className={'nav-link '+(page===id?'nav-active':'')} onClick={()=>{setPage(id);setQuery('');setTaskView('ALL');setMobileNav(false);}}><Icon size={19} strokeWidth={1.9}/><span>{item.label}</span>{page===id&&<span className="active-line"/>}</button>;})}</div>)}</nav>
      <div className="sidebar-spacer"/>
      
      <div className="sidebar-user"><div className="avatar">{initials(data?.me.name||user.email||'AD')}</div><div className="sidebar-user-copy"><strong>{data?.me.name||user.email?.split('@')[0]}</strong><span>{data?.me.role==='admin'?'Quản trị viên':'Nhân viên'}</span></div><button className="icon-btn" aria-label="Đăng xuất" title="Đăng xuất" onClick={()=>void signOut(clientAuth())}><LogOut size={18}/></button></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Đóng menu"/>}
    <main className="main">
      <GuPwaSetup/>
      <header className="topbar"><div className="topbar-left"><button className="mobile-toggle icon-btn" onClick={()=>setMobileNav(true)} aria-label="Mở menu"><Menu/></button><span className="gu-mobile-brand">GU<span>.</span></span><span className="crumb">Workspace</span><ChevronRight size={14} color="#b5ada4"/><span className="crumb-current">{nav.find(n=>n.id===page)?.label}</span></div><div className="topbar-right"><span className="today"><CalendarDays size={16}/>{prettyDay(today)}</span><button className="icon-btn refresh-button" title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" onClick={()=>void refresh()}><RefreshCcw size={17} className={loading?'spin':''}/></button><div className="avatar top-avatar">{initials(data?.me.name||user.email||'A')}</div></div></header>
      <div className="content">
    {riskIds.size>0&&<div role="status" className="gu-next-day-risk-banner"><BellRing size={19}/><div><strong>{riskIds.size} sản phẩm cần kiểm tra trước ca thuê ngày mai</strong><span>Sau 17:00: đồ chưa trả nhưng đã có lịch cho khách khác vào ngày mai. Liên hệ khách và chuẩn bị phương án thay thế.</span></div><button type="button" className="btn btn-white" onClick={()=>{setPage('calendar');setCalendarStart(today);}}>Xem lịch</button></div>}
        {overdueOrders.length>0&&<div className="overdue-banner"><BellRing size={22}/><div><strong>KHẨN: {overdueOrders.length} đơn chưa trả đúng hạn</strong><p>{overdueOrders.slice(0,3).map(o=>o.code+' · '+o.customerName+' (hẹn '+prettyDay(o.returnDate)+')').join(' • ')}</p></div><button type="button" className="btn btn-white" onClick={()=>{setPage('orders');setOrderStatus('PICKED_UP');}}>Xem đơn trễ</button>{!notificationsEnabled&&<button type="button" className="btn btn-white" onClick={()=>void enableNotifications()}>Bật thông báo</button>}</div>}
        {err&&<div className="inline-alert danger-alert global-alert"><AlertCircle size={18}/><span>{err}</span><button className="icon-btn" onClick={()=>setErr('')} aria-label="Đóng thông báo"><X size={16}/></button></div>}
        {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}<button aria-label="Đóng" onClick={()=>setToast('')}><X size={15}/></button></div>}
        {!data?<div className="center-screen dashboard-empty">{loading?<><LoaderCircle className="spin" size={28}/><p>Đang tải dữ liệu cửa hàng…</p></>:<><AlertCircle size={30}/><h3>Chưa tải được dữ liệu</h3><p>Hãy kiểm tra tài khoản nhân viên và kết nối Firebase.</p><button className="btn btn-dark" onClick={()=>void refresh()}>Thử lại</button></>}</div>:<>
        {page==='overview'&&<><div className="page-intro"><div><div className="eyebrow">STORE OVERVIEW</div><h1>Xin chào, {data.me.name?.split(' ').slice(-1)[0]||'bạn'} <span className="wave">✳</span></h1><p>Đây là những gì đang diễn ra tại cửa hàng hôm nay.</p></div><div className="action-row"><button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={18}/> Tạo đơn · chụp ảnh giao</button></div></div>
          <div className="gu-mobile-action-panel"><div className="gu-mobile-greeting"><strong>Hôm nay tại GU</strong><span>{prettyDay(today)}</span></div><div className="gu-mobile-task-grid"><button type="button" onClick={()=>openTaskOrders('PICKUP_TODAY')}><CalendarDays size={18}/><strong>{orders.filter(o=>o.status==='RESERVED'&&o.pickupDate===today).length}</strong><small>Chờ giao hôm nay</small></button><button type="button" onClick={()=>openTaskOrders('RETURN_TODAY')}><Clock3 size={18}/><strong>{dueToday.length}</strong><small>Đến hẹn trả</small></button><button type="button" className={overdueOrders.length?'gu-mobile-danger':''} onClick={()=>openTaskOrders('OVERDUE')}><BellRing size={18}/><strong>{overdueOrders.length}</strong><small>Quá hạn</small></button></div></div>
          <GuInstallApp/>
          <div className="stats-grid">{data.me.role==='admin'&&<Metric icon={Wallet} title="Thu ròng từ sổ quỹ" value={collected===undefined?'Đang tải…':money(collected)} detail="Dòng tiền ghi nhận, đã trừ hoàn tiền" tone="peach"/>}<Metric icon={ShoppingBag} title="Đơn đang hoạt động" value={String(data.counts?.activeOrders??active.length).padStart(2,'0')} detail={`${picked.length} đơn đã lấy hàng`} tone="purple"/><Metric icon={Shirt} title="Sản phẩm trong kho" value={String(data.counts?.items??items.length).padStart(2,'0')} detail={`${data.counts?.available??items.filter(i=>i.status==='AVAILABLE').length} bộ sẵn sàng`} tone="blue"/><Metric icon={ArrowDownLeft} title="Cần trả hôm nay" value={String(dueToday.length).padStart(2,'0')} detail="Đơn đến hạn trả hôm nay" tone="green"/><Metric icon={WashingMachine} title="Đang giặt" value={String(data.counts?.laundry??laundryRemote.length??0).padStart(2,'0')} detail="Trả xong sẽ tự chuyển vào đây" tone="blue"/>{data.me.role==='admin'&&<button type="button" className="gu-debt-metric-link" onClick={()=>setPage('debts')}><CreditCard size={20}/><span>Công nợ cần thu</span><strong>{allOutstanding===undefined?'Đang tính…':money(allOutstanding)}</strong><small>{debtSummary?.accounts.length||0} khách · Không tính đơn giữ chỗ</small><ArrowRight size={17}/></button>}</div>
          <section className="panel gu-today-tasks" aria-label="Việc hôm nay">
            <div className="panel-heading"><div><h3><ListTodo size={19}/> Việc hôm nay</h3><p>Chạm vào đơn để xử lý hoặc gọi trực tiếp cho khách.</p></div></div>
            <div className="gu-task-lists">{[
              {key:'PICKUP_TODAY' as const,title:'Chờ giao',list:orders.filter(o=>o.status==='RESERVED'&&o.pickupDate===today)},
              {key:'RETURN_TODAY' as const,title:'Đến hạn trả',list:dueToday},
              {key:'OVERDUE' as const,title:'Quá hạn',list:overdueOrders}
            ].map(g=><div key={g.key} className="gu-task-group"><button className="gu-task-group-title" onClick={()=>openTaskOrders(g.key)}><span>{g.title}</span><strong>{g.list.length}</strong><ChevronRight size={15}/></button>
              {g.list.slice(0,3).map(o=><div className="gu-task-order" key={o.id}><button className="gu-task-open" onClick={()=>openDetail(o)}><strong>{o.customerName}</strong><small>{o.code} · {prettyDay(g.key==='PICKUP_TODAY'?o.pickupDate:o.returnDate)}</small></button><a className="gu-call-link" href={customerPhoneHref(o.customerPhone)} aria-label={'Gọi '+o.customerName} title={'Gọi '+o.customerPhone}><PhoneCall size={18}/></a></div>)}
              {!g.list.length&&<p className="gu-task-empty">Không có đơn cần xử lý</p>}
              {g.list.length>3&&<button className="gu-task-more" onClick={()=>openTaskOrders(g.key)}>Xem thêm {g.list.length-3} đơn <ArrowRight size={13}/></button>}
            </div>)}</div>
          </section>
          <div className="overview-columns"><section className="panel"><div className="panel-heading"><div><h3>Đơn thuê gần đây</h3></div><button className="text-action" onClick={()=>setPage('orders')}>Xem tất cả <ArrowRight size={15}/></button></div><div className="table-wrap"><table><thead><tr><th>ĐƠN HÀNG</th><th>KHÁCH HÀNG</th><th>NGÀY NHẬN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{orders.slice(0,6).map(o=><tr key={o.id} className={"click-row "+(o.status==='PICKED_UP'&&riskRows.some(r=>r.heldOrderId===o.id)?'gu-next-day-risk-order':'')} onClick={()=>openDetail(o)}><td><b>{o.code}</b><div className="table-sub">{money(o.total)}</div></td><td>{o.customerName}</td><td>{prettyDay(o.pickupDate)}</td><td>{riskRows.some(r=>r.heldOrderId===o.id)?<span className="badge gu-next-day-risk-badge">MAI CÓ KHÁCH ĐẶT</span>:isOverdue(o)?<span className="badge badge-danger overdue-blink">TRẢ TRỄ</span>:<StatusBadge status={o.status} label={orderLabels[o.status]}/>} </td></tr>)}{!orders.length&&<tr><td colSpan={4}><Empty small text="Chưa có đơn thuê. Hãy tạo đơn đầu tiên."/></td></tr>}</tbody></table></div></section><section className="panel gu-overview-work-panel"><div className="panel-heading"><div><h3>{data.me.role==='admin'?'Khách còn công nợ':'Tình trạng kho cần xử lý'}</h3><p>{data.me.role==='admin'?'Mở danh sách để biết ai cần thu, đơn nào còn thiếu.':'Các sản phẩm chưa sẵn sàng cho thuê'}</p></div></div>{data.me.role==='admin'?<div className="gu-overview-debt-preview">{debtSummary?.accounts.slice(0,4).map(a=><button key={a.key} type="button" className="gu-debt-preview-row" onClick={()=>setPage('debts')}><span><strong>{a.customerName}</strong><small>{a.customerPhone} · {a.orderCount} đơn</small></span><b>{money(a.outstanding)}</b><ChevronRight size={16}/></button>)}{!debtSummary?.accounts.length&&<p className="gu-debt-empty-inline">{debtLoading?'Đang đối soát công nợ…':'Chưa có khách nào nợ tiền.'}</p>}<button type="button" className="btn btn-white gu-panel-action" onClick={()=>setPage('debts')}>Xem công nợ theo khách <ArrowRight size={16}/></button></div>:<div className="gu-overview-debt-preview"><p className="gu-debt-empty-inline">Đang giặt: <strong>{(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)}</strong> món</p><p className="gu-debt-empty-inline">Bảo trì: <strong>{items.filter(i=>i.status==='MAINTENANCE').length}</strong> món</p><button type="button" className="btn btn-white gu-panel-action" onClick={()=>setPage('laundry')}>Mở Quản lý giặt <ArrowRight size={16}/></button></div>}</section></div>
          
        </>}
        {page==='calendar'&&<>
          <div className="page-intro"><div><div className="eyebrow">LỊCH THEO NGÀY / THÁNG / NĂM</div><h1>Lịch cho thuê</h1></div><div className="action-row"><button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={18}/> Giao ngay</button></div></div>
          <section className="panel gu-smart-calendar" aria-label="Tra cứu lịch trống nhanh">
            <div className="gu-smart-heading"><div><h3><CalendarSearch size={20}/> Tìm đồ còn trống</h3></div></div>
            <div className="gu-smart-controls">
              <label>Từ ngày<input className="input" type="date" lang="vi-VN" min={today} value={smartStart} onChange={e=>{const v=e.target.value;setSmartStart(v);if(v>smartEnd)setSmartEnd(v);setSmartResult(null);setNearestResult(null);}}/></label>
              <label>Đến ngày thuê<input className="input" type="date" lang="vi-VN" min={smartStart} value={smartEnd} onChange={e=>{setSmartEnd(e.target.value);setSmartResult(null);setNearestResult(null);}}/></label>
              <label>Giờ nhận<input aria-label="Giờ bắt đầu thuê" className="input" type="time" value={smartStartHour} onChange={e=>{setSmartStartHour(e.target.value);setSmartResult(null);}}/></label>
              <label>Giờ trả (ngày hôm sau ngày cuối)<input aria-label="Giờ trả thuê" className="input" type="time" value={smartEndHour} onChange={e=>{setSmartEndHour(e.target.value);setSmartResult(null);}}/></label>
              <button type="button" className="btn btn-dark" disabled={smartLoading||!smartStart||!smartEnd||smartEnd<smartStart} onClick={()=>void findAvailable()}>{smartLoading?<LoaderCircle size={16} className="spin"/>:<Search size={16}/>} Tìm đồ trống</button>
            </div>
            {smartResult&&smartResult.pickupDate===smartStart&&smartResult.returnDate===smartEnd&&<div className="gu-smart-result" aria-live="polite"><div className="gu-smart-result-title"><strong>{availableMatches.length} món trống trong trang tìm kiếm</strong><small>{prettyDay(smartStart)} {smartStartHour} – hết {prettyDay(smartEnd)}, trả hôm sau lúc {smartEndHour}</small></div>
              <div className="gu-smart-items">{availableMatches.slice(0,24).map(i=><div className="gu-smart-product" key={i.id}><ProductImage paths={i.imagePaths}/><div><strong>{i.name}</strong><small>{getProductCode(i)||"Chưa có mã sản phẩm"} · {money(i.dailyRate)}/ngày</small></div><button className="btn btn-white" onClick={()=>openBooking(smartStart===today?'PICKUP':'RESERVE',i.id,smartStart,smartEnd,smartStartHour,smartEndHour)}>Chọn đồ <Plus size={15}/></button></div>)}
              {!availableMatches.length&&<div className="gu-smart-no-results">Không tìm thấy đồ trống theo bộ lọc hiện tại. Thử món khác hoặc bấm <strong>Ngày trống gần nhất</strong> trong lịch bên dưới.</div>}
              {availableMatches.length>24&&<small className="gu-smart-overflow">Hiển thị 24/{availableMatches.length} sản phẩm</small>}</div></div>}
            
          </section>
          <div className="gu-catalog-pager"><div className="gu-search-wrap"><Search size={15}/><input className="input" value={calendarQuery} onChange={e=>setCalendarQuery(e.target.value)} placeholder="Tìm tên sản phẩm, mã GU-00234 / 234, khách đang thuê hoặc SĐT…"/></div><button type="button" className="btn btn-white" disabled={!calendarNext} onClick={()=>setCalendarPageCursor(calendarNext)}>25 món tiếp theo <ChevronRight size={14}/></button><button type="button" className="btn btn-white" disabled={!calendarPageCursor} onClick={()=>setCalendarPageCursor(null)}>Đầu danh sách</button></div>
          <p className="gu-calendar-search-note">Ô tìm kiếm này dùng chung cho lịch thuê và tìm đồ trống. Có thể gõ <b>234</b> để ra mã <b>GU-00234</b>, hoặc tìm theo tên khách / SĐT của đơn đang giữ đồ. Tìm theo khách chỉ áp dụng ở trang lịch, không áp dụng trong form tạo đơn hay đặt lịch.</p>
          <section className="panel calendar-panel"><div className="calendar-toolbar"><div><h3>Lịch sản phẩm</h3><div className="legend">{data.me.role==='admin'&&<span className="overdue-label"><i className="legend-dot maintenance"/>Chớp đỏ: trả trễ</span>}<span><i className="legend-dot reserved"/>Đã giữ</span><span><i className="legend-dot picked"/>Đã lấy</span><span><i className="legend-dot free"/>Còn trống</span></div></div><div className="calendar-controls">
            <select className="input gu-calendar-cat" value={calendarCategory} onChange={e=>setCalendarCategory(e.target.value)}><option value="ALL">Tất cả danh mục</option>{Array.from(new Set(items.map(i=>i.category))).sort().map(c=><option value={c} key={c}>{c}</option>)}</select>
            <select className="input gu-calendar-status" aria-label="Lọc lịch theo tình trạng" value={calendarStatus} onChange={e=>setCalendarStatus(e.target.value as CalendarFilter)}>
              <option value="ALL">Mọi trạng thái</option><option value="FREE">Còn trống</option><option value="RESERVED">Đã giữ</option><option value="PICKED_UP">Đã giao</option><option value="OVERDUE">Trả trễ</option><option value="LAUNDRY">Đang giặt</option><option value="MAINTENANCE">Bảo trì</option><option value="MISSING">Thất lạc</option><option value="UNPRICED">Chưa duyệt giá</option>
            </select>
            {data.me.role==='admin'&&<select className="input gu-calendar-creator" aria-label="Lọc theo nhân viên tạo đơn" value={calendarCreator} onChange={e=>setCalendarCreator(e.target.value)}><option value="ALL">Mọi nhân viên tạo</option>{calendarCreators.map(([uid,name])=><option key={uid} value={uid}>{name}</option>)}</select>}
            <button className="icon-btn boxed" title="Lùi 1 ngày" onClick={()=>setCalendarStart(addDays(calendarStart,-1))}><ChevronLeft size={18}/></button>
            <input className="input gu-date-nav" type="date" lang="vi-VN" aria-label="Chọn ngày bắt đầu" value={calendarStart} onChange={e=>{if(e.target.value)setCalendarStart(e.target.value);}}/>
            <button className="btn btn-white" onClick={()=>setCalendarStart(today)}>Hôm nay</button>
            <button className="icon-btn boxed" title="Tiến 1 ngày" onClick={()=>setCalendarStart(addDays(calendarStart,1))}><ChevronRight size={18}/></button>
          </div></div>
          <div className="calendar-scroll gu-calendar-desktop"><div className="calendar-grid"><div className="calendar-corner">SẢN PHẨM / NGÀY</div>
            {calendarDays.map(d=><div key={d} className={'calendar-day '+(d===today?'calendar-today':'')}><span>{new Date(d+'T00:00:00Z').toLocaleDateString('vi-VN',{weekday:'short',timeZone:'UTC'})}</span><strong>{prettyDay(d)}</strong></div>)}
            {calendarItems.map(item=><div className={'calendar-row '+(calendarOverdue.some(o=>o.lines.some(l=>l.itemId===item.id))?'overdue-row':'')} key={item.id}>
              <div className="calendar-item"><ProductImage paths={item.imagePaths} className="gu-calendar-photo"/><div><strong>{item.name}</strong><span>{item.category} · Mã SP: {getProductCode(item)||"chưa cấp"}</span><button type="button" className="gu-nearest-link" disabled={nearestLoading===item.id} onClick={()=>void findNearest(item.id)}><CalendarSearch size={12}/> {nearestLoading===item.id?'Đang tìm…':'Ngày trống gần nhất'}</button>{nearestResult?.itemId===item.id&&<small className="gu-nearest-inline">{nearestResult.nextPickupDate?`Trống: ${prettyDay(nearestResult.nextPickupDate)}`:nearestResult.reason}</small>}</div></div>
              {calendarDays.map(day=>renderCalendarCell(item,day))}
            </div>)}
            {!calendarItems.length&&<div className="calendar-no-items">Không có sản phẩm trong danh mục đang chọn.</div>}
          </div></div>
          <div className="gu-mobile-calendar" aria-label="Lịch thuê sản phẩm trên điện thoại">
            {calendarItems.map(item=><article className="gu-mobile-calendar-card" key={item.id}>
              <div className="gu-mobile-calendar-product"><ProductImage paths={item.imagePaths} className="gu-calendar-photo"/><div className="gu-mobile-calendar-product-info"><strong>{item.name}</strong><span>{item.category} · Mã SP: {getProductCode(item)||"chưa cấp"}</span><button type="button" className="gu-nearest-link" disabled={nearestLoading===item.id} onClick={()=>void findNearest(item.id)}><CalendarSearch size={13}/> {nearestLoading===item.id?'Đang tìm…':'Ngày trống gần nhất'}</button>{nearestResult?.itemId===item.id&&<small className="gu-nearest-inline">{nearestResult.nextPickupDate?`Trống: ${prettyDay(nearestResult.nextPickupDate)}`:nearestResult.reason}</small>}</div></div>
              <div className="gu-mobile-days-scroll" aria-label={'Cuộn ngày thuê của '+item.name} tabIndex={0}><div className="gu-mobile-days-grid">{calendarDays.map(day=>renderCalendarCell(item,day,true))}</div></div>
            </article>)}
            {!calendarItems.length&&<div className="calendar-no-items">Không có sản phẩm trong danh mục đang chọn.</div>}
          </div>
          {nearestResult&&<div className="gu-nearest-result" aria-live="polite"><CalendarSearch size={19}/><div><strong>{items.find(i=>i.id===nearestResult.itemId)?.name||'Sản phẩm'}:</strong> {nearestResult.nextPickupDate?`trống từ ${prettyDay(nearestResult.nextPickupDate)} đến ${prettyDay(nearestResult.nextReturnDate!)}`:nearestResult.reason}</div>{nearestResult.nextPickupDate&&<button className="btn btn-dark" onClick={()=>openBooking(nearestResult.nextPickupDate===today?'PICKUP':'RESERVE',nearestResult.itemId,nearestResult.nextPickupDate!,nearestResult.nextReturnDate!,smartStartHour,smartEndHour)}>Đặt ngày này</button>}<button className="icon-btn" title="Đóng" aria-label="Đóng kết quả" onClick={()=>setNearestResult(null)}><X size={16}/></button></div>}
          </section>
        </>}
        {['inventory','customers','orders'].includes(page)&&<div className="gu-catalog-pager" aria-live="polite"><span>{catalogLoading?'Đang tải…':catalogData?`${catalogData.results?.length ?? 0} kết quả`: ''}</span><button className="btn btn-white" type="button" disabled={catalogLoading||!catalogData?.hasMore} onClick={()=>setCatalogCursor(catalogData?.cursor||null)}>Trang kế tiếp <ChevronRight size={14}/></button><button className="btn btn-white" type="button" disabled={catalogLoading||!catalogCursor} onClick={()=>setCatalogCursor(null)}>Về trang đầu</button></div>}
        {page==='orders'&&<><div className="page-intro"><div><div className="eyebrow">RENTAL ORDERS</div><h1>Quản lý đơn thuê</h1></div><div className="action-row"><button className="btn btn-white" onClick={exportCsv}><Download size={17}/> Xuất CSV</button><button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={17}/> Tạo đơn · chụp ảnh giao</button></div></div>{items.some(i=>i.status==='LAUNDRY')&&<button className="gu-orders-laundry-link" type="button" onClick={()=>setPage('laundry')}><WashingMachine size={17}/> {(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)} món đang giặt — xem tại Quản lý giặt <ArrowRight size={16}/></button>}
        {taskView!=='ALL'&&<div className="gu-task-active"><ListTodo size={16}/> Đang xem: {taskView==='PICKUP_TODAY'?'Chờ giao hôm nay':taskView==='RETURN_TODAY'?'Đến hạn trả hôm nay':'Đơn trả quá hạn'} <button className="btn btn-white" onClick={()=>setTaskView('ALL')}>Xóa lọc</button></div>}<div className="summary-pills"><span><ShoppingBag size={16}/> Tổng đơn <b>{orders.length}</b></span><span><Clock3 size={16}/> Đang giữ <b>{orders.filter(o=>o.status==='RESERVED').length}</b></span><span><Shirt size={16}/> Đã lấy <b>{picked.length}</b></span>{data.me.role==='admin'&&<button type="button" className="gu-pill-link" onClick={()=>setPage('debts')}><CreditCard size={16}/> Công nợ <b>{allOutstanding===undefined?'Đang tính…':money(allOutstanding)}</b> <ArrowRight size={14}/></button>}</div><section className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã đơn, khách, SĐT, nhân viên…"/></div><div className="select-holder"><Filter size={17}/><select value={orderStatus} onChange={e=>setOrderStatus(e.target.value as typeof orderStatus)}><option value="ALL">Tất cả trạng thái</option>{(Object.keys(orderLabels) as OrderStatus[]).map(k=><option key={k} value={k}>{orderLabels[k]}</option>)}</select></div></div><div className="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM</th><th>LỊCH THUÊ</th><th>THANH TOÁN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>{filteredOrders.map(o=><tr key={o.id} className={"click-row "+(o.status==='PICKED_UP'&&riskRows.some(r=>r.heldOrderId===o.id)?'gu-next-day-risk-order':'')} onClick={()=>openDetail(o)}><td><b>{o.code}</b><div className="table-sub">{prettyDay(o.createdAt.slice(0,10))}</div><div className="gu-order-created-by">NV: {creatorName(o)}</div></td><td><b>{o.customerName}</b><div className="table-sub">{o.customerPhone}</div><a href={customerPhoneHref(o.customerPhone)} className="gu-order-call" onClick={e=>e.stopPropagation()}><PhoneCall size={13}/> Gọi khách</a></td><td>{o.lines.map(l=>l.name).join(', ')}<div className="table-sub">{o.lines.length} sản phẩm</div></td><td>{prettyDay(o.pickupDate)}<div className="table-sub">→ {prettyDay(o.returnDate)}</div></td><td><b>{money(dueAmount(o))}</b><div className="table-sub">Đã thu: {money(o.paid)}</div></td><td>{riskRows.some(r=>r.heldOrderId===o.id)?<span className="badge gu-next-day-risk-badge">MAI CÓ KHÁCH ĐẶT</span>:isOverdue(o)?<span className="badge badge-danger overdue-blink">TRẢ TRỄ</span>:<StatusBadge status={o.status} label={orderLabels[o.status]}/>} </td><td><ChevronRight size={16}/></td></tr>)}{!filteredOrders.length&&<tr><td colSpan={7}><Empty small text="Không tìm thấy đơn thuê phù hợp."/></td></tr>}</tbody></table></div></section></>}
        {page==='laundry'&&<><div className="page-intro"><div><div className="eyebrow">LAUNDRY MANAGEMENT</div><h1>Quản lý giặt</h1></div><button className="btn btn-white" onClick={()=>void refresh()}><RefreshCcw size={17}/> Làm mới</button></div>
          <section className="panel gu-laundry-queue"><div className="panel-heading"><div><h3><WashingMachine size={20}/> Đang giặt ({(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)})</h3></div></div><div className="gu-laundry-list">{(laundryLoaded?laundryRemote:items.filter(i=>i.status==='LAUNDRY')).map(i=><div key={i.id} className="gu-laundry-line"><ProductImage paths={i.imagePaths}/><span><strong>{i.name}</strong><small>{i.category} · {getProductCode(i)||'Chưa cấp mã sản phẩm'}</small></span><button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+i.id,{action:'CLEAN'},'Đã giặt · kho đã cập nhật.','PATCH')}><CheckCircle2 size={15}/> Đã giặt</button></div>)}{!(laundryLoaded?laundryRemote.length:items.some(i=>i.status==='LAUNDRY'))&&<Empty text="Không có sản phẩm đang giặt."/>}</div></section>
        </>}
        {page==='inventory'&&<><div className="page-intro"><div><div className="eyebrow">INVENTORY CONTROL</div><h1>Kho sản phẩm</h1></div><div className="action-row"><button className="btn btn-white" onClick={()=>openModal('category')}><Plus size={16}/> Quản lý danh mục</button>{data.me.role==='admin'&&items.some(i=>!getProductCode(i))&&<button className="btn btn-white" disabled={busy} onClick={()=>void assignOldProductCodes()}><RefreshCcw size={16}/> Cấp mã sản phẩm</button>}<button className="btn btn-dark" onClick={()=>openModal('item')}><Plus size={18}/> Thêm sản phẩm</button></div></div>
          <div className="inventory-stats"><span><i className="legend-dot free"/> Sẵn sàng <b>{data.counts?.available??items.filter(i=>i.status==='AVAILABLE').length}</b></span><span><i className="legend-dot picked"/> Đang thuê <b>{data.counts?.rented??items.filter(i=>i.status==='RENTED').length}</b></span><button className="gu-status-link" onClick={()=>setPage('laundry')}><i className="legend-dot reserved"/> Đang giặt <b>{data.counts?.laundry??laundryRemote.length}</b></button><span><i className="legend-dot maintenance"/> Thất lạc <b>{data.counts?.missing??items.filter(i=>i.status==='MISSING').length}</b></span></div>
          <section className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc mã sản phẩm…"/></div><div className="select-holder"><Filter size={17}/><select value={itemStatus} onChange={e=>setItemStatus(e.target.value as typeof itemStatus)}><option value="ALL">Tất cả tình trạng</option>{(Object.keys(statusLabels) as InventoryItem['status'][]).map(k=><option key={k} value={k}>{statusLabels[k]}</option>)}</select></div><select className="input gu-filter-category" value={inventoryCategory} onChange={e=>setInventoryCategory(e.target.value)}><option value="ALL">Tất cả danh mục</option>{Array.from(new Set([...items.map(i=>i.category),...(data?.categories||[]).map(c=>c.name)])).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>PHÂN LOẠI</th><th>GIÁ THUÊ</th><th>TÌNH TRẠNG</th><th>THAO TÁC</th></tr></thead><tbody>{filteredItems.map(i=><tr key={i.id}><td><div className="item-name-cell"><ProductImage paths={i.imagePaths}/><div><b>{i.name}</b><div className="table-sub">{i.color||'Không ghi màu'}</div><div className="gu-product-code-row"><span className="gu-product-code-label">Mã sản phẩm</span>{getProductCode(i)?<button className="gu-product-code-tag" type="button" title="Nhấn để sao chép mã sản phẩm" onClick={()=>void copyProductCode(i.hangerCode!)}>{i.hangerCode}</button>:<span className="gu-product-code-unassigned">Chưa cấp mã sản phẩm</span>}</div></div></div></td><td>{i.category}<div className="table-sub">{(i.requiresLaundry ?? (i.bufferDays>0))?'Có giặt sau thuê':'Không cần giặt'}</div></td><td><b>{i.cameraModel?(i.cameraModel==='Canon EOS R50'?'110k / 3h':'90k / 3h'):money(i.dailyRate)}</b>{i.cameraModel&&<div className="table-sub">Serial: {i.cameraSerial||'Chưa có'}</div>}<div className="table-sub">Đền bù: {i.replacementValue>0?money(i.replacementValue):'Chờ Admin duyệt'}</div></td><td><StatusBadge status={i.status} label={statusLabels[i.status]}/></td><td><div className="gu-table-actions"><button className="btn btn-white" type="button" onClick={()=>editItem(i)}><Pencil size={15}/> Sửa</button>{i.status==='LAUNDRY'&&<button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+i.id,{action:'CLEAN'},'Đã giặt, kho đã cập nhật.','PATCH')}><WashingMachine size={15}/> Đã giặt</button>}{data.me.role==='admin'&&<button type="button" className="btn btn-white" onClick={()=>setEvidenceItem(i)}>Ảnh 7 lượt</button>}{data.me.role==='admin'&&<details className="gu-row-more"><summary className="btn btn-white">Khác <ChevronDown size={15}/></summary><div className="gu-row-more-menu"><button type="button" className="btn btn-danger" disabled={busy} onClick={()=>void removeItem(i)}><Trash2 size={15}/> Lưu trữ sản phẩm</button>{i.status!=='RENTED'&&i.status!=='MISSING'&&i.status!=='LAUNDRY'&&<label className="gu-row-state-edit">Tình trạng<select className="small-select" aria-label={'Đổi tình trạng '+i.name} disabled={busy} value={i.status} onChange={e=>void action('items/'+i.id,{status:e.target.value},'Đã cập nhật kho.','PATCH')}><option value="AVAILABLE">Sẵn sàng</option><option value="MAINTENANCE">Bảo trì</option></select></label>}</div></details>}</div></td></tr>)}{!filteredItems.length&&<tr><td colSpan={5}><Empty small text="Không có sản phẩm phù hợp."/></td></tr>}</tbody></table></div></section></>}
        {page==='debts'&&data.me.role==='admin'&&<GuDebts summary={debtSummary} loading={debtLoading} error={debtError} onRefresh={()=>void refreshDebts()} onLoadMore={()=>void loadMoreDebts()} loadingMore={debtLoadingMore} onOpen={id=>void openDebtOrder(id)}/>}
        {page==='customers'&&<><div className="page-intro"><div><div className="eyebrow">CUSTOMER RELATIONSHIPS</div><h1>Khách hàng</h1></div><button className="btn btn-dark" onClick={()=>openModal('customer')}><Plus size={18}/> Thêm khách hàng</button></div><section className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…"/></div><div className="customer-count">{filteredCustomers.length} khách hàng</div></div><div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>SỐ ĐIỆN THOẠI</th><th>GHI CHÚ</th><th>SỐ LẦN THUÊ</th><th>TỔNG GIÁ TRỊ ĐƠN</th>{data.me.role==='admin'&&<th>CÔNG NỢ</th>}</tr></thead><tbody>{filteredCustomers.map(c=>{const os=orders.filter(o=>o.customerId===c.id&&o.status!=='CANCELLED');return <tr key={c.id}><td><div className="item-name-cell"><span className="avatar customer-avatar">{initials(c.name)}</span><div><b>{c.name}</b><div className="table-sub">{prettyDay(c.createdAt.slice(0,10))}</div></div></div></td><td>{c.phone}</td><td>{c.note||'—'}</td><td><b>{os.length}</b></td><td>{money(os.reduce((s,o)=>s+o.total,0))}</td>{data.me.role==='admin'&&<td>{debtSummary?.accounts.some(a=>a.customerId===c.id)?<button className="gu-debt-mini-link" type="button" onClick={()=>setPage('debts')}>{money(debtSummary.accounts.find(a=>a.customerId===c.id)!.outstanding)} <ArrowRight size={13}/></button>:<span className="gu-settled-label">{debtSummary?'Không nợ':'Chưa đối soát'}</span>}</td>}</tr>;})}{!filteredCustomers.length&&<tr><td colSpan={data.me.role==='admin'?6:5}><Empty small text="Chưa có khách hàng."/></td></tr>}</tbody></table></div></section></>}
        {page==='staff'&&data.me.role==='admin'&&<AdminStaffPanel api={api}/>}
        {page==='shifts'&&<GuStaffShifts api={api} isAdmin={data.me.role==='admin'}/>}
        {page==='reviews'&&data.me.role==='admin'&&<GuV5Review api={api} onChanged={refresh}/>}
        {page==='visual'&&<GuVisualFinder api={api}/>} 
        {page==='audit'&&data.me.role==='admin'&&<AuditPanel api={api}/>}
        {page==='system'&&data.me.role==='admin'&&<GuSystem api={api}/>} 
        {page==='reports'&&data.me.role==='admin'&&<>{reportNote&&<div className="inline-alert" role="status">{reportNote}</div>}<div className="page-intro"><div><div className="eyebrow">BUSINESS INSIGHTS</div><h1>Báo cáo doanh thu</h1></div><div className="select-holder report-select"><select value={reportMode} onChange={e=>setReportMode(e.target.value as typeof reportMode)}><option value="day">14 ngày</option><option value="month">12 tháng</option><option value="year">5 năm</option></select></div></div><div className="stats-grid report-stats"><Metric icon={Wallet} title="Thu ròng từ sổ quỹ" value={collected===undefined?'Đang tải…':money(collected)} detail="Thu tiền trừ hoàn tiền đã ghi nhận" tone="peach"/><Metric icon={CircleDollarSign} title="Giá trị đơn gần đây" value={money(liveOrders.reduce((s,o)=>s+o.total,0))} detail="Ước tính từ đơn tải gần đây, không phải toàn bộ" tone="purple"/><Metric icon={CreditCard} title="Công nợ cần thu" value={allOutstanding===undefined?'Đang tải…':money(allOutstanding)} detail="Đơn đã giao/trả, không tính đặt trước" tone="blue"/><Metric icon={BadgeCheck} title="Đã hoàn tất gần đây" value={String(orders.filter(o=>o.status==='RETURNED').length)} detail="Trong dữ liệu tải gần đây" tone="green"/></div><div className="report-layout"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Dòng tiền thực thu</h3><p>Ghi nhận từ thao tác thu tiền của nhân viên, không tính doanh thu dự kiến.</p></div></div><div className="bar-chart">{chartRows.map((r,i)=><div key={r.key} className="bar-col"><div className="bar-value">{r.value?shortMoney(r.value):''}</div><div className={'bar '+(i===chartRows.length-1?'bar-highlight':'')} style={{height:Math.max(3,(r.value/chartMax)*195)+'px'}} title={r.key+' · '+money(r.value)}/><span>{r.label}</span></div>)}</div></section><section className="panel top-products"><div className="panel-heading"><div><h3>Sản phẩm được thuê nhiều</h3><p>Tính theo số lượt đặt không bị hủy</p></div></div>{items.map(i=>({item:i,count:liveOrders.filter(o=>o.lines.some(l=>l.itemId===i.id)).length})).sort((a,b)=>b.count-a.count).slice(0,5).map((x,idx)=><div className="rank-row" key={x.item.id}><span className="rank-num">{String(idx+1).padStart(2,'0')}</span><span className="mini-item-icon"><Shirt size={17}/></span><div><strong>{x.item.name}</strong><small>{x.item.category}</small></div><b>{x.count} lượt</b></div>)}{!items.length&&<Empty small text="Chưa có sản phẩm để thống kê."/>}</section></div></>}
        </>}
      </div>
    </main>
    <nav className="gu-main-bottom-nav" aria-label="Điều hướng GU trên điện thoại">
      <button type="button" aria-current={page==='overview'?'page':undefined} onClick={()=>{setPage('overview');setQuery('');setMobileNav(false);}}><LayoutDashboard size={21}/><span>Hôm nay</span></button>
      <button type="button" aria-current={page==='calendar'?'page':undefined} onClick={()=>{setPage('calendar');setQuery('');setMobileNav(false);}}><CalendarDays size={21}/><span>Lịch thuê</span></button>
      <button type="button" className="gu-mobile-create" aria-label="Tạo đơn mới" onClick={()=>openBooking('PICKUP')}><Plus size={25}/><span>Tạo đơn</span></button>
      <button type="button" aria-current={page==='orders'?'page':undefined} onClick={()=>{setPage('orders');setQuery('');setMobileNav(false);}}><ShoppingBag size={21}/><span>Đơn thuê</span></button>
      <button type="button" aria-expanded={mobileNav} aria-label="Mở tất cả chức năng" onClick={()=>setMobileNav(true)}><Menu size={21}/><span>Thêm</span></button>
    </nav>


    {captureId&&<GuOrderCapture orderId={captureId} api={api} onClose={()=>setCaptureId(null)} onDone={async()=>{await refresh();setCalendarReload(x=>x+1);setToast('Đã lưu ảnh kiểm nhận.');}}/>}
    {evidenceItem&&data?.me.role==='admin' &&<GuEvidenceHistory item={evidenceItem} api={api} onClose={()=>setEvidenceItem(null)}/>}
    {calendarMatches&&<div className="modal-overlay"><div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Các lượt thuê cùng ngày"><div className="modal-heading"><h2>{calendarMatches.length} lượt thuê trong ngày</h2><button className="icon-btn" onClick={()=>setCalendarMatches(null)}><X size={19}/></button></div><div className="modal-body">{calendarMatches.map(o=><button type="button" key={o.id} className="gu-v5-job" onClick={()=>{setCalendarMatches(null);openDetail(o);}}><b>{o.code} · {o.customerName}</b><span>{o.pickupAt?new Date(o.pickupAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):prettyDay(o.pickupDate)} → {o.returnAt?new Date(o.returnAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):prettyDay(o.returnDate)}</span><strong>Xem →</strong></button>)}</div></div></div>}
    {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal(null)}}><div className={'modal '+(modal==='booking'||modal==='detail'?'modal-wide':'')} role="dialog" aria-modal="true" aria-label="Biểu mẫu"><div className="modal-heading"><div><div className="eyebrow">GU - THUÊ ĐỒ XINH</div><h2>{modal==='booking'?(bookingMode==='RESERVE'?'Đặt lịch thuê trước':'Tạo đơn · chờ chụp ảnh giao'):modal==='item'?(editingItem?'Sửa sản phẩm':'Thêm sản phẩm'):modal==='customer'?'Thêm khách hàng':modal==='category'?(editingCategory?'Sửa danh mục':'Thêm danh mục'):'Chi tiết đơn thuê'}</h2></div><button className="icon-btn close-btn" onClick={()=>setModal(null)} aria-label="Đóng"><X size={20}/></button></div>
      {modal==='item'&&<form onSubmit={e=>{e.preventDefault();if(items.some(i=>i.id!==editingItem&&normalizeProductName(i.name)===normalizeProductName(newItem.name))){setItemError('Tên sản phẩm đã tồn tại.');return;}setItemError('');void action(editingItem?'items/'+editingItem:'items',editingItem?{action:'EDIT',...newItem,referenceShots:Object.fromEntries(Object.entries(newItem.referenceShots).filter(([,url])=>Boolean(url)))}:{...newItem,referenceShots:Object.fromEntries(Object.entries(newItem.referenceShots).filter(([,url])=>Boolean(url)))},editingItem?'Đã sửa sản phẩm.':'Đã nhập kho sản phẩm.',editingItem?'PATCH':'POST');}} className="modal-body">{itemError&&<div className="inline-alert danger-alert" role="alert">{itemError}</div>}<div className="form-grid">
        <Field label="Tên sản phẩm" full><input required className="input" placeholder="Tên sản phẩm" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/></Field>
        <Field label="Danh mục"><select className="input" value={newItem.category} onChange={e=>{const category=e.target.value;setNewItem(v=>({...v,category,requiresLaundry:!isNonLaundryCategory(category),cameraModel:category==='Máy ảnh'?(v.cameraModel||'Canon EOS R50'):'',name:category==='Máy ảnh'?(v.cameraModel||'Canon EOS R50'):v.name}));}}>{categorySelectOptions((data?.categories||[]).map(c=>c.name),newItem.category).map(x=><option key={x}>{x}</option>)}</select></Field>
        {newItem.category==='Máy ảnh'&&<><Field label="Mẫu máy"><select className="input" disabled={Boolean(editingItem)} value={newItem.cameraModel} onChange={e=>setNewItem({...newItem,cameraModel:e.target.value,name:e.target.value})}><option value="Canon EOS R50">Canon EOS R50</option><option value="Canon M50">Canon M50</option></select></Field><Field label="Serial thân máy"><input required className="input" disabled={Boolean(editingItem)} value={newItem.cameraSerial} onChange={e=>setNewItem({...newItem,cameraSerial:e.target.value.toUpperCase()})} placeholder="Số serial trên thân máy"/></Field></>}
        
        <Field label="Màu sắc"><input className="input" value={newItem.color} onChange={e=>setNewItem({...newItem,color:e.target.value})}/></Field>
        <Field label="Giá thuê"><strong>{newItem.category==='Máy ảnh'?(newItem.cameraModel==='Canon M50'?'3h 90k · 6h 110k · 24h 180k · 48h 340k':'3h 110k · 6h 130k · 24h 190k · 48h 350k'):(/phụ\s*kiện/i.test(newItem.category)?'20.000đ / chu kỳ đầu':'50.000đ / chu kỳ đầu')+' · Các chu kỳ sau theo bảng giá GU'}</strong></Field>
        {!isNonLaundryCategory(newItem.category)&&<Field label="Yêu cầu giặt sau thuê"><span className="gu-check-option"><input type="checkbox" checked={newItem.requiresLaundry} onChange={e=>setNewItem({...newItem,requiresLaundry:e.target.checked})}/> Trả xong tự chuyển Đang giặt; bấm “Đã giặt” mới cho thuê tiếp</span></Field>}
        {data?.me.role==='admin'&&<Field label="Giá trị đền bù (VND)"><GuMoneyInput required className="input" placeholder="Nhập giá trị đền bù" maxLength={17} value={newItem.replacementValue||''} onValueChange={raw=>setNewItem({...newItem,replacementValue:Number(raw)})}/></Field>}
        {data?.me.role==='admin'&&<Field label="Các góc ảnh bắt buộc khi giao/nhận" full><div className="gu-angle-editor"><div className="gu-angle-input-row"><input className="input" value={angleDraft} maxLength={70} placeholder="Nhập tên góc chụp" onChange={e=>setAngleDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addAngle();}}}/><button className="btn btn-white" type="button" disabled={newItem.inspectionAngles.length>=10} onClick={addAngle}><Plus size={16}/> Thêm góc chụp</button></div>{newItem.inspectionAngles.map(angle=><div key={angle} className="gu-angle-added"><span>{angle}</span><button className="icon-btn" type="button" aria-label={'Xóa góc '+angle} onClick={()=>setNewItem(v=>({...v,inspectionAngles:v.inspectionAngles.filter(x=>x!==angle),referenceShots:Object.fromEntries(Object.entries(v.referenceShots).filter(([key])=>key!==angle))}))}><X size={16}/></button></div>)}{newItem.inspectionAngles.length>0&&<button type="button" className="btn btn-white" onClick={()=>setNewItem(v=>({...v,inspectionAngles:[],referenceShots:{}}))}>Xóa tất cả góc chụp</button>}</div></Field>}
        </div>{data?.me.role==='admin'&&<div className="photos-form"><strong>Ảnh mẫu theo góc chụp (tùy chọn)</strong><div className="gu-v5-reference-grid">{newItem.inspectionAngles.map(angle=><section key={angle} className="gu-v5-angle"><b>{angle}</b><ImageUploader paths={newItem.referenceShots[angle]?[newItem.referenceShots[angle]]:[]} onUploading={setImageUploading} onChange={paths=>setNewItem(v=>({...v,referenceShots:{...v.referenceShots,[angle]:paths[0]||''}}))}/></section>)}</div></div>}<div className="photos-form"><strong>Ảnh sản phẩm</strong><ImageUploader paths={newItem.imagePaths} onUploading={setImageUploading} onChange={paths=>setNewItem(v=>({...v,imagePaths:paths}))}/></div><div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>setModal(null)}>Hủy</button><button disabled={busy||imageUploading} className="btn btn-dark"><Check size={16}/> {editingItem?'Lưu thay đổi':'Lưu sản phẩm'}</button></div></form>}
      {modal==='customer'&&<form onSubmit={e=>{e.preventDefault();void action('customers',newCustomer,'Đã thêm khách hàng.');}} className="modal-body"><div className="form-grid"><Field label="Họ tên khách hàng" full><input className="input" required placeholder="Nguyễn Thị Mai" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})}/></Field><Field label="Số điện thoại"><input className="input" type="tel" required placeholder="09xxxxxxxx" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})}/></Field><Field label="Ghi chú" full><textarea className="input textarea" rows={3} placeholder="Sở thích, yêu cầu riêng…" value={newCustomer.note} onChange={e=>setNewCustomer({...newCustomer,note:e.target.value})}/></Field></div><div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>setModal(null)}>Hủy</button><button disabled={busy} className="btn btn-dark"><Plus size={17}/> Lưu khách hàng</button></div></form>}
      {modal==='booking'&&<GuV5Booking key={String(modal)+bookingMode+booking.pickupDate+booking.itemIds.join(':')}
        items={items} customers={customers} api={api} initial={booking} mode={bookingMode} onClose={()=>setModal(null)}
        onCustomerCreated={async()=>{await refresh();}}
        onCreated={id=>{if(bookingMode==='PICKUP')setCaptureId(id);}}
        onSuccess={async(message)=>{setToast(message);setModal(null);await refresh();}}/>}
      {modal==='category'&&<form className="modal-body" onSubmit={e=>{e.preventDefault();void action(editingCategory?'categories/'+editingCategory:'categories',{name:categoryName},editingCategory?'Đã sửa danh mục.':'Đã thêm danh mục.',editingCategory?'PATCH':'POST');}}><label className="form-field"><span>Tên danh mục</span><input className="input" required maxLength={50} value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Ví dụ: Đầm dự tiệc, Túi xách, Phụ kiện tóc…"/></label>{categories.length>0&&<div className="gu-category-manager"><strong>Danh mục hiện có</strong>{categories.filter(c=>!LEGACY_DEFAULT_CATEGORIES.some(name=>name===c.name)).map(c=><div className="gu-category-row" key={c.id}><span>{c.name}</span>{data?.me.role==='admin'&&<button type="button" className="icon-btn" title="Sửa" onClick={()=>editCategory(c.id,c.name)}><Pencil size={16}/></button>}{data?.me.role==='admin'&&<button type="button" className="icon-btn gu-danger-icon" title="Xóa" onClick={()=>void removeCategory(c.id,c.name)}><Trash2 size={16}/></button>}</div>)}</div>}<div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>{setEditingCategory(null);setCategoryName('');}}>Tạo danh mục mới</button><button className="btn btn-dark" disabled={busy}>{editingCategory?'Lưu thay đổi':'Lưu danh mục'}</button></div></form>}
      {modal==='detail'&&selectedOrder&&(()=>{const o=orders.find(x=>x.id===selectedOrder.id)||selectedOrder;if(o.pricingVersion)return <GuV5OrderDetail order={o} items={items} api={api} isAdmin={data?.me.role==='admin'} onCapture={()=>{setModal(null);setCaptureId(o.id);}} onChanged={async()=>{setModal(null);await refresh();}}/>;return <div className="modal-body detail-body"><div className="detail-top"><div><span className="eyebrow">MÃ ĐƠN HÀNG</span><h3>{o.code}</h3></div><StatusBadge label={orderLabels[o.status]} status={o.status}/></div><div className="detail-info"><div><span>Khách hàng</span><strong>{o.customerName}</strong><a className="gu-detail-call" href={customerPhoneHref(o.customerPhone)}><PhoneCall size={14}/> {o.customerPhone} · Nhấn để gọi</a></div><div><span>Ngày thuê</span><strong>{prettyDay(o.pickupDate)} → {prettyDay(o.returnDate)}</strong><small>{o.rentalDays} ngày</small></div></div><div className="detail-creator"><span>Nhân viên tạo đơn</span><strong>{creatorName(o)}</strong></div><div className="detail-lines"><strong>Sản phẩm thuê</strong>{o.lines.map(l=><div className="detail-line" key={l.itemId}><ProductImage paths={items.find(i=>i.id===l.itemId)?.imagePaths}/><div><b>{l.name}</b><small>Mã sản phẩm: {items.find(i=>i.id===l.itemId)?.hangerCode||l.hangerCode||'Chưa cấp mã'}</small></div>{o.status!=='PICKED_UP'&&<strong>{money(l.lineTotal)}</strong>}</div>)}</div>{o.status==='PICKED_UP'&&<GuReturnFlow key={`${o.id}:${o.lines.length}:${o.total}`} order={o} items={items} today={today} busy={busy} onSubmit={async payload=>{
    const ok=await action('orders/'+o.id,{action:'RETURN',...payload},'Đã kiểm nhận và hoàn thành đơn trả hàng.','PATCH');
    if(ok)setSelectedOrder(null);
    return ok;
  }}/>}{(o.status==='RESERVED'||o.status==='PICKED_UP')&&o.returnDate>=today&&<section className="gu-v4-extension" aria-label="Gia hạn thuê đồ">
    <div className="gu-v4-extension-heading"><CalendarDays size={19}/><div><strong>Gia hạn ngày thuê</strong><small>Kiểm tra lịch trống và tính tiền phát sinh tự động; không sửa phí của đơn cũ.</small></div></div>
    <div className="gu-v4-extension-controls"><label>Ngày trả mới
      <input type="date" className="input" value={extendReturnDate} min={addDays(o.returnDate,1)} max={addDays(o.pickupDate,29)} onChange={e=>setExtendReturnDate(e.target.value)}/>
    </label><div className="gu-v4-extension-cost"><small>Tiền thuê thêm dự kiến</small><strong>{extendReturnDate>o.returnDate?(()=>{try {return money(daysInclusive(addDays(o.returnDate,1),extendReturnDate)*o.lines.reduce((v,l)=>v+l.dailyRate,0));}catch{return 'Ngoài giới hạn 30 ngày';}})():'—'}</strong></div>
    <button className="btn btn-dark" type="button" disabled={busy||!extendReturnDate||extendReturnDate<=o.returnDate||extendReturnDate>addDays(o.pickupDate,29)} onClick={()=>{if(confirm(`Gia hạn đơn ${o.code} đến ${prettyDay(extendReturnDate)}? Hệ thống sẽ khóa ngày mới và cộng tiền thuê.`))void action('orders/'+o.id,{action:'EXTEND',returnDate:extendReturnDate},'Đã gia hạn và giữ lịch mới thành công.','PATCH');}}>Gia hạn & kiểm tra lịch</button></div>
  </section>}
  <OrderAddItems order={o} items={items} api={api} onSuccess={async()=>{setToast("Đã thêm sản phẩm vào đơn.");await refresh();}}/>{o.status!=='PICKED_UP'&&<div className="payment-summary"><div><span>Giá thuê</span><strong>{money(o.total)}</strong></div><div><span>Tiền cọc cần thu</span><strong>{money(o.depositDue)}</strong></div>{(o.lateFeeTotal||0)>0&&<div><span>Phí trả trễ ({o.lateDays||0} ngày)</span><strong>{money(o.lateFeeTotal||0)}</strong></div>}{(o.otherFeeTotal||0)>0&&<div><span>Phụ thu khác</span><strong>{money(o.otherFeeTotal||0)}</strong></div>}{(o.compensationTotal||0)>0&&<div className="compensation-line"><span>Phí đền bù đồ thiếu</span><strong>{money(o.compensationTotal||0)}</strong></div>}<div><span>Đã thu</span><strong className="paid-text">{money(o.paid)}</strong></div><div className="payment-remaining"><span>Còn phải thu</span><strong>{money(dueAmount(o)-o.paid)}</strong></div></div>}{o.note&&<div className="detail-note">Ghi chú: {o.note}</div>}<div className="history"><strong>Hoạt động đơn hàng</strong>{o.history.map((h,i)=><div key={i} className="history-line"><span className="history-dot"/><div><b>{h.action==='EXTEND'?'Đã gia hạn ngày thuê':h.action==='ADD_ITEMS'?'Đã thêm đồ vào đơn':h.action==='RESERVED'?'Đã tạo & giữ chỗ':h.action==='PICKUP'?'Đã giao hàng':h.action==='RETURN'?'Đã nhận trả':h.action==='CANCEL'?'Đã hủy':'Ghi nhận thanh toán'}</b><small>{new Date(h.at).toLocaleString('vi-VN')} {h.amount?(' · '+money(h.amount)):''}</small></div></div>)}</div>{o.status==='RETURNED'&&o.returnInspection&&<div className="inspection-record"><strong>Biên bản nhận đồ</strong>{o.returnInspection.map(c=><p key={c.itemId}>{o.lines.find(l=>l.itemId===c.itemId)?.name||'Sản phẩm'}: {c.status==='OK'?'Đã nhận đủ':'THIẾU · '+money(c.compensation)}</p>)}</div>}{o.status==='RETURNED'&&o.lines.some(l=>items.some(i=>i.id===l.itemId&&i.status==='LAUNDRY'))&&<div className="gu-inline-box"><div className="gu-between"><strong><WashingMachine size={17}/> Đang giặt · xác nhận đã giặt để cho thuê lại</strong></div>{o.lines.map(l=>{const item=items.find(i=>i.id===l.itemId);return item?.status==='LAUNDRY'?<div className="gu-laundry-line" key={l.itemId}><span><strong>{l.name}</strong></span><button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+l.itemId,{action:'CLEAN'},'Đã giặt xong. Sản phẩm sẵn sàng cho thuê.','PATCH')}><CheckCircle2 size={15}/> Đã giặt</button></div>:null;})}</div>}{isOverdue(o)&&<div className="overdue-detail late-flash"><BellRing size={19}/> ĐƠN TRẢ TRỄ – quá hạn từ {prettyDay(o.returnDate)}</div>}{o.status!=='CANCELLED'&&<div className="detail-actions">{o.status!=='PICKED_UP'&&dueAmount(o)>o.paid&&<div className="pay-row"><GuMoneyInput className="input" maxLength={17} placeholder="Nhập số tiền thu" value={payAmount} onValueChange={setPayAmount}/><button className="btn btn-white" disabled={busy||Number(payAmount)<=0||Number(payAmount)>dueAmount(o)-o.paid} onClick={()=>void runOrderAction(o.id,'PAY',Number(payAmount))}><CreditCard size={16}/> Thu tiền</button></div>}{o.status==='RESERVED'&&<><button className="btn btn-dark" disabled={busy} onClick={()=>void runOrderAction(o.id,'PICKUP')}><ShoppingBag size={17}/> Xác nhận lấy hàng</button>{data?.me.role==='admin'&&<button className="btn btn-danger" disabled={busy||o.paid>0} title={o.paid>0?'Phải xử lý hoàn tiền trước khi hủy.':''} onClick={()=>{if(window.confirm('Hủy đơn và giải phóng toàn bộ lịch giữ hàng?'))void runOrderAction(o.id,'CANCEL');}}>Hủy đơn</button>}</>}</div>}</div>;})()}
      </div></div>}
  </div>;
}
function Field({label,full,children}:{label:string;full?:boolean;children:React.ReactNode}){return <label className={'form-field '+(full?'field-full':'')}><span>{label}</span>{children}</label>}
function StatusBadge({status,label}:{status:string;label:string}){const cls=['AVAILABLE','RETURNED'].includes(status)?'success':['PICKED_UP','RENTED'].includes(status)?'blue':status==='LAUNDRY'?'purple':status==='MAINTENANCE'?'slate':['CANCELLED','VOIDED','MISSING'].includes(status)?'danger':'amber';return <span className={'badge badge-'+cls}><i/>{label}</span>}
function Metric({icon:Icon,title,value,detail,tone}:{icon:typeof Wallet;title:string;value:string;detail:string;tone:string}){return <div className="metric"><div className="metric-top"><span className={'metric-icon '+tone}><Icon size={22} strokeWidth={1.8}/></span><ArrowUpRight size={17} color="#ada59d"/></div><span className="metric-name">{title}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>}
function Empty({text,small}:{text:string;small?:boolean}){return <div className={'empty '+(small?'small-empty':'')}><span className="empty-icon"><Package size={22}/></span><p>{text}</p></div>}
