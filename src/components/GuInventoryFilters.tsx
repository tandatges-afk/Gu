'use client';
import {Search,Filter} from 'lucide-react';
import type {InventoryItem} from '@/lib/types';
import styles from './GuInventoryFilters.module.css';
type Props={query:string;setQuery:(v:string)=>void;status:'ALL'|InventoryItem['status'];setStatus:(v:Props['status'])=>void;category:string;setCategory:(v:string)=>void;categories:string[];clearError:()=>void};
const labels:Record<InventoryItem['status'],string>={AVAILABLE:'Sẵn sàng',RENTED:'Đang thuê',LAUNDRY:'Đang giặt',MAINTENANCE:'Bảo trì',MISSING:'Thất lạc'};
export function GuInventoryFilters({query,setQuery,status,setStatus,category,setCategory,categories,clearError}:Props){
 return <div className={styles.filters} aria-label="Bộ lọc kho">
  <label className={styles.search}><Search size={19}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);clearError();}} placeholder="Tìm sản phẩm" aria-label="Tìm sản phẩm"/></label>
  <label className={styles.select}><Filter size={17}/><select value={status} onChange={e=>setStatus(e.target.value as Props['status'])} aria-label="Tình trạng kho"><option value="ALL">Tất cả tình trạng</option>{(Object.keys(labels) as InventoryItem['status'][]).map(key=><option value={key} key={key}>{labels[key]}</option>)}</select></label>
  <label className={styles.select}><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Danh mục sản phẩm"><option value="ALL">Tất cả danh mục</option>{categories.map(name=><option value={name} key={name}>{name}</option>)}</select></label>
  {(query||status!=='ALL'||category!=='ALL')&&<button type="button" className={styles.reset} onClick={()=>{setQuery('');setStatus('ALL');setCategory('ALL');clearError();}}>Xóa lọc</button>}
 </div>;
}
