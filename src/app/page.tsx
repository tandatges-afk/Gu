'use client';
import {safeCsv} from '@/lib/safe-csv';
import {categorySelectOptions,categoryApiPath,isNonLaundryCategory,LEGACY_DEFAULT_CATEGORIES} from '@/lib/product-policies';
import {normalizeProductName} from '@/lib/product-name';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithUsernameAndPassword, signOut, type User } from '@/lib/client-auth';
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
import {matchesInventoryCode} from '@/lib/catalog-code-search';
import {NEXT_DAY_RISK_START_HOUR_VN,tomorrowReturnRisk,vnClock as vnCurrentTime,type LatePickupAlert} from '@/lib/return-risk';
import {vnClock as vnDisplayHour} from '@/lib/gu-v52-workflow';
import {GuVisualFinder} from '@/components/GuVisualFinder';
import {GuV5Review,GuV5OrderDetail} from '@/components/GuV5Review';
import {GuEvidenceHistory} from '@/components/GuEvidenceHistory';
import {GuReturnFlow} from '@/components/GuReturnFlow';
import {GuSystem} from '@/components/GuSystem';
import {GuMoneyInput} from '@/components/GuMoneyInput';
import {GuBulkInventory} from '@/components/GuBulkInventory';
import {GuPwaSetup,GuInstallApp} from '@/components/GuPwa';
import {GuStaffShifts} from '@/components/GuStaffShifts';
import {calendarItemState,type CalendarFilter} from '@/lib/smart-calendar';
import {getProductCode} from '@/lib/hanger-code';
import {orderCreatorName} from '@/lib/order-creator';
import {formatVNDateTime} from '@/lib/vn-datetime';
import {pickupForDisplay} from '@/lib/order-pickup-presentation';
import {GuVNDateInput} from '@/components/GuVNDateTimeInput';
import {imageSignature} from '@/lib/visual-image';
import {GuInventoryFilters} from '@/components/GuInventoryFilters';
import inventoryLayout from '@/components/GuInventoryTable.module.css';
import {isCameraCategory} from '@/lib/camera-rental';
import {orderGroup,productGroup,type RentalGroup} from '@/lib/order-group';
import {cameraLateAlert,cameraLiveQuote} from '@/lib/camera-live-status';
import calendarUi from '@/components/GuCalendarTimeline.module.css';
import bookingStyle from '@/components/GuV5Booking.module.css';
import {calendarDayTone,calendarSlotState,sortCalendarProductsForDay} from '@/lib/calendar-presentation';

type Page = 'visual'|'reviews'|'overview'|'calendar'|'camera-calendar'|'orders'|'inventory'|'laundry'|'customers'|'reports'|'staff'|'shifts'|'audit'|'system';
type Modal = 'booking'|'item'|'customer'|'category'|'detail'|null;
type Availability = { available:boolean;conflicts:{itemId:string;sku:string;date:string}[];reason:string };

const nav: {id:Page;label:string;icon:typeof LayoutDashboard}[] = [
  {id:'overview',label:'Tổng quan',icon:LayoutDashboard},
  {id:'visual',label:'Tìm bằng ảnh',icon:Search},
  {id:'reviews',label:'Duyệt ảnh giao nhận',icon:ClipboardCheck},
  {id:'calendar',label:'Lịch cho thuê',icon:CalendarDays},
  {id:'camera-calendar',label:'Lịch máy ảnh',icon:Clock3},
  {id:'orders',label:'Đơn thuê',icon:ShoppingBag},
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
  {label:'ĐƠN HÀNG',ids:['overview','calendar','camera-calendar','orders','customers']},
  {label:'KHO SẢN PHẨM',ids:['inventory','visual','laundry']},
  {label:'LỊCH NHÂN SỰ',ids:['shifts']},
  {label:'QUẢN TRỊ',ids:['reviews','reports','staff','audit','system']}
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
  const pickup=vnDisplayHour(pickupForDisplay(order));
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
  const [shiftSession,setShiftSession]=useState<{role:'admin'|'staff';name:string;access:'WORK'|'REGISTER'|'DENIED';message:string|null;shift?:{allowedUntil:string|null;grace:boolean;activeSlot:string|null;shiftEndedAt:string|null}|null}|null>(null);
  const [authErr,setAuthErr]=useState('');
  const [loginUsername,setLoginUsername]=useState('');
  const [loginPassword,setLoginPassword]=useState('');
  const [showLoginPassword,setShowLoginPassword]=useState(false);
  const [loginPending,setLoginPending]=useState(false);
  const [data,setData]=useState<DashboardData|null>(null);
  const [taskOrders,setTaskOrders]=useState<RentalOrder[]>([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [itemError,setItemError]=useState('');
  const [inventoryTab,setInventoryTab]=useState<'list'|'bulk'>('list');
  const [toast,setToast]=useState('');
  const [page,setPage]=useState<Page>('overview');
  // Do not carry a failed category-edit alert onto an unrelated screen.
  useEffect(()=>{setErr('');},[page]);
  const [visitedPages,setVisitedPages]=useState<Set<Page>>(()=>new Set<Page>(['overview']));
  useEffect(()=>setVisitedPages(old=>old.has(page)?old:new Set([...old,page])),[page]);
  const [mobileNav,setMobileNav]=useState(false);
  const [modal,setModal]=useState<Modal>(null);
  const [calendarMatches,setCalendarMatches]=useState<RentalOrder[]|null>(null);
  const [calendarProductPeek,setCalendarProductPeek]=useState<InventoryItem|null>(null);
  const [selectedOrder,setSelectedOrder]=useState<RentalOrder|null>(null);
  const [captureId,setCaptureId]=useState<string|null>(null);
  const [remoteRisks,setRemoteRisks]=useState<Array<{itemId:string;heldOrderId:string;nextOrderId:string}>>([]);
  const [dismissedRiskSignature,setDismissedRiskSignature]=useState('');
  const [remoteLatePickups,setRemoteLatePickups]=useState<LatePickupAlert[]>([]);
  const [dismissedPickupSignature,setDismissedPickupSignature]=useState('');
  const [pickupAlertsExpanded,setPickupAlertsExpanded]=useState(false);
  const [evidenceItem,setEvidenceItem]=useState<InventoryItem|null>(null);
  const [busy,setBusy]=useState(false);
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
  const [nearestLoading,setNearestLoading]=useState<string|null>(null);
  const [nearestResult,setNearestResult]=useState<{itemId:string;nextPickupDate:string|null;nextReturnDate:string|null;reason:string}|null>(null);
  const [taskView,setTaskView]=useState<'ALL'|'PICKUP_TODAY'|'RETURN_TODAY'|'OVERDUE'>('ALL');
  const [categoryName,setCategoryName]=useState('');
  const [inventoryCategory,setInventoryCategory]=useState('ALL');
  const [bookingMode,setBookingMode]=useState<'RESERVE'|'PICKUP'>('RESERVE');
  const [bookingGroup,setBookingGroup]=useState<RentalGroup>('CLOTHING');
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',note:''});
  const [booking,setBooking]=useState({customerId:'',itemIds:[] as string[],pickupDate:vietnamToday(),returnDate:vietnamToday(),pickupHour:'',returnHour:'',depositDue:0,note:''});
  const [payAmount,setPayAmount]=useState('');
  const [extendReturnDate,setExtendReturnDate]=useState('');
  const [imageUploading,setImageUploading]=useState(false);
  const [clockTick,setClockTick]=useState(0);
  const [notificationsEnabled,setNotificationsEnabled]=useState(false);
  const [laundryRemote,setLaundryRemote]=useState<InventoryItem[]>([]);
  const [laundryLoaded,setLaundryLoaded]=useState(false);
  const [laundryReload,setLaundryReload]=useState(0);
  const [catalogReload,setCatalogReload]=useState(0);
  const [catalogData,setCatalogData]=useState<{kind:string;results:Array<InventoryItem|Customer|RentalOrder>;cursor:string|null;hasMore:boolean}|null>(null);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [catalogCursor,setCatalogCursor]=useState<string|null>(null);
  const [catalogQuery,setCatalogQuery]=useState('');
  // Per-session stale-while-revalidate cache: revisiting a tab renders its previous
  // result immediately, then refreshes only if stale; mutations invalidate it.
  const tabCacheRef=useRef(new Map<string,{value:unknown;at:number}>());
  const [minuteTick,setMinuteTick]=useState(0);
  const cached=<T,>(key:string,ttl=60_000):{value:T;fresh:boolean}|null=>{
    const row=tabCacheRef.current.get(key);
    return row?{value:row.value as T,fresh:Date.now()-row.at<ttl}:null;
  };
  const saveCache=(key:string,value:unknown)=>{tabCacheRef.current.set(key,{value,at:Date.now()});};



  useEffect(()=>{
    try {return onAuthStateChanged(clientAuth(),u=>{setUser(u);setAuthReady(true);if(!u){setData(null);setShiftSession(null);wasWorkingRef.current=false;dashboardLoadedRef.current=false;tabCacheRef.current.clear();}},()=>{setAuthErr('Không kết nối được với GU VPS. Kiểm tra dịch vụ.');setAuthReady(true);});}
    catch(e){setAuthErr(e instanceof Error?e.message:'Lỗi xác thực GU VPS.');setAuthReady(true);}
  },[]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4800);return()=>clearTimeout(id);},[toast]);
  useEffect(()=>{if(!modal&&!mobileNav)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(mobileNav)setMobileNav(false);else if(!busy)setModal(null);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[modal,mobileNav,busy]);

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
        setData(null);tabCacheRef.current.clear();setAuthErr(access.message||'Bạn không có ca làm việc lúc này.');
        await signOut(clientAuth());return false;
      }
      if(access.access==='REGISTER'){
        // Someone leaving a working shift must be signed out 15 minutes later.
        // A fresh Sunday login may use only the registration screen.
        if(wasWorkingRef.current){
          setAuthErr('Ca làm đã kết thúc hơn 15 phút. Bạn đã được đăng xuất tự động.');
          await signOut(clientAuth());return false;
        }
        dashboardLoadedRef.current=false;tabCacheRef.current.clear();
        setData(null);setPage('shifts');setErr('');return false;
      }
      if(access.role==='staff')wasWorkingRef.current=true;
      if(loadDashboard||!dashboardLoadedRef.current){
        setData(await api<DashboardData>('bootstrap'));dashboardLoadedRef.current=true;setErr('');
      }
      return true;
    }catch(e){setErr(e instanceof Error?e.message:'Không thể kiểm tra ca làm việc.');return false;}
  },[api]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    tabCacheRef.current.clear();
    setCatalogReload(v=>v+1);setCalendarReload(v=>v+1);setLaundryReload(v=>v+1);
    try{await sessionCheck(true);}finally{setLoading(false);}
  },[sessionCheck]);
  useEffect(()=>{if(user)void refresh();},[user,refresh]);
  useEffect(()=>{if(!user)return;const interval=setInterval(()=>{if(document.visibilityState==='visible'){setClockTick(t=>t+1);void refresh();}},900_000);return()=>clearInterval(interval);},[user,refresh]);
  useEffect(()=>{const timer=setInterval(()=>setMinuteTick(n=>n+1),60_000);return()=>clearInterval(timer);},[]);
  // Check every 20s, not only on refresh. This also signs staff out within 20s
  // of the 15-minute post-shift grace expiring. Server APIs always enforce it.
  useEffect(()=>{if(!user)return;const timer=setInterval(()=>{void sessionCheck();},20_000);return()=>clearInterval(timer);},[user,sessionCheck]);
  useEffect(()=>{
    if(!user||page!=='overview')return;
    let cancel=false;
    const key='tasks:'+user.uid+':'+catalogReload;const prior=cached<RentalOrder[]>(key);
    if(prior){setTaskOrders(prior.value);if(prior.fresh)return;}
    api<{orders:RentalOrder[]}>('tasks').then(r=>{saveCache(key,r.orders);if(!cancel)setTaskOrders(r.orders);}).catch(e=>{if(!cancel)setErr(e instanceof Error?e.message:'Không tải được việc hôm nay.');});
    return()=>{cancel=true;};
  },[user,page,api,clockTick,minuteTick,catalogReload]);

  useEffect(()=>{
    if(!user||!data||!['inventory','customers','orders'].includes(page))return;
    const kind=page==='inventory'?'items':page==='customers'?'customers':'orders';
    const key=['catalog',user.uid,kind,query.trim(),kind==='items'?itemStatus:'ALL',kind==='items'?inventoryCategory:'ALL',kind==='orders'?'ALL':'ALL',catalogCursor||'first',catalogReload].join(':');
    type CatalogPage={kind:string;results:Array<InventoryItem|Customer|RentalOrder>;cursor:string|null;hasMore:boolean};
    const previous=cached<CatalogPage>(key);
    if(previous){setCatalogData(previous.value);setCatalogLoading(false);if(previous.fresh)return;}
    let cancelled=false;
    const timer=setTimeout(()=>{
      if(!previous)setCatalogLoading(true);
      api<CatalogPage>('catalog?kind='+kind+'&size=40'+(query.trim()?'&q='+encodeURIComponent(query.trim()):'')+(kind==='items'?'&status='+encodeURIComponent(itemStatus)+'&category='+encodeURIComponent(inventoryCategory):kind==='orders'?'&rentalGroup=ALL':'')+(catalogCursor?'&cursor='+encodeURIComponent(catalogCursor):''))
        .then(result=>{saveCache(key,result);if(!cancelled){setCatalogData(result);setErr('');}})
        .catch(e=>{if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được danh sách.');})
        .finally(()=>{if(!cancelled)setCatalogLoading(false);});
    },previous?0:240);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[user,data?.me.uid,page,query,itemStatus,inventoryCategory,catalogCursor,catalogReload,api,minuteTick]);
  useEffect(()=>{setCatalogCursor(null);},[page,query,itemStatus,inventoryCategory]);
  useEffect(()=>{
    if(!user||page!=='laundry')return;
    const key='laundry:'+user.uid+':'+laundryReload;
    const previous=cached<InventoryItem[]>(key);
    if(previous){setLaundryRemote(previous.value);setLaundryLoaded(true);if(previous.fresh)return;}
    let cancelled=false;if(!previous)setLaundryLoaded(false);
    (async()=>{try{
      const all:InventoryItem[]=[];let cursor:string|null=null;
      for(let i=0;i<10;i++){
        const r:{items:InventoryItem[];cursor:string|null}=await api<{items:InventoryItem[];cursor:string|null}>('stock-state?status=LAUNDRY'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
        all.push(...r.items);cursor=r.cursor;if(!cursor)break;
        if(i===9)throw new Error('Vượt 1.000 đồ cần giặt. Hãy xử lý theo từng đợt.');
      }
      saveCache(key,all);if(!cancelled){setLaundryRemote(all);setLaundryLoaded(true);}
    }catch(e){if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được danh sách giặt.');}})();
    return()=>{cancelled=true;};
  },[user,page,laundryReload,api,minuteTick]);
  useEffect(()=>{
    if(!user||data?.me.role!=='admin'||!['overview','reports'].includes(page))return;
    const key='reports:'+user.uid;const previous=cached<{rows:{date:string;amount:number;payments:number}[];note:string}>(key);
    if(previous){setReportDaily(previous.value.rows);setReportNote(previous.value.note);if(previous.fresh)return;}
    let cancelled=false;
    api<{rows:{date:string;amount:number;payments:number}[];note:string}>('reports')
      .then(r=>{saveCache(key,r);if(!cancelled){setReportDaily(r.rows);setReportNote(r.note);}})
      .catch(e=>{if(!cancelled)setReportNote(e instanceof Error?e.message:'Chưa có báo cáo.');});
    return()=>{cancelled=true;};
  },[user,data?.me.role,page,api,minuteTick]);
  // The two calendars have separate catalog pages and visible stock classes.
  // Clear stale rows when switching between clothing/accessories and cameras.
  useEffect(()=>{
    setCalendarRemote([]);setCalendarOrderRows(null);setCalendarLoaded(false);
    setCalendarNext(null);setCalendarPageCursor(null);setCalendarCategory('ALL');
    setCalendarCreator('ALL');setNearestResult(null);
  },[page]);
  useEffect(()=>{
    if(!user||!['calendar','camera-calendar'].includes(page))return;
    const key=['cal-items',user.uid,page,calendarQuery.trim(),calendarPageCursor||'first',catalogReload].join(':');
    type CalPage={results:InventoryItem[];cursor:string|null};
    const previous=cached<CalPage>(key);
    if(previous){setCalendarRemote(previous.value.results.filter(i=>!i.archivedAt));setCalendarLoaded(true);setCalendarNext(previous.value.cursor);if(previous.fresh)return;}
    let cancelled=false;
    const timer=setTimeout(()=>{
      const url='catalog?kind=items&size=25&rentalGroup='+(page==='camera-calendar'?'CAMERA':'CLOTHING')+(calendarQuery.trim()?'&q='+encodeURIComponent(calendarQuery.trim()):'')+(calendarPageCursor?'&cursor='+encodeURIComponent(calendarPageCursor):'');
      api<CalPage>(url).then(r=>{saveCache(key,r);if(!cancelled){setCalendarRemote(r.results.filter(i=>!i.archivedAt));setCalendarLoaded(true);setCalendarNext(r.cursor);}})
        .catch(e=>{if(!cancelled)setErr(e instanceof Error?e.message:'Không tải được sản phẩm lịch.');});
    },previous?0:200);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[user,page,calendarQuery,calendarPageCursor,catalogReload,api,minuteTick]);
  useEffect(()=>{setCalendarPageCursor(null);},[calendarQuery]);
  useEffect(()=>{
    if(!user||!['calendar','camera-calendar'].includes(page)||!calendarRemote.length)return;
    let cancelled=false;
    const ids=calendarRemote.map(i=>i.id).slice(0,30).join(',');
    const key=['cal-orders',user.uid,page,calendarStart,ids,calendarReload].join(':');
    const previous=cached<RentalOrder[]>(key);
    if(previous){setCalendarOrderRows(previous.value);if(previous.fresh)return;}
    api<{orders:RentalOrder[]}>('calendar?start='+encodeURIComponent(calendarStart)+'&ids='+encodeURIComponent(ids))
      .then(r=>{saveCache(key,r.orders);if(!cancelled)setCalendarOrderRows(r.orders);})
      .catch(e=>{if(!cancelled)setErr(e instanceof Error?e.message:'Không lấy được khóa lịch.');});
    return()=>{cancelled=true;};
  },[user,page,calendarStart,calendarRemote,calendarReload,api,minuteTick]);
  useEffect(()=>{if(!user){setRemoteLatePickups([]);return;}let live=true;
    const pull=async()=>{try{
      const r=await api<{risks:Array<{itemId:string;heldOrderId:string;nextOrderId:string}>;latePickups:LatePickupAlert[]}>('v5/return-risk');
      if(live){setRemoteRisks(r.risks);setRemoteLatePickups(r.latePickups||[]);}
    }catch{/* A failed notification request must not block rentals; next refresh will retry. */}};
    void pull();return()=>{live=false;};
  },[user,api,minuteTick,catalogReload]);
  const items=(data?.items||[]).filter(i=>!i.archivedAt);
  const customers=data?.customers||[];
  const orders=Array.from(new Map([...(data?.orders||[]),...taskOrders].map(o=>[o.id,o] as const)).values());
  const categories=data?.categories||[];
  const today=vietnamToday();
  // From 20:00 VN, show cross-order stock risks; independent of overdue pickup alerts.
  const {hour:vnHour}=vnCurrentTime(new Date());
  const riskRows=vnHour>=NEXT_DAY_RISK_START_HOUR_VN?[...tomorrowReturnRisk(orders,new Date()),...remoteRisks]:[];
  const riskIds=new Set(riskRows.map(r=>r.itemId));
  const riskSignature=today+'|'+[...riskIds].sort().join('|');
  // Show server alerts even for bookings outside the paginated dashboard cache.
  const latePickups=remoteLatePickups;
  const latePickupIds=new Set(latePickups.map(a=>a.orderId));
  const latePickupSignature=latePickups.map(a=>a.orderId+':'+(a.scheduledAt||a.pickupDate)).sort().join('|');
  const openLatePickupSearch=(code:string)=>{setPage('orders');setQuery(code);setOrderStatus('RESERVED');setTaskView('ALL');setMobileNav(false);};

  const liveOrders=orders.filter(o=>o.status!=='CANCELLED');
  const active=liveOrders.filter(o=>o.status==='RESERVED'||o.status==='PICKED_UP');
  const picked=orders.filter(o=>o.status==='PICKED_UP');
  const dueToday=orders.filter(o=>o.returnDate===today&&o.status==='PICKED_UP');
  const overdueOrders=orders.filter(o=>o.status==='PICKED_UP'&&(o.returnDate<today||cameraLateAlert(o,Date.now())));
  const isOverdue=(o:RentalOrder)=>o.status==='PICKED_UP'&&(orderGroup(o)==='CAMERA'?Boolean(cameraLateAlert(o,Date.now())):o.returnDate<today);
  const dueAmount=(o:RentalOrder)=>o.total+(o.compensationTotal||0)+(o.lateFeeTotal||0)+(o.otherFeeTotal||0);
  const collected=reportDaily?.reduce((s,o)=>s+o.amount,0);
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
  const filteredItems=(page==='inventory'&&catalogData?.kind==='items'?catalogData.results as InventoryItem[]:items).filter(i=>!i.archivedAt).filter(i=>(itemStatus==='ALL'||i.status===itemStatus)&&(inventoryCategory==='ALL'||inventoryCategory===i.category)&&(!query||search(i.name+' '+i.size+' '+i.color+' '+i.category+' '+(i.hangerCode||''))||matchesInventoryCode(i.hangerCode,query)));
  const filteredCustomers=(page==='customers'&&catalogData?.kind==='customers'?catalogData.results as Customer[]:customers).filter(c=>!query||search(c.name+' '+c.phone)||Boolean(query.replace(/\D/g,'')&&c.phone.replace(/\D/g,'').includes(query.replace(/\D/g,''))));
  const nameFromId=(id:string)=>items.find(i=>i.id===id)?.name||'Sản phẩm đã xóa';
  const statusClass=(s:string)=>['AVAILABLE','RETURNED'].includes(s)?'success':['PICKED_UP','RENTED'].includes(s)?'blue':s==='LAUNDRY'?'purple':s==='MAINTENANCE'?'slate':['CANCELLED','MISSING'].includes(s)?'danger':'amber';
  const action=async(path:string,body:unknown,success:string,method='POST')=>{
    setBusy(true);try{await api(path,{method,body:JSON.stringify(body)});setToast(success);setModal(null);await refresh();return true;}
    catch(e){const message=e instanceof Error?e.message:'Lỗi thao tác.';setErr(message);if(modal==='item')setItemError(message);return false;}
    finally{setBusy(false);}
  };
  const saveStockItem=async()=>{
   if(items.some(i=>i.id!==editingItem&&normalizeProductName(i.name)===normalizeProductName(newItem.name))){setItemError('Tên sản phẩm đã tồn tại.');return;}
   setItemError('');
   // Index all available product views instead of only the cover image.
   // A failed Cloudinary/CORS read must not prevent inventory management.
   const signatures=(await Promise.all(newItem.imagePaths.slice(0,5).map(async imagePath=>{
     try{return {imagePath,signature:await imageSignature(imagePath)};}
     catch{return null;}
   }))).filter((row):row is NonNullable<typeof row>=>row!==null);
   if(newItem.imagePaths.length>signatures.length)setToast(`${newItem.imagePaths.length-signatures.length} ảnh chưa lập được chỉ mục. Admin có thể bổ sung sau.`);
   const payload={...newItem,visualSignatures:signatures,referenceShots:Object.fromEntries(Object.entries(newItem.referenceShots).filter(([,url])=>Boolean(url)))};
   await action(editingItem?'items/'+editingItem:'items',editingItem?{action:'EDIT',...payload}:payload,editingItem?'Đã sửa sản phẩm.':'Đã nhập kho sản phẩm.',editingItem?'PATCH':'POST');
  };
  const openModal=(m:Modal)=>{setItemError('');if(m==='item'){setAngleDraft('');setEditingItem(null);setNewItem({name:'',category:'Phụ kiện',size:'Một size',color:'',dailyRate:20000,requiresLaundry:false,cameraModel:'',cameraSerial:'',replacementValue:0,inspectionAngles:[],referenceShots:{},imagePaths:[]});}if(m==='category'){setEditingCategory(null);setCategoryName('');}setErr('');setModal(m);};
  const editItem=(i:InventoryItem)=>{setItemError('');setAngleDraft('');setEditingItem(i.id);setNewItem({name:i.name,category:i.category,size:i.size,color:i.color,dailyRate:i.dailyRate,cameraModel:i.cameraModel||'',cameraSerial:i.cameraSerial||'',requiresLaundry:i.requiresLaundry??i.bufferDays>0,replacementValue:i.replacementValue,inspectionAngles:i.inspectionAngles||[],referenceShots:i.referenceShots||{},imagePaths:i.imagePaths||[]});setErr('');setModal('item');};
  const addAngle=()=>{const angle=angleDraft.trim();if(!angle)return;if(newItem.inspectionAngles.includes(angle)){setErr('Góc chụp đã tồn tại.');return;}if(newItem.inspectionAngles.length>=10){setErr('Mỗi sản phẩm tối đa 10 góc chụp.');return;}setNewItem(v=>({...v,inspectionAngles:[...v.inspectionAngles,angle]}));setAngleDraft('');setErr('');};
   const editCategory=(id:string,name:string)=>{setEditingCategory(id);setCategoryName(name);setErr('');setModal('category');};
  const removeItem=async(i:InventoryItem)=>{if(!confirm(`Lưu trữ sản phẩm ${i.name}? Các đơn lịch sử vẫn được giữ nguyên.`))return;setBusy(true);try{await api('items/'+i.id,{method:'DELETE'});setToast('Đã lưu trữ sản phẩm.');await refresh();}catch(e){setErr(e instanceof Error?e.message:'Không thể xóa sản phẩm.');}finally{setBusy(false);}};
  const removeCategory=async(id:string,name:string)=>{if(!confirm(`Xóa danh mục ${name}? Hệ thống sẽ kiểm tra sản phẩm liên quan trước khi xóa.`))return;setErr('');setBusy(true);try{await api(categoryApiPath(id),{method:'DELETE'});setToast('Đã xóa danh mục.');await refresh();}catch(e){setErr(e instanceof Error?e.message:'Không thể xóa danh mục.');}finally{setBusy(false);}};
  const openBooking=(mode:'RESERVE'|'PICKUP',itemId?:string,date?:string,endDate?:string,pickupHour='',returnHour='',explicitGroup?:RentalGroup)=>{const actualMode=date?(date===today?'PICKUP':'RESERVE'):mode;if(date&&date<today){setErr('Không thể tạo lịch thuê trong quá khứ.');return;}setBookingMode(actualMode);setBookingGroup(explicitGroup||(itemId?(items.find(item=>item.id===itemId)?productGroup(items.find(item=>item.id===itemId)!.category):'CLOTHING'):page==='camera-calendar'?'CAMERA':'CLOTHING'));setBooking({customerId:'',itemIds:itemId?[itemId]:[],pickupDate:date||today,returnDate:endDate||date||today,pickupHour,returnHour,depositDue:0,note:''});openModal('booking');};
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
  const calendarOverdue=calendarActive.filter(o=>o.status==='PICKED_UP'&&(o.returnDate<today||cameraLateAlert(o,Date.now())));
  const cameraOverdueOrders=calendarActive.filter(o=>cameraLateAlert(o,Date.now()));
  const calendarCreators=Array.from(new Map(calendarActive.filter(o=>Boolean(o.createdBy)).map(o=>[o.createdBy,orderCreatorName(o,data?.staffNames)] as const)).entries()).sort((a,b)=>a[1].localeCompare(b[1],'vi'));
  const creatorName=(o:RentalOrder)=>orderCreatorName(o,data?.staffNames);
  const calendarBaseItems=calendarLoaded?calendarRemote:items.slice(0,25);
  const calendarSearchPool=calendarQuery.trim()?[...new Map([...calendarBaseItems,...items].map(item=>[item.id,item] as const)).values()]:calendarBaseItems;
  const calendarFilteredItems=calendarSearchPool.filter(i=>productGroup(i.category)===(page==='camera-calendar'?'CAMERA':'CLOTHING')&&(calendarCategory==='ALL'||i.category===calendarCategory)&&
    (calendarCreator==='ALL'||calendarActive.some(o=>o.createdBy===calendarCreator&&o.lines.some(l=>l.itemId===i.id)&&o.pickupDate<=calendarDays[6]&&o.returnDate>=calendarStart))&&
    (calendarStatus==='ALL'||calendarItemState(i,calendarActive,calendarStart,7,today,Date.now())===calendarStatus)&&
    matchesCalendarSearch(i,calendarActive,calendarQuery));
  // Reorder ALL visible products using the first date on screen, not the next day's state.
  // Desktop and mobile receive the same order. Switching dates recalculates the groups.
  const calendarItems=sortCalendarProductsForDay(calendarFilteredItems,calendarStart,calendarActive,today,riskIds);
  const findNearest=async(itemId:string)=>{
    setNearestLoading(itemId);setNearestResult(null);
    try {
      const requestedDay=calendarStart<today?today:calendarStart;
      const result=await api<{itemId:string;nextPickupDate:string|null;nextReturnDate:string|null;reason:string}>('smart-calendar',{
        method:'POST',body:JSON.stringify({mode:'NEXT_AVAILABLE',itemId,pickupDate:requestedDay,returnDate:requestedDay,startHour:'09:00',endHour:'09:00'})});
      setNearestResult(result);
    }catch(e){setErr(e instanceof Error?e.message:'Không thể tìm ngày trống tiếp theo.');}
    finally{setNearestLoading(null);}
  };
  // Shared occupancy logic for desktop timeline and mobile product cards.
  // Keep both views on the exact same booking rules and click handlers.
  const renderCalendarCell=(item:InventoryItem,day:string,mobile=false)=>{
    const {matching,shown,late,warning:nextDayRisk,blocked,isPast,visual}=calendarSlotState(item,day,calendarActive,today,riskIds,Date.now());
    const cameraAlert=shown&&page==='camera-calendar'?cameraLateAlert(shown,Date.now()):null;
    const liveQuote=shown&&cameraAlert?cameraLiveQuote(shown,Date.now()):null;
    const title=shown?shown.customerName+' · '+shown.code+' · Tạo bởi: '+creatorName(shown)+(cameraAlert?` · TRẢ TRỄ ${cameraAlert.lateMinutes} phút`:(late?' · TRẢ TRỄ':''))+(liveQuote?` · Tiền tạm tính ${money(liveQuote.total)} (đã gồm trễ ${money(liveQuote.lateFee)})`:'')+(nextDayRisk?' · 20H: CHƯA TRẢ, MAI CÓ ĐƠN':''):blocked?statusLabels[item.status]||'Chưa được định giá':isPast?'Ngày đã qua':day===today?'Giao đồ ngay':'Đặt trước';
    const date=new Date(day+'T00:00:00Z');
    const week=['CN','T2','T3','T4','T5','T6','T7'][date.getUTCDay()];
    return <button key={day} type="button" title={title} aria-label={`${prettyDay(day)}: ${visual.label}. ${title}`} className={'calendar-cell '+calendarUi.slot+' '+calendarUi[visual.className]+' '+(mobile?'gu-calendar-mobile-cell ':'')+(nextDayRisk?'gu-next-day-risk ':late?'gu-calendar-late ':shown?(shown.status==='PICKED_UP'?'occupied-picked':'occupied-reserved'):blocked?'cell-blocked':'cell-free')} disabled={!shown&&(blocked||isPast)} onClick={()=>matching.length>1?setCalendarMatches(matching):shown?openDetail(shown):openBooking(day===today?'PICKUP':'RESERVE',item.id,day)}>
      {mobile&&<span className="gu-calendar-cell-date"><strong>{week}</strong><small>{day.slice(8,10)}/{day.slice(5,7)}</small></span>}
      {visual.className==='stateFree'?<span className={calendarUi.freeAction} aria-hidden="true">+</span>:<span className={'gu-calendar-cell-result '+calendarUi.stateLabel}>{visual.label}</span>}
      {shown&&<span className={calendarUi.customer} title={shown.customerName}>{matching.length>1?matching.length+' lượt':shown.customerName.split(' ').slice(-1)[0]}</span>}
      {shown&&<span className="gu-calendar-cell-time" title={'Giờ '+(shown.handoverProof?.at?'khách đã nhận: ':'hẹn nhận: ')+vnDisplayHour(pickupForDisplay(shown))+' · Giờ trả dự kiến: '+vnDisplayHour(shown.returnAt)}>{cameraAlert?`Trễ ${cameraAlert.lateMinutes} phút`:calendarCellTime(shown)}</span>}
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
    if(data?.me.role!=='admin')return;
    const rows=[['Mã đơn','Khách hàng','Số điện thoại','Nhân viên tạo','Nhận','Trả','Trạng thái','Tổng','Đã thu'],...filteredOrders.map(o=>[o.code,o.customerName,o.customerPhone,creatorName(o),o.pickupDate,o.returnDate,orderLabels[o.status],String(dueAmount(o)),String(o.paid)])];
    const csv=safeCsv(rows);
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='don-thue-'+today+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  if(!authReady)return <div className="center-screen"><LoaderCircle className="spin" size={30}/><p>Đang kết nối hệ thống…</p></div>;
  if(!user)return <div className="login-page"><div className="login-art"><div className="brand brand-large"><span className="brandmark"><Sparkles size={24}/></span><span>GU<span className="brand-accent">.</span></span></div><div className="login-art-copy"><span className="eyebrow light">GU - THUÊ ĐỒ XINH</span><h1>Vận hành cửa hàng<br/>đẹp như cách bạn<br/><em>chăm chút từng bộ đồ.</em></h1><div className="login-feature"><ShieldCheck size={20}/> Tự động chống đặt trùng lịch theo từng món đồ</div></div><div className="login-art-bottom">GU - THUÊ ĐỒ XINH</div></div><div className="login-pane"><div className="login-box"><div className="login-small-logo"><span className="brandmark"><Sparkles size={21}/></span> GU<span className="brand-accent">.</span></div><div className="eyebrow">KHU VỰC NHÂN VIÊN</div><h2>Đăng nhập GU</h2><p className="muted">Dùng tài khoản cửa hàng đã cấp để bắt đầu ca làm việc.</p><form onSubmit={async(e)=>{e.preventDefault();setLoginPending(true);setAuthErr('');try{await signInWithUsernameAndPassword(clientAuth(),loginUsername,loginPassword);}catch{setAuthErr('Tên đăng nhập hoặc mật khẩu chưa đúng.');}finally{setLoginPending(false);}}}><label className="field-label" htmlFor="gu-login-username">Tên đăng nhập</label><input id="gu-login-username" className="input" type="text" autoCapitalize="none" spellCheck={false} maxLength={32} autoComplete="username" placeholder="Ví dụ: gu, nhanvien01" value={loginUsername} onChange={e=>setLoginUsername(e.target.value)} required/><label className="field-label" htmlFor="gu-login-password">Mật khẩu</label><div className="gu-password-field"><input id="gu-login-password" className="input" type={showLoginPassword?"text":"password"} autoComplete="current-password" placeholder="Nhập mật khẩu" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/><button type="button" className="gu-password-toggle" aria-label={showLoginPassword?"Ẩn mật khẩu":"Hiện mật khẩu"} aria-pressed={showLoginPassword} onClick={()=>setShowLoginPassword(v=>!v)}>{showLoginPassword?"Ẩn":"Hiện"}</button></div>{authErr&&<div className="inline-alert danger-alert" role="alert"><AlertCircle size={17}/>{authErr}</div>}<button type="submit" className="btn btn-dark login-btn" disabled={loginPending}>{loginPending?<LoaderCircle size={17} className="spin"/>:null} Đăng nhập <ArrowRight size={17}/></button></form><div className="login-secure"><ShieldCheck size={16}/> Phiên đăng nhập bảo mật trên VPS</div></div></div></div>;

  if(shiftSession?.access==='REGISTER')return <div className="gu-signup-gate">
    <div className="gu-signup-top"><strong>GU · Chỉ đăng ký ca</strong><button type="button" className="btn btn-white" onClick={()=>void signOut(clientAuth())}><LogOut size={16}/> Đăng xuất</button></div>
    <GuStaffShifts api={api} registrationOnly/>
  </div>;
  if(!shiftSession||shiftSession.access==='DENIED')return <div className="center-screen"><LoaderCircle className="spin" size={26}/> Đang xác thực ca làm việc…</div>;
  return <><a className="skip-link" href="#gu-main-content">Bỏ qua menu, tới nội dung chính</a><div className="shell">
    <aside className={'sidebar '+(mobileNav?'sidebar-open':'')}>
      <div className="brand"><span className="brandmark"><Sparkles size={22}/></span><span>GU<span className="brand-accent">.</span><small>THUÊ ĐỒ XINH</small></span></div>
      <div className="workspace"><div className="workspace-logo">GU</div><div className="workspace-copy"><strong>GU - Thuê đồ xinh</strong><span>Hệ thống cửa hàng <CheckCircle2 size={12}/></span></div><MoreHorizontal size={17} color="#948c83"/></div>
      <div className="nav-heading">QUẢN LÝ</div>
      <nav className="navigation" aria-label="Điều hướng quản lý GU">{navSections.map(group=><div className="gu-nav-section" key={group.label}><div className="gu-nav-section-title">{group.label}</div>{group.ids.filter(id=>data?.me.role==='admin'||!['reviews','reports','staff','audit','system'].includes(id)).map(id=>{const item=nav.find(n=>n.id===id)!;const Icon=item.icon;return <button type="button" key={id} aria-current={page===id?'page':undefined} className={'nav-link '+(page===id?'nav-active':'')} onClick={()=>{setPage(id);setQuery('');setTaskView('ALL');setMobileNav(false);}}><Icon size={19} strokeWidth={1.9}/><span>{item.label}</span>{page===id&&<span className="active-line"/>}</button>;})}</div>)}</nav>
      <div className="sidebar-spacer"/>

      <div className="sidebar-user"><div className="avatar">{initials(data?.me.name||user.email||'AD')}</div><div className="sidebar-user-copy"><strong>{data?.me.name||user.email?.split('@')[0]}</strong><span>{data?.me.role==='admin'?'Quản trị viên':'Nhân viên'}</span></div><button className="icon-btn" aria-label="Đăng xuất" title="Đăng xuất" onClick={()=>void signOut(clientAuth())}><LogOut size={18}/></button></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Đóng menu"/>}
    <main id="gu-main-content" className="main" tabIndex={-1}>
      <GuPwaSetup/>
      <header className="topbar"><div className="topbar-left"><button className="mobile-toggle icon-btn" onClick={()=>setMobileNav(true)} aria-label="Mở menu"><Menu/></button><span className="gu-mobile-brand">GU<span>.</span></span><span className="crumb">GU / Quản lý</span><ChevronRight size={14} color="#b5ada4"/><span className="crumb-current">{nav.find(n=>n.id===page)?.label}</span></div><div className="topbar-right"><span className="today"><CalendarDays size={16}/>{prettyDay(today)}</span><button className="icon-btn refresh-button" title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" onClick={()=>void refresh()}><RefreshCcw size={17} className={loading?'spin':''}/></button><div className="avatar top-avatar">{initials(data?.me.name||user.email||'A')}</div></div></header>
      <div className="content">
    {latePickups.length>0&&dismissedPickupSignature!==latePickupSignature&&<section role="status" className="gu-late-pickup-banner" aria-label="Cảnh báo khách quá giờ nhận đồ">
      <BellRing size={21}/><div className="gu-late-pickup-body">
        <strong>{latePickups.length} đơn đã quá giờ hẹn, khách chưa đến lấy hàng</strong>
        <p>Đơn vẫn ở trạng thái Chờ bàn giao. Hãy liên hệ khách để xác nhận thời gian nhận; không tự chuyển sang Đã giao.</p>
        <div className="gu-late-pickup-list">{latePickups.slice(0,pickupAlertsExpanded?latePickups.length:3).map(alert=><button key={alert.orderId} type="button" onClick={()=>openLatePickupSearch(alert.code)} title="Tìm và mở đơn thuê">
          <strong>{alert.code}</strong><span>{alert.customerName}</span><small>Hẹn {alert.scheduledAt?formatVNDateTime(alert.scheduledAt):prettyDay(alert.pickupDate)+' (đơn cũ không có giờ)'}</small><ArrowRight size={14}/>
        </button>)}</div>
        {latePickups.length>3&&<button type="button" className="gu-late-pickup-more" onClick={()=>setPickupAlertsExpanded(v=>!v)}>{pickupAlertsExpanded?'Thu gọn':`Xem tất cả ${latePickups.length} đơn`}</button>}
      </div>
      <button type="button" className="gu-late-pickup-dismiss" title="Tạm ẩn cảnh báo hiện tại" aria-label="Đóng cảnh báo khách chưa nhận đồ" onClick={()=>setDismissedPickupSignature(latePickupSignature)}><X size={19}/></button>
    </section>}
    {riskIds.size>0&&dismissedRiskSignature!==riskSignature&&<div role="status" className="gu-next-day-risk-banner"><BellRing size={20}/><div><strong>{riskIds.size} sản phẩm cần kiểm tra trước ca thuê ngày mai</strong><span>Từ 20:00: đồ chưa trả nhưng đã có lịch cho khách khác vào ngày mai. Liên hệ khách và chuẩn bị phương án thay thế.</span></div><button type="button" className="btn btn-white gu-risk-view" onClick={()=>{setPage('calendar');setCalendarStart(today);}}>Xem lịch</button><button type="button" className="gu-risk-dismiss" aria-label="Đóng cảnh báo 20 giờ" title="Đóng thông báo" onClick={()=>setDismissedRiskSignature(riskSignature)}><X size={19}/></button></div>}
        {overdueOrders.length>0&&<div className="overdue-banner"><BellRing size={22}/><div><strong>KHẨN: {overdueOrders.length} đơn chưa trả đúng hạn</strong><p>{overdueOrders.slice(0,3).map(o=>o.code+' · '+o.customerName+' (hẹn '+prettyDay(o.returnDate)+')').join(' • ')}</p></div><button type="button" className="btn btn-white" onClick={()=>{setPage('orders');setOrderStatus('PICKED_UP');}}>Xem đơn trễ</button>{!notificationsEnabled&&<button type="button" className="btn btn-white" onClick={()=>void enableNotifications()}>Bật thông báo</button>}</div>}
        {err&&<div className="inline-alert danger-alert global-alert"><AlertCircle size={18}/><span>{err}</span><button className="icon-btn" onClick={()=>setErr('')} aria-label="Đóng thông báo"><X size={16}/></button></div>}
        {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}<button aria-label="Đóng" onClick={()=>setToast('')}><X size={15}/></button></div>}
        {!data?<div className="center-screen dashboard-empty">{loading?<><LoaderCircle className="spin" size={28}/><p>Đang tải dữ liệu cửa hàng…</p></>:<><AlertCircle size={30}/><h3>Chưa tải được dữ liệu</h3><p>Hãy kiểm tra tài khoản nhân viên và kết nối PostgreSQL trên VPS.</p><button className="btn btn-dark" onClick={()=>void refresh()}>Thử lại</button></>}</div>:<>
        {page==='overview'&&<><div className="page-intro"><div><div className="eyebrow">TỔNG QUAN CỬA HÀNG</div><h1>Xin chào, {data.me.name?.split(' ').slice(-1)[0]||'bạn'} <span className="wave">✳</span></h1></div><div className="action-row"><button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={18}/> Tạo đơn thuê đồ</button><button className="btn btn-white" onClick={()=>openBooking('RESERVE',undefined,undefined,undefined,'','', 'CAMERA')}><Clock3 size={17}/> Đặt thuê máy ảnh</button></div></div>
          <div className="gu-mobile-action-panel"><div className="gu-mobile-greeting"><strong>Hôm nay tại GU</strong><span>{prettyDay(today)}</span></div><div className="gu-mobile-task-grid"><button type="button" onClick={()=>openTaskOrders('PICKUP_TODAY')}><CalendarDays size={18}/><strong>{orders.filter(o=>o.status==='RESERVED'&&o.pickupDate===today).length}</strong><small>Chờ giao hôm nay</small></button><button type="button" onClick={()=>openTaskOrders('RETURN_TODAY')}><Clock3 size={18}/><strong>{dueToday.length}</strong><small>Đến hẹn trả</small></button><button type="button" className={overdueOrders.length?'gu-mobile-danger':''} onClick={()=>openTaskOrders('OVERDUE')}><BellRing size={18}/><strong>{overdueOrders.length}</strong><small>Quá hạn</small></button></div></div>
          <GuInstallApp/>
          <div className="stats-grid">{data.me.role==='admin'&&<Metric icon={Wallet} title="Thu ròng từ sổ quỹ" value={collected===undefined?'Đang tải…':money(collected)} detail="Dòng tiền ghi nhận, đã trừ hoàn tiền" tone="peach"/>}<Metric icon={ShoppingBag} title="Đơn đang hoạt động" value={String(data.counts?.activeOrders??active.length).padStart(2,'0')} detail={`${picked.length} đơn đã lấy hàng`} tone="purple"/><Metric icon={Shirt} title="Sản phẩm trong kho" value={String(data.counts?.items??items.length).padStart(2,'0')} detail={`${data.counts?.available??items.filter(i=>i.status==='AVAILABLE').length} bộ sẵn sàng`} tone="blue"/><Metric icon={ArrowDownLeft} title="Cần trả hôm nay" value={String(dueToday.length).padStart(2,'0')} detail="Đơn đến hạn trả hôm nay" tone="green"/><Metric icon={WashingMachine} title="Đang giặt" value={String(data.counts?.laundry??laundryRemote.length??0).padStart(2,'0')} detail="Trả xong sẽ tự chuyển vào đây" tone="blue"/></div>
          <section className="panel gu-today-tasks" aria-label="Việc hôm nay">
            <div className="panel-heading"><div><h3><ListTodo size={19}/> Việc hôm nay</h3></div></div>
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
          <div className="overview-columns"><section className="panel"><div className="panel-heading"><div><h3>Đơn thuê gần đây</h3></div><button className="text-action" onClick={()=>setPage('orders')}>Xem tất cả <ArrowRight size={15}/></button></div><div className="table-wrap"><table><thead><tr><th>ĐƠN HÀNG</th><th>KHÁCH HÀNG</th><th>NGÀY NHẬN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{orders.slice(0,6).map(o=><tr key={o.id} className={"click-row "+(o.status==='PICKED_UP'&&riskRows.some(r=>r.heldOrderId===o.id)?'gu-next-day-risk-order':'')} onClick={()=>openDetail(o)}><td><b>{o.code}</b><div className="table-sub">{money(o.total)}</div></td><td>{o.customerName}</td><td>{prettyDay(o.pickupDate)}</td><td>{latePickupIds.has(o.id)?<span className="badge gu-late-pickup-badge">QUÁ GIỜ NHẬN</span>:riskRows.some(r=>r.heldOrderId===o.id)?<span className="badge gu-next-day-risk-badge">MAI CÓ KHÁCH ĐẶT</span>:isOverdue(o)?<span className="badge badge-danger overdue-blink">TRẢ TRỄ</span>:<StatusBadge status={o.status} label={orderLabels[o.status]}/>} </td></tr>)}{!orders.length&&<tr><td colSpan={4}><Empty small text="Chưa có đơn thuê. Hãy tạo đơn đầu tiên."/></td></tr>}</tbody></table></div></section><section className="panel gu-overview-work-panel"><div className="panel-heading"><div><h3>Kho cần xử lý</h3><p>Các sản phẩm chưa sẵn sàng để cho thuê</p></div></div><div className="gu-overview-debt-preview"><p className="gu-debt-empty-inline">Đang giặt: <strong>{(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)}</strong> món</p><p className="gu-debt-empty-inline">Bảo trì: <strong>{items.filter(i=>i.status==='MAINTENANCE').length}</strong> món</p><button type="button" className="btn btn-white gu-panel-action" onClick={()=>setPage('laundry')}>Mở Quản lý giặt <ArrowRight size={16}/></button></div></section></div>

        </>}
        {['calendar','camera-calendar'].includes(page)&&<>
          <div className="page-intro"><div><div className="eyebrow">LỊCH THEO NGÀY / THÁNG / NĂM</div><h1>{page==='camera-calendar'?'Lịch máy ảnh':'Lịch cho thuê'}</h1></div><div className="action-row"><button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={18}/> Giao ngay</button></div></div>
          <div className="gu-catalog-pager"><div className="gu-search-wrap"><Search size={15}/><input className="input" value={calendarQuery} onChange={e=>setCalendarQuery(e.target.value)} placeholder="Tìm tên sản phẩm, mã GU-00234 / 234, khách đang thuê hoặc SĐT…"/></div><button type="button" className="btn btn-white" disabled={!calendarNext} onClick={()=>setCalendarPageCursor(calendarNext)}>25 món tiếp theo <ChevronRight size={14}/></button><button type="button" className="btn btn-white" disabled={!calendarPageCursor} onClick={()=>setCalendarPageCursor(null)}>Đầu danh sách</button></div>

          {page==='camera-calendar'&&cameraOverdueOrders.length>0&&<div role="status" className="gu-camera-overdue-summary"><BellRing size={19}/><div><strong>{cameraOverdueOrders.length} đơn máy ảnh quá giờ trả</strong><span>{cameraOverdueOrders.slice(0,3).map(o=>`${o.customerName} · trễ ${cameraLateAlert(o,Date.now())?.lateMinutes||0} phút`).join(' · ')}. Mở đơn để xem tiền tạm tính và nhận trả để chốt phí.</span></div></div>}
          <section className="panel calendar-panel"><div className="calendar-toolbar gu-calendar-toolbar-v532">
            <div className="gu-calendar-toolbar-title"><div><h3>{page==='camera-calendar'?'Lịch sử dụng máy ảnh':'Lịch trang phục, phụ kiện và các mục khác'}</h3></div><div className={'legend '+calendarUi.legend} aria-label="Chú giải các trạng thái thuê"><span className={calendarUi.legendOverdue}><i/>Trả trễ</span><span className={calendarUi.legendWarning}><i/>Cảnh báo 20h</span><span className={calendarUi.legendPicked}><i/>Đã lấy</span><span className={calendarUi.legendReserved}><i/>Đã giữ</span><span className={calendarUi.legendFree}><i/>Còn trống</span></div></div>
            <div className="calendar-controls gu-calendar-controls-v532">
              <div className="gu-calendar-filter-fields">
                <label><span>Danh mục</span><select className="input gu-calendar-cat" aria-label="Lọc danh mục sản phẩm" value={calendarCategory} onChange={e=>setCalendarCategory(e.target.value)}><option value="ALL">Tất cả danh mục</option>{Array.from(new Set([...categories.map(c=>c.name),...items.map(i=>i.category)].filter(name=>productGroup(name)===(page==='camera-calendar'?'CAMERA':'CLOTHING')))).sort().map(c=><option value={c} key={c}>{c}</option>)}</select></label>
                <label><span>Tình trạng</span><select className="input gu-calendar-status" aria-label="Lọc lịch theo tình trạng" value={calendarStatus} onChange={e=>setCalendarStatus(e.target.value as CalendarFilter)}>
                  <option value="ALL">Mọi trạng thái</option><option value="FREE">Còn trống</option><option value="RESERVED">Đã giữ</option><option value="PICKED_UP">Đã giao</option><option value="OVERDUE">Trả trễ</option><option value="LAUNDRY">Đang giặt</option><option value="MAINTENANCE">Bảo trì</option><option value="MISSING">Thất lạc</option><option value="UNPRICED">Chưa duyệt giá</option>
                </select></label>
                {data.me.role==='admin'&&<label><span>Nhân viên tạo đơn</span><select className="input gu-calendar-creator" aria-label="Lọc theo nhân viên tạo đơn" value={calendarCreator} onChange={e=>setCalendarCreator(e.target.value)}><option value="ALL">Mọi nhân viên tạo</option>{calendarCreators.map(([uid,name])=><option key={uid} value={uid}>{name}</option>)}</select></label>}
              </div>
              <div className="gu-calendar-date-group"><span className="gu-calendar-date-label">Ngày bắt đầu</span><div className="gu-calendar-date-actions"><button type="button" className="icon-btn boxed" title="Lùi 1 ngày" aria-label="Lùi lịch một ngày" onClick={()=>setCalendarStart(addDays(calendarStart,-1))}><ChevronLeft size={18}/></button><GuVNDateInput className="input gu-date-nav" ariaLabel="Ngày bắt đầu lịch DD/MM/YYYY" value={calendarStart} onChange={setCalendarStart}/><button type="button" className="btn btn-white gu-calendar-today" onClick={()=>setCalendarStart(today)}>Hôm nay</button><button type="button" className="icon-btn boxed" title="Tiến 1 ngày" aria-label="Tiến lịch một ngày" onClick={()=>setCalendarStart(addDays(calendarStart,1))}><ChevronRight size={18}/></button></div></div>
            </div>
          </div>
          <div className="calendar-scroll gu-calendar-desktop"><div className={'calendar-grid '+calendarUi.grid}><div className="calendar-corner">SẢN PHẨM / NGÀY</div>
            {calendarDays.map(d=>{const tone=calendarDayTone(d,today);return <div key={d} className={'calendar-day '+calendarUi.dayHeader+' '+(tone?calendarUi[tone]:'')}><span>{new Date(d+'T00:00:00Z').toLocaleDateString('vi-VN',{weekday:'short',timeZone:'UTC'})}</span><strong>{prettyDay(d)}</strong></div>;})}
            {calendarItems.map(item=><div className={'calendar-row '+(calendarOverdue.some(o=>o.lines.some(l=>l.itemId===item.id))?'overdue-row':'')} key={item.id}>
              <div className="calendar-item"><ProductImage paths={item.imagePaths} className="gu-calendar-photo"/><div className={calendarUi.productText}><button type="button" className={calendarUi.productNameButton} title={'Xem đầy đủ: '+item.name} aria-label={'Xem tên và mã đầy đủ của '+item.name} onClick={()=>setCalendarProductPeek(item)}><strong className={calendarUi.productName}>{item.name}</strong></button><span className={calendarUi.productCode} title={'Mã SP: '+(getProductCode(item)||'chưa cấp')}>{getProductCode(item)||'Chưa có mã'}</span><button type="button" className="gu-nearest-link" disabled={nearestLoading===item.id} onClick={()=>void findNearest(item.id)}><CalendarSearch size={12}/> {nearestLoading===item.id?'Đang tìm…':'Ngày trống gần nhất'}</button>{nearestResult?.itemId===item.id&&<small className="gu-nearest-inline">{nearestResult.nextPickupDate?`Trống: ${prettyDay(nearestResult.nextPickupDate)}`:nearestResult.reason}</small>}</div></div>
              {calendarDays.map(day=>{const tone=calendarDayTone(day,today);return <div key={day} className={calendarUi.dayTrack+' '+(tone?calendarUi[tone]:'')}>{renderCalendarCell(item,day)}</div>;})}
            </div>)}
            {!calendarItems.length&&<div className="calendar-no-items">Không có sản phẩm trong danh mục đang chọn.</div>}
          </div></div>
          <div className="gu-mobile-calendar" aria-label="Lịch thuê sản phẩm trên điện thoại">
            {calendarItems.map(item=><article className="gu-mobile-calendar-card" key={item.id}>
              <div className="gu-mobile-calendar-product"><ProductImage paths={item.imagePaths} className="gu-calendar-photo"/><div className="gu-mobile-calendar-product-info"><button type="button" className={calendarUi.mobileProductName} title={'Xem đầy đủ: '+item.name} onClick={()=>setCalendarProductPeek(item)}>{item.name}</button><span title={item.category}>{item.category}</span><span className={calendarUi.productCode}>{getProductCode(item)||'Chưa có mã'}</span><button type="button" className="gu-nearest-link" disabled={nearestLoading===item.id} onClick={()=>void findNearest(item.id)}><CalendarSearch size={13}/> {nearestLoading===item.id?'Đang tìm…':'Ngày trống gần nhất'}</button>{nearestResult?.itemId===item.id&&<small className="gu-nearest-inline">{nearestResult.nextPickupDate?`Trống: ${prettyDay(nearestResult.nextPickupDate)}`:nearestResult.reason}</small>}</div></div>
              <div className="gu-mobile-days-scroll" aria-label={'Cuộn ngày thuê của '+item.name} tabIndex={0}><div className="gu-mobile-days-grid">{calendarDays.map(day=>{const tone=calendarDayTone(day,today);return <div key={day} className={calendarUi.mobileTrack+' '+(tone?calendarUi[tone]:'')}>{renderCalendarCell(item,day,true)}</div>;})}</div></div>
            </article>)}
            {!calendarItems.length&&<div className="calendar-no-items">Không có sản phẩm trong danh mục đang chọn.</div>}
          </div>
          {nearestResult&&<div className="gu-nearest-result" aria-live="polite"><CalendarSearch size={19}/><div><strong>{items.find(i=>i.id===nearestResult.itemId)?.name||'Sản phẩm'}:</strong> {nearestResult.nextPickupDate?`trống từ ${prettyDay(nearestResult.nextPickupDate)} đến ${prettyDay(nearestResult.nextReturnDate!)}`:nearestResult.reason}</div>{nearestResult.nextPickupDate&&<button className="btn btn-dark" onClick={()=>openBooking(nearestResult.nextPickupDate===today?'PICKUP':'RESERVE',nearestResult.itemId,nearestResult.nextPickupDate!,nearestResult.nextReturnDate!,'09:00','09:00')}>Đặt ngày này</button>}<button className="icon-btn" title="Đóng" aria-label="Đóng kết quả" onClick={()=>setNearestResult(null)}><X size={16}/></button></div>}
          </section>
        </>}
        {['inventory','customers','orders'].includes(page)&&<div className="gu-catalog-pager" aria-live="polite"><span>{catalogLoading?'Đang cập nhật…':catalogData?`${page==='inventory'?filteredItems.length:page==='customers'?filteredCustomers.length:filteredOrders.length} kết quả đang hiển thị`:''}</span><button className="btn btn-white" type="button" disabled={catalogLoading||!catalogData?.hasMore} onClick={()=>setCatalogCursor(catalogData?.cursor||null)}>Trang kế tiếp <ChevronRight size={14}/></button><button className="btn btn-white" type="button" disabled={catalogLoading||!catalogCursor} onClick={()=>setCatalogCursor(null)}>Về trang đầu</button></div>}
        {page==='orders'&&<><div className="page-intro"><div><div className="eyebrow">TẤT CẢ ĐƠN THUÊ</div><h1>Quản lý đơn thuê</h1><p>Trang phục, phụ kiện, các loại sản phẩm khác và máy ảnh trong cùng một danh sách.</p></div><div className="action-row"><button className="btn btn-white" onClick={()=>openBooking('RESERVE',undefined,undefined,undefined,'','','CAMERA')}><Clock3 size={17}/> Đặt máy ảnh</button>{data.me.role==='admin'&&<button className="btn btn-white" onClick={exportCsv} title="Chỉ Admin được xuất dữ liệu khách hàng"><Download size={17}/> Xuất CSV</button>}<button className="btn btn-white" onClick={()=>openBooking('RESERVE')}><CalendarDays size={17}/> Đặt lịch trước</button><button className="btn btn-dark" onClick={()=>openBooking('PICKUP')}><Plus size={17}/> Tạo đơn · chụp ảnh giao</button></div></div>{items.some(i=>i.status==='LAUNDRY')&&<button className="gu-orders-laundry-link" type="button" onClick={()=>setPage('laundry')}><WashingMachine size={17}/> {(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)} món đang giặt — xem tại Quản lý giặt <ArrowRight size={16}/></button>}
        {taskView!=='ALL'&&<div className="gu-task-active"><ListTodo size={16}/> Đang xem: {taskView==='PICKUP_TODAY'?'Chờ giao hôm nay':taskView==='RETURN_TODAY'?'Đến hạn trả hôm nay':'Đơn trả quá hạn'} <button className="btn btn-white" onClick={()=>setTaskView('ALL')}>Xóa lọc</button></div>}<div className="summary-pills"><span><ShoppingBag size={16}/> Đơn gần đây <b>{orders.length}</b></span><span><Clock3 size={16}/> Đang giữ <b>{orders.filter(o=>o.status==='RESERVED').length}</b></span><span><Shirt size={16}/> Đã lấy <b>{orders.filter(o=>o.status==='PICKED_UP').length}</b></span></div><section className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã đơn, khách, SĐT, nhân viên…"/></div><div className="select-holder"><Filter size={17}/><select value={orderStatus} onChange={e=>setOrderStatus(e.target.value as typeof orderStatus)}><option value="ALL">Tất cả trạng thái</option>{(Object.keys(orderLabels) as OrderStatus[]).map(k=><option key={k} value={k}>{orderLabels[k]}</option>)}</select></div></div><div className="table-wrap"><table><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM</th><th>LỊCH THUÊ</th><th>THANH TOÁN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>{filteredOrders.map(o=><tr key={o.id} className={"click-row "+(o.status==='PICKED_UP'&&riskRows.some(r=>r.heldOrderId===o.id)?'gu-next-day-risk-order':'')} onClick={()=>openDetail(o)}><td><b>{o.code}</b><div className="table-sub">{prettyDay(o.createdAt.slice(0,10))}</div><div className="gu-order-created-by">NV: {creatorName(o)}</div></td><td><b>{o.customerName}</b><div className="table-sub">{o.customerPhone}</div><a href={customerPhoneHref(o.customerPhone)} className="gu-order-call" onClick={e=>e.stopPropagation()}><PhoneCall size={13}/> Gọi khách</a></td><td>{o.lines.map(l=>l.name).join(', ')}<div className="table-sub">{o.lines.length} sản phẩm · {orderGroup(o)==='CAMERA'?'Máy ảnh':orderGroup(o)==='LEGACY_MIXED'?'Đơn cũ hỗn hợp':'Trang phục / phụ kiện'}</div></td><td>{prettyDay(o.pickupDate)}<div className="table-sub">→ {prettyDay(o.returnDate)}</div></td><td><b>{money(dueAmount(o))}</b>{orderGroup(o)==='CAMERA'&&<div className="table-sub">Giá gói: {money(o.lines.reduce((s,l)=>s+(l.cameraPackageBasePrice??l.lineTotal??0),0))}{o.cameraOvertimeFeeTotal?` · Phí trễ: ${money(o.cameraOvertimeFeeTotal)}`:o.total>o.lines.reduce((s,l)=>s+(l.cameraPackageBasePrice??l.lineTotal??0),0)?' · Có chênh lệch giá cần đối soát':''}</div>}<div className="table-sub">{orderGroup(o)==='CAMERA'&&o.status==='PICKED_UP'?'Chưa quyết toán · Thu khi trả máy':'Đã thu: '+money(o.paid)}</div></td><td>{latePickupIds.has(o.id)?<span className="badge gu-late-pickup-badge">QUÁ GIỜ NHẬN</span>:riskRows.some(r=>r.heldOrderId===o.id)?<span className="badge gu-next-day-risk-badge">MAI CÓ KHÁCH ĐẶT</span>:isOverdue(o)?<span className="badge badge-danger overdue-blink">TRẢ TRỄ</span>:<StatusBadge status={o.status} label={orderLabels[o.status]}/>} </td><td><ChevronRight size={16}/></td></tr>)}{!filteredOrders.length&&<tr><td colSpan={7}><Empty small text="Không tìm thấy đơn thuê phù hợp."/></td></tr>}</tbody></table></div></section></>}
        {page==='laundry'&&<><div className="page-intro"><div><div className="eyebrow">TÌNH TRẠNG SẢN PHẨM</div><h1>Quản lý giặt</h1></div><button className="btn btn-white" onClick={()=>void refresh()}><RefreshCcw size={17}/> Làm mới</button></div>
          <section className="panel gu-laundry-queue"><div className="panel-heading"><div><h3><WashingMachine size={20}/> Đang giặt ({(laundryRemote.length||items.filter(i=>i.status==='LAUNDRY').length)})</h3></div></div><div className="gu-laundry-list">{(laundryLoaded?laundryRemote:items.filter(i=>i.status==='LAUNDRY')).map(i=><div key={i.id} className="gu-laundry-line"><ProductImage paths={i.imagePaths}/><span><strong>{i.name}</strong><small>{i.category} · {getProductCode(i)||'Chưa cấp mã sản phẩm'}</small></span><button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+i.id,{action:'CLEAN'},'Đã giặt · kho đã cập nhật.','PATCH')}><CheckCircle2 size={15}/> Đã giặt</button></div>)}{!(laundryLoaded?laundryRemote.length:items.some(i=>i.status==='LAUNDRY'))&&<Empty text="Không có sản phẩm đang giặt."/>}</div></section>
        </>}
        {page==='inventory'&&<><div className="page-intro"><div><div className="eyebrow">QUẢN LÝ SẢN PHẨM</div><h1>Kho sản phẩm</h1><p>Theo dõi tồn kho, tình trạng và cập nhật sản phẩm nhanh chóng.</p></div><div className="action-row"><button className="btn btn-white" onClick={()=>openModal('category')}>Quản lý danh mục</button>{data.me.role==='admin'&&items.some(i=>!getProductCode(i))&&<button className="btn btn-white" disabled={busy} onClick={()=>void assignOldProductCodes()}><RefreshCcw size={16}/> Cấp mã sản phẩm</button>}</div></div>
          <nav aria-label="Chế độ kho sản phẩm" className="gu-inventory-tabs"><button className={inventoryTab==='list'?'gu-inventory-tab gu-inventory-tab-active':'gu-inventory-tab'} type="button" aria-current={inventoryTab==='list'?'page':undefined} onClick={()=>setInventoryTab('list')}>Danh sách kho</button><button className={inventoryTab==='bulk'?'gu-inventory-tab gu-inventory-tab-active':'gu-inventory-tab'} type="button" aria-current={inventoryTab==='bulk'?'page':undefined} onClick={()=>setInventoryTab('bulk')}><Plus size={17}/> Thêm nhiều sản phẩm</button></nav>
          {inventoryTab==='bulk'&&<GuBulkInventory api={api} categories={(data?.categories||[]).map(c=>c.name)} existingNames={items.map(i=>i.name)} isAdmin={data.me.role==='admin'} onSaved={async()=>{setCatalogReload(v=>v+1);await refresh();}}/>}
          {inventoryTab==='list'&&<><div className="inventory-stats" title="Thống kê toàn bộ sản phẩm chưa lưu trữ, không phải chỉ các dòng đang hiện trong một trang."><span><i className="legend-dot free"/> Sẵn sàng <b>{data.counts?.available??items.filter(i=>i.status==='AVAILABLE').length}</b></span><span><i className="legend-dot picked"/> Đang thuê <b>{data.counts?.rented??items.filter(i=>i.status==='RENTED').length}</b></span><span><i className="legend-dot reserved"/> Đang giặt <b>{data.counts?.laundry??laundryRemote.length}</b></span><span><i className="legend-dot maintenance"/> Thất lạc <b>{data.counts?.missing??items.filter(i=>i.status==='MISSING').length}</b></span></div>
          <section className={`panel ${inventoryLayout.root}`}><GuInventoryFilters query={query} setQuery={(v:string)=>{setQuery(v);setCatalogData(null);}} status={itemStatus} setStatus={setItemStatus} category={inventoryCategory} setCategory={setInventoryCategory} categories={Array.from(new Set([...items.map(i=>i.category),...(data?.categories||[]).map(c=>c.name)]))} clearError={()=>setErr('')}/>
          <div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>PHÂN LOẠI</th><th>GIÁ THUÊ</th><th>TÌNH TRẠNG</th><th>THAO TÁC</th></tr></thead><tbody>{filteredItems.map(i=><tr key={i.id}><td><div className="item-name-cell"><ProductImage paths={i.imagePaths}/><div><b>{i.name}</b><div className="table-sub">{i.color||'Không ghi màu'}</div><div className="gu-product-code-row"><span className="gu-product-code-label">Mã sản phẩm</span>{getProductCode(i)?<button className="gu-product-code-tag" type="button" title="Nhấn để sao chép mã sản phẩm" onClick={()=>void copyProductCode(i.hangerCode!)}>{i.hangerCode}</button>:<span className="gu-product-code-unassigned">Chưa cấp mã sản phẩm</span>}</div></div></div></td><td data-label="Phân loại">{i.category}<div className="table-sub">{(i.requiresLaundry ?? (i.bufferDays>0))?'Có giặt sau thuê':'Không cần giặt'}</div></td><td data-label="Giá thuê"><b>{i.cameraModel?(i.cameraModel==='Canon EOS R50'?'110k / 3h':'90k / 3h'):money(i.dailyRate)}</b>{i.cameraModel&&<div className="table-sub">Serial: {i.cameraSerial||'Chưa có'}</div>}<div className="table-sub">Đền bù: {i.replacementValue>0?money(i.replacementValue):'Chờ Admin duyệt'}</div></td><td data-label="Tình trạng"><StatusBadge status={i.status} label={statusLabels[i.status]}/></td><td data-label="Thao tác"><div className="gu-table-actions"><button className="btn btn-white" type="button" onClick={()=>editItem(i)}><Pencil size={15}/> Sửa</button>{i.status==='LAUNDRY'&&<button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+i.id,{action:'CLEAN'},'Đã giặt, kho đã cập nhật.','PATCH')}><WashingMachine size={15}/> Đã giặt</button>}{data.me.role==='admin'&&<button type="button" className="btn btn-white" onClick={()=>setEvidenceItem(i)}>Ảnh 7 lượt</button>}{data.me.role==='admin'&&<details className="gu-row-more"><summary className="btn btn-white">Khác <ChevronDown size={15}/></summary><div className="gu-row-more-menu"><button type="button" className="btn btn-danger" disabled={busy} onClick={()=>void removeItem(i)}><Trash2 size={15}/> Lưu trữ sản phẩm</button>{i.status!=='RENTED'&&i.status!=='MISSING'&&i.status!=='LAUNDRY'&&<label className="gu-row-state-edit">Tình trạng<select className="small-select" aria-label={'Đổi tình trạng '+i.name} disabled={busy} value={i.status} onChange={e=>void action('items/'+i.id,{status:e.target.value},'Đã cập nhật kho.','PATCH')}><option value="AVAILABLE">Sẵn sàng</option><option value="MAINTENANCE">Bảo trì</option></select></label>}</div></details>}</div></td></tr>)}{!filteredItems.length&&<tr><td colSpan={5}><Empty small text="Không có sản phẩm phù hợp."/></td></tr>}</tbody></table></div></section></>}
          </>}
        {page==='customers'&&<><div className="page-intro"><div><div className="eyebrow">QUẢN LÝ KHÁCH HÀNG</div><h1>Khách hàng</h1></div><button className="btn btn-dark" onClick={()=>openModal('customer')}><Plus size={18}/> Thêm khách hàng</button></div><section className="panel"><div className="filter-toolbar"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…"/></div><div className="customer-count">{filteredCustomers.length} khách hàng</div></div><div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>SỐ ĐIỆN THOẠI</th><th>GHI CHÚ</th><th>SỐ LẦN THUÊ</th><th>TỔNG GIÁ TRỊ ĐƠN</th></tr></thead><tbody>{filteredCustomers.map(c=>{const os=orders.filter(o=>o.customerId===c.id&&o.status!=='CANCELLED');return <tr key={c.id}><td><div className="item-name-cell"><span className="avatar customer-avatar">{initials(c.name)}</span><div><b>{c.name}</b><div className="table-sub">{prettyDay(c.createdAt.slice(0,10))}</div></div></div></td><td>{c.phone}</td><td>{c.note||'—'}</td><td><b>{os.length}</b></td><td>{money(os.reduce((s,o)=>s+o.total,0))}</td></tr>;})}{!filteredCustomers.length&&<tr><td colSpan={5}><Empty small text="Chưa có khách hàng."/></td></tr>}</tbody></table></div></section></>}
        {(page==='staff'||visitedPages.has('staff'))&&data.me.role==='admin'&&<div className="gu-tab-panel" hidden={page!=='staff'}><AdminStaffPanel api={api}/></div>}
        {(page==='shifts'||visitedPages.has('shifts'))&&<div className="gu-tab-panel" hidden={page!=='shifts'}><GuStaffShifts api={api} isAdmin={data.me.role==='admin'} active={page==='shifts'}/></div>}
        {(page==='reviews'||visitedPages.has('reviews'))&&data.me.role==='admin'&&<div className="gu-tab-panel" hidden={page!=='reviews'}><GuV5Review api={api} onChanged={refresh} active={page==='reviews'}/></div>}
        {(page==='visual'||visitedPages.has('visual'))&&<div className="gu-tab-panel" hidden={page!=='visual'}><GuVisualFinder isAdmin={data.me.role==='admin'} api={api} active={page==='visual'} availableCategories={Array.from(new Set([...categories.map(c=>c.name),...items.map(i=>i.category)]))}/></div>}
        {(page==='audit'||visitedPages.has('audit'))&&data.me.role==='admin'&&<div className="gu-tab-panel" hidden={page!=='audit'}><AuditPanel api={api}/></div>}
        {(page==='system'||visitedPages.has('system'))&&data.me.role==='admin'&&<div className="gu-tab-panel" hidden={page!=='system'}><GuSystem api={api}/></div>}
        {page==='reports'&&data.me.role==='admin'&&<>{reportNote&&<div className="inline-alert" role="status">{reportNote}</div>}<div className="page-intro"><div><div className="eyebrow">BÁO CÁO CỬA HÀNG</div><h1>Báo cáo doanh thu</h1></div><div className="select-holder report-select"><select value={reportMode} onChange={e=>setReportMode(e.target.value as typeof reportMode)}><option value="day">14 ngày</option><option value="month">12 tháng</option><option value="year">5 năm</option></select></div></div><div className="stats-grid report-stats"><Metric icon={Wallet} title="Thu ròng từ sổ quỹ" value={collected===undefined?'Đang tải…':money(collected)} detail="Thu tiền trừ hoàn tiền đã ghi nhận" tone="peach"/><Metric icon={CircleDollarSign} title="Giá trị đơn gần đây" value={money(liveOrders.reduce((s,o)=>s+o.total,0))} detail="Ước tính từ đơn tải gần đây, không phải toàn bộ" tone="purple"/><Metric icon={ShoppingBag} title="Đơn đang thuê" value={String(orders.filter(o=>o.status==='PICKED_UP').length)} detail="Đơn hiện đang giao cho khách trong dữ liệu gần đây" tone="blue"/><Metric icon={BadgeCheck} title="Đã hoàn tất gần đây" value={String(orders.filter(o=>o.status==='RETURNED').length)} detail="Trong dữ liệu tải gần đây" tone="green"/></div><div className="report-layout"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Dòng tiền thực thu</h3><p>Ghi nhận từ thao tác thu tiền của nhân viên, không tính doanh thu dự kiến.</p></div></div><div className="bar-chart">{chartRows.map((r,i)=><div key={r.key} className="bar-col"><div className="bar-value">{r.value?shortMoney(r.value):''}</div><div className={'bar '+(i===chartRows.length-1?'bar-highlight':'')} style={{height:Math.max(3,(r.value/chartMax)*195)+'px'}} title={r.key+' · '+money(r.value)}/><span>{r.label}</span></div>)}</div></section><section className="panel top-products"><div className="panel-heading"><div><h3>Sản phẩm được thuê nhiều</h3><p>Tính theo số lượt đặt không bị hủy</p></div></div>{items.map(i=>({item:i,count:liveOrders.filter(o=>o.lines.some(l=>l.itemId===i.id)).length})).sort((a,b)=>b.count-a.count).slice(0,5).map((x,idx)=><div className="rank-row" key={x.item.id}><span className="rank-num">{String(idx+1).padStart(2,'0')}</span><span className="mini-item-icon"><Shirt size={17}/></span><div><strong>{x.item.name}</strong><small>{x.item.category}</small></div><b>{x.count} lượt</b></div>)}{!items.length&&<Empty small text="Chưa có sản phẩm để thống kê."/>}</section></div></>}
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


    {captureId&&<GuOrderCapture orderId={captureId} api={api} onClose={()=>setCaptureId(null)} onDone={async()=>{await refresh();setToast('Đã lưu ảnh kiểm nhận.');}}/>}
    {evidenceItem&&data?.me.role==='admin' &&<GuEvidenceHistory item={evidenceItem} api={api} onClose={()=>setEvidenceItem(null)}/>}
    {calendarProductPeek&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCalendarProductPeek(null)}}><div className={'modal '+calendarUi.peekDialog} role="dialog" aria-modal="true" aria-label="Tên và mã sản phẩm đầy đủ"><div className="modal-heading"><h2>Thông tin sản phẩm</h2><button type="button" className="icon-btn" aria-label="Đóng" onClick={()=>setCalendarProductPeek(null)}><X size={19}/></button></div><div className={calendarUi.peekBody}><ProductImage paths={calendarProductPeek.imagePaths} className="gu-calendar-photo"/><div><strong>{calendarProductPeek.name}</strong><span>{calendarProductPeek.category}</span><span className={calendarUi.productCode}>Mã: {getProductCode(calendarProductPeek)||'Chưa có mã'}</span></div></div></div></div>}
    {calendarMatches&&<div className="modal-overlay"><div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Các lượt thuê cùng ngày"><div className="modal-heading"><h2>{calendarMatches.length} lượt thuê trong ngày</h2><button className="icon-btn" onClick={()=>setCalendarMatches(null)}><X size={19}/></button></div><div className="modal-body">{calendarMatches.map(o=><button type="button" key={o.id} className="gu-v5-job" onClick={()=>{setCalendarMatches(null);openDetail(o);}}><b>{o.code} · {o.customerName}</b><span>{pickupForDisplay(o)?formatVNDateTime(pickupForDisplay(o)!):prettyDay(o.pickupDate)} → {o.returnAt?formatVNDateTime(o.returnAt):prettyDay(o.returnDate)}</span><strong>Xem →</strong></button>)}</div></div></div>}
    {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal(null)}}><div className={'modal '+(modal==='booking'||modal==='detail'?'modal-wide':'')+(modal==='booking'?' '+bookingStyle.bookingDialog:'')} role="dialog" aria-modal="true" aria-label="Biểu mẫu"><div className="modal-heading"><div><div className="eyebrow">{modal==='booking'?(bookingGroup==='CAMERA'?'MÁY ẢNH':'TRANG PHỤC / PHỤ KIỆN'):'GU - THUÊ ĐỒ XINH'}</div><h2>{modal==='booking'?(bookingMode==='RESERVE'?'Đặt lịch trước':'Tạo đơn thuê'):modal==='item'?(editingItem?'Sửa sản phẩm':'Thêm sản phẩm'):modal==='customer'?'Thêm khách hàng':modal==='category'?(editingCategory?'Sửa danh mục':'Thêm danh mục'):'Chi tiết đơn thuê'}</h2></div><button className="icon-btn close-btn" onClick={()=>setModal(null)} aria-label="Đóng"><X size={20}/></button></div>
      {modal==='item'&&<form onSubmit={e=>{e.preventDefault();void saveStockItem();}} className="modal-body">{itemError&&<div className="inline-alert danger-alert" role="alert">{itemError}</div>}<div className="form-grid">
        <Field label="Tên sản phẩm" full><input required className="input" placeholder="Tên sản phẩm" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/></Field>
        <Field label="Danh mục"><select className="input" value={newItem.category} onChange={e=>{const category=e.target.value;setNewItem(v=>({...v,category,requiresLaundry:!isNonLaundryCategory(category),cameraModel:category==='Máy ảnh'?(v.cameraModel||'Canon EOS R50'):'',name:category==='Máy ảnh'?(v.cameraModel||'Canon EOS R50'):v.name}));}}>{categorySelectOptions((data?.categories||[]).map(c=>c.name),newItem.category).map(x=><option key={x}>{x}</option>)}</select></Field>
        {newItem.category==='Máy ảnh'&&<><Field label="Mẫu máy"><select className="input" disabled={Boolean(editingItem)} value={newItem.cameraModel} onChange={e=>setNewItem({...newItem,cameraModel:e.target.value,name:e.target.value})}><option value="Canon EOS R50">Canon EOS R50</option><option value="Canon M50">Canon M50</option></select></Field><Field label="Serial thân máy"><input required className="input" disabled={Boolean(editingItem)} value={newItem.cameraSerial} onChange={e=>setNewItem({...newItem,cameraSerial:e.target.value.toUpperCase()})} placeholder="Số serial trên thân máy"/></Field></>}

        <Field label="Màu sắc"><input className="input" value={newItem.color} onChange={e=>setNewItem({...newItem,color:e.target.value})}/></Field>
        <Field label="Giá thuê"><strong>{newItem.category==='Máy ảnh'?(newItem.cameraModel==='Canon M50'?'3h 90k · 6h 110k · 24h 180k · 48h 340k':'3h 110k · 6h 130k · 24h 190k · 48h 350k'):(/phụ\s*kiện/i.test(newItem.category)?'20.000đ / chu kỳ đầu':'50.000đ / chu kỳ đầu')+' · Các chu kỳ sau theo bảng giá GU'}</strong></Field>
        {!isNonLaundryCategory(newItem.category)&&<Field label="Yêu cầu giặt sau thuê"><span className="gu-check-option"><input type="checkbox" checked={newItem.requiresLaundry} onChange={e=>setNewItem({...newItem,requiresLaundry:e.target.checked})}/> Trả xong tự chuyển Đang giặt; bấm “Đã giặt” mới cho thuê tiếp</span></Field>}
        {(!editingItem||data?.me.role==='admin')&&<Field label="Giá trị đền bù (VND)"><GuMoneyInput required className="input" placeholder="Nhập giá trị đền bù" maxLength={17} value={newItem.replacementValue||''} onValueChange={raw=>setNewItem({...newItem,replacementValue:Number(raw)})}/></Field>}
        {<Field label="Các góc ảnh bắt buộc khi giao/nhận" full><div className="gu-angle-editor"><div className="gu-angle-input-row"><input className="input" value={angleDraft} maxLength={70} placeholder="Nhập tên góc chụp" onChange={e=>setAngleDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addAngle();}}}/><button className="btn btn-white" type="button" disabled={newItem.inspectionAngles.length>=10} onClick={addAngle}><Plus size={16}/> Thêm góc chụp</button></div>{newItem.inspectionAngles.map(angle=><div key={angle} className="gu-angle-added"><span>{angle}</span><button className="icon-btn" type="button" aria-label={'Xóa góc '+angle} onClick={()=>setNewItem(v=>({...v,inspectionAngles:v.inspectionAngles.filter(x=>x!==angle),referenceShots:Object.fromEntries(Object.entries(v.referenceShots).filter(([key])=>key!==angle))}))}><X size={16}/></button></div>)}{newItem.inspectionAngles.length>0&&<button type="button" className="btn btn-white" onClick={()=>setNewItem(v=>({...v,inspectionAngles:[],referenceShots:{}}))}>Xóa tất cả góc chụp</button>}</div></Field>}
        </div>{<div className="photos-form"><strong>Ảnh mẫu theo góc chụp (tùy chọn)</strong><div className="gu-v5-reference-grid">{newItem.inspectionAngles.map(angle=><section key={angle} className="gu-v5-angle"><b>{angle}</b><ImageUploader paths={newItem.referenceShots[angle]?[newItem.referenceShots[angle]]:[]} onUploading={setImageUploading} onChange={paths=>setNewItem(v=>({...v,referenceShots:{...v.referenceShots,[angle]:paths[0]||''}}))}/></section>)}</div></div>}<div className="photos-form"><strong>Ảnh sản phẩm</strong><ImageUploader paths={newItem.imagePaths} onUploading={setImageUploading} onChange={paths=>setNewItem(v=>({...v,imagePaths:paths}))}/></div><div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>setModal(null)}>Hủy</button><button disabled={busy||imageUploading} className="btn btn-dark"><Check size={16}/> {editingItem?'Lưu thay đổi':'Lưu sản phẩm'}</button></div></form>}
      {modal==='customer'&&<form onSubmit={e=>{e.preventDefault();void action('customers',newCustomer,'Đã thêm khách hàng.');}} className="modal-body"><div className="form-grid"><Field label="Họ tên khách hàng" full><input className="input" required placeholder="Nguyễn Thị Mai" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})}/></Field><Field label="Số điện thoại"><input className="input" type="tel" required placeholder="09xxxxxxxx" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})}/></Field><Field label="Ghi chú" full><textarea className="input textarea" rows={3} placeholder="Sở thích, yêu cầu riêng…" value={newCustomer.note} onChange={e=>setNewCustomer({...newCustomer,note:e.target.value})}/></Field></div><div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>setModal(null)}>Hủy</button><button disabled={busy} className="btn btn-dark"><Plus size={17}/> Lưu khách hàng</button></div></form>}
      {modal==='booking'&&<GuV5Booking key={String(modal)+bookingGroup+bookingMode+booking.pickupDate+booking.itemIds.join(':')}
        items={items} customers={customers} api={api} initial={booking} mode={bookingMode} rentalGroup={bookingGroup} onClose={()=>setModal(null)}
        onCustomerCreated={async()=>{await refresh();}}
        onCreated={id=>{if(bookingMode==='PICKUP')setCaptureId(id);}}
        onSuccess={async(message)=>{setToast(message);setModal(null);await refresh();}}/>}
      {modal==='category'&&<form className="modal-body" onSubmit={e=>{e.preventDefault();void action(editingCategory?categoryApiPath(editingCategory):'categories',{name:categoryName},editingCategory?'Đã sửa danh mục.':'Đã thêm danh mục.',editingCategory?'PATCH':'POST');}}><label className="form-field"><span>Tên danh mục</span><input className="input" required maxLength={50} value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Ví dụ: Đầm dự tiệc, Túi xách, Phụ kiện tóc…"/></label>{categories.length>0&&<div className="gu-category-manager"><strong>Danh mục hiện có</strong>{categories.filter(c=>!LEGACY_DEFAULT_CATEGORIES.some(name=>name===c.name)).map(c=><div className="gu-category-row" key={c.id}><span>{c.name}</span>{data?.me.role==='admin'&&<button type="button" className="icon-btn" title="Sửa" onClick={()=>editCategory(c.id,c.name)}><Pencil size={16}/></button>}{data?.me.role==='admin'&&<button type="button" className="icon-btn gu-danger-icon" title="Xóa" onClick={()=>void removeCategory(c.id,c.name)}><Trash2 size={16}/></button>}</div>)}</div>}<div className="modal-actions"><button type="button" className="btn btn-white" onClick={()=>{setEditingCategory(null);setCategoryName('');}}>Tạo danh mục mới</button><button className="btn btn-dark" disabled={busy}>{editingCategory?'Lưu thay đổi':'Lưu danh mục'}</button></div></form>}
      {modal==='detail'&&selectedOrder&&(()=>{const o=orders.find(x=>x.id===selectedOrder.id)||selectedOrder;if(o.pricingVersion)return <GuV5OrderDetail order={o} items={items} api={api} isAdmin={data?.me.role==='admin'} onCapture={()=>{setModal(null);setCaptureId(o.id);}} onChanged={async()=>{setModal(null);await refresh();}}/>;return <div className="modal-body detail-body"><div className="detail-top"><div><span className="eyebrow">MÃ ĐƠN HÀNG</span><h3>{o.code}</h3></div><StatusBadge label={orderLabels[o.status]} status={o.status}/></div><div className="detail-info"><div><span>Khách hàng</span><strong>{o.customerName}</strong><a className="gu-detail-call" href={customerPhoneHref(o.customerPhone)}><PhoneCall size={14}/> {o.customerPhone} · Nhấn để gọi</a></div><div><span>Ngày thuê</span><strong>{prettyDay(o.pickupDate)} → {prettyDay(o.returnDate)}</strong><small>{o.rentalDays} ngày</small></div></div><div className="detail-creator"><span>Nhân viên tạo đơn</span><strong>{creatorName(o)}</strong></div><div className="detail-lines"><strong>Sản phẩm thuê</strong>{o.lines.map(l=><div className="detail-line" key={l.itemId}><ProductImage paths={items.find(i=>i.id===l.itemId)?.imagePaths}/><div><b>{l.name}</b><small>Mã sản phẩm: {items.find(i=>i.id===l.itemId)?.hangerCode||l.hangerCode||'Chưa cấp mã'}</small></div>{o.status!=='PICKED_UP'&&<strong>{money(l.lineTotal)}</strong>}</div>)}</div>{o.status==='PICKED_UP'&&<GuReturnFlow key={`${o.id}:${o.lines.length}:${o.total}`} order={o} items={items} today={today} busy={busy} onSubmit={async payload=>{
    const ok=await action('orders/'+o.id,{action:'RETURN',...payload},'Đã kiểm nhận và hoàn thành đơn trả hàng.','PATCH');
    if(ok)setSelectedOrder(null);
    return ok;
  }}/>}{(o.status==='RESERVED'||o.status==='PICKED_UP')&&o.returnDate>=today&&<section className="gu-v4-extension" aria-label="Gia hạn thuê đồ">
    <div className="gu-v4-extension-heading"><CalendarDays size={19}/><div><strong>Gia hạn ngày thuê</strong><small>Kiểm tra lịch trống và tính tiền phát sinh tự động; không sửa phí của đơn cũ.</small></div></div>
    <div className="gu-v4-extension-controls"><label>Ngày trả mới
      <GuVNDateInput value={extendReturnDate} onChange={setExtendReturnDate}/>
    </label><div className="gu-v4-extension-cost"><small>Tiền thuê thêm dự kiến</small><strong>{extendReturnDate>o.returnDate?(()=>{try {return money(daysInclusive(addDays(o.returnDate,1),extendReturnDate)*o.lines.reduce((v,l)=>v+l.dailyRate,0));}catch{return 'Ngoài giới hạn 30 ngày';}})():'—'}</strong></div>
    <button className="btn btn-dark" type="button" disabled={busy||!extendReturnDate||extendReturnDate<=o.returnDate||extendReturnDate>addDays(o.pickupDate,29)} onClick={()=>{if(confirm(`Gia hạn đơn ${o.code} đến ${prettyDay(extendReturnDate)}? Hệ thống sẽ khóa ngày mới và cộng tiền thuê.`))void action('orders/'+o.id,{action:'EXTEND',returnDate:extendReturnDate},'Đã gia hạn và giữ lịch mới thành công.','PATCH');}}>Gia hạn & kiểm tra lịch</button></div>
  </section>}
  <OrderAddItems order={o} items={items} api={api} onSuccess={async()=>{setToast("Đã thêm sản phẩm vào đơn.");await refresh();}}/>{o.status!=='PICKED_UP'&&<div className="payment-summary"><div><span>Giá thuê</span><strong>{money(o.total)}</strong></div><div><span>Tiền cọc cần thu</span><strong>{money(o.depositDue)}</strong></div>{(o.lateFeeTotal||0)>0&&<div><span>Phí trả trễ ({o.lateDays||0} ngày)</span><strong>{money(o.lateFeeTotal||0)}</strong></div>}{(o.otherFeeTotal||0)>0&&<div><span>Phụ thu khác</span><strong>{money(o.otherFeeTotal||0)}</strong></div>}{(o.compensationTotal||0)>0&&<div className="compensation-line"><span>Phí đền bù đồ thiếu</span><strong>{money(o.compensationTotal||0)}</strong></div>}<div><span>Đã thu</span><strong className="paid-text">{money(o.paid)}</strong></div><div className="payment-remaining"><span>Còn phải thu</span><strong>{money(dueAmount(o)-o.paid)}</strong></div></div>}{o.note&&<div className="detail-note">Ghi chú: {o.note}</div>}<div className="history"><strong>Hoạt động đơn hàng</strong>{o.history.map((h,i)=><div key={i} className="history-line"><span className="history-dot"/><div><b>{h.action==='EXTEND'?'Đã gia hạn ngày thuê':h.action==='ADD_ITEMS'?'Đã thêm đồ vào đơn':h.action==='RESERVED'?'Đã tạo & giữ chỗ':h.action==='PICKUP'?'Đã giao hàng':h.action==='RETURN'?'Đã nhận trả':h.action==='CANCEL'?'Đã hủy':'Ghi nhận thanh toán'}</b><small>{formatVNDateTime(h.at)} {h.amount?(' · '+money(h.amount)):''}</small></div></div>)}</div>{o.status==='RETURNED'&&o.returnInspection&&<div className="inspection-record"><strong>Biên bản nhận đồ</strong>{o.returnInspection.map(c=><p key={c.itemId}>{o.lines.find(l=>l.itemId===c.itemId)?.name||'Sản phẩm'}: {c.status==='OK'?'Đã nhận đủ':'THIẾU · '+money(c.compensation)}</p>)}</div>}{o.status==='RETURNED'&&o.lines.some(l=>items.some(i=>i.id===l.itemId&&i.status==='LAUNDRY'))&&<div className="gu-inline-box"><div className="gu-between"><strong><WashingMachine size={17}/> Đang giặt · xác nhận đã giặt để cho thuê lại</strong></div>{o.lines.map(l=>{const item=items.find(i=>i.id===l.itemId);return item?.status==='LAUNDRY'?<div className="gu-laundry-line" key={l.itemId}><span><strong>{l.name}</strong></span><button className="btn btn-dark" disabled={busy} onClick={()=>void action('items/'+l.itemId,{action:'CLEAN'},'Đã giặt xong. Sản phẩm sẵn sàng cho thuê.','PATCH')}><CheckCircle2 size={15}/> Đã giặt</button></div>:null;})}</div>}{isOverdue(o)&&<div className="overdue-detail late-flash"><BellRing size={19}/> ĐƠN TRẢ TRỄ – quá hạn từ {prettyDay(o.returnDate)}</div>}{o.status!=='CANCELLED'&&<div className="detail-actions">{o.status!=='PICKED_UP'&&dueAmount(o)>o.paid&&<div className="pay-row"><GuMoneyInput className="input" maxLength={17} placeholder="Nhập số tiền thu" value={payAmount} onValueChange={setPayAmount}/><button className="btn btn-white" disabled={busy||Number(payAmount)<=0||Number(payAmount)>dueAmount(o)-o.paid} onClick={()=>void runOrderAction(o.id,'PAY',Number(payAmount))}><CreditCard size={16}/> Thu tiền</button></div>}{o.status==='RESERVED'&&<><button className="btn btn-dark" disabled={busy} onClick={()=>void runOrderAction(o.id,'PICKUP')}><ShoppingBag size={17}/> Xác nhận lấy hàng</button>{data?.me.role==='admin'&&<button className="btn btn-danger" disabled={busy||o.paid>0} title={o.paid>0?'Phải xử lý hoàn tiền trước khi hủy.':''} onClick={()=>{if(window.confirm('Hủy đơn và giải phóng toàn bộ lịch giữ hàng?'))void runOrderAction(o.id,'CANCEL');}}>Hủy đơn</button>}</>}</div>}</div>;})()}
      </div></div>}
  </div></>;
}
function Field({label,full,children}:{label:string;full?:boolean;children:React.ReactNode}){return <label className={'form-field '+(full?'field-full':'')}><span>{label}</span>{children}</label>}
function StatusBadge({status,label}:{status:string;label:string}){const cls=['AVAILABLE','RETURNED'].includes(status)?'success':['PICKED_UP','RENTED'].includes(status)?'blue':status==='LAUNDRY'?'purple':status==='MAINTENANCE'?'slate':['CANCELLED','VOIDED','MISSING'].includes(status)?'danger':'amber';return <span className={'badge badge-'+cls}><i/>{label}</span>}
function Metric({icon:Icon,title,value,detail,tone}:{icon:typeof Wallet;title:string;value:string;detail:string;tone:string}){return <div className="metric"><div className="metric-top"><span className={'metric-icon '+tone}><Icon size={22} strokeWidth={1.8}/></span><ArrowUpRight size={17} color="#ada59d"/></div><span className="metric-name">{title}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>}
function Empty({text,small}:{text:string;small?:boolean}){return <div className={'empty '+(small?'small-empty':'')}><span className="empty-icon"><Package size={22}/></span><p>{text}</p></div>}
