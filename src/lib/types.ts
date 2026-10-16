export type ItemStatus = 'AVAILABLE' | 'RENTED' | 'LAUNDRY' | 'MAINTENANCE' | 'MISSING';
export type OrderStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED';
export type Role = 'admin' | 'staff';
export interface InventoryItem {
  id: string; name: string; sku: string; hangerCode?: string; category: string; size: string; color: string;
  dailyRate: number; bufferDays: number; replacementValue: number;
  archivedAt?: string|null; imagePaths?: string[]; requiresLaundry?: boolean; laundryStartedAt?: string|null; laundryCompletedAt?: string|null; expectedReturnDate?: string|null; currentOrderId?: string|null; status: ItemStatus; createdAt: string; createdBy?: string;
}
export interface Customer { id: string; name: string; phone: string; sizeNote?: string; note: string; createdAt: string; }
export interface RentalLine {
  itemId: string; name: string; sku: string; hangerCode?: string; size: string;
  dailyRate: number; bufferDays: number; replacementValue: number; lineTotal: number; startDate?: string;
}
export interface ProductCategory { id: string; name: string; createdAt: string; }
export type InspectionStatus = 'OK' | 'MISSING';
export interface ReturnInspection { itemId: string; sku: string; status: InspectionStatus; compensation: number; }
export interface RentalEvent { action: string; at: string; by: string; detail?: string; amount?: number; }
export interface RentalOrder {
  id: string; code: string; customerId: string; customerName: string; customerPhone: string;
  pickupDate: string; returnDate: string; rentalDays: number;
  lines: RentalLine[]; total: number; paid: number; depositDue: number;
  compensationTotal?: number; returnInspection?: ReturnInspection[]; lateDays?: number; lateFeeTotal?: number; otherFeeTotal?: number; surchargeNote?: string; returnedAt?: string;
  note: string; status: OrderStatus; createdAt: string; updatedAt: string; createdBy: string; createdByName?: string; history: RentalEvent[];
}
export interface StaffProfile { uid: string; name: string; email: string; role: Role; disabled: boolean; createdAt?: string; }
export interface AuditRecord {
  id: string; actorUid: string; actorName: string; actorRole: Role;
  action: string; entityType: string; entityId: string; detail: string; createdAt: string;
}
export interface DashboardData {
  items: InventoryItem[]; customers: Customer[]; orders: RentalOrder[]; categories: ProductCategory[];
  me: { uid: string; role: Role; name: string }; staffNames?: Record<string,string>; counts?:{items:number;available:number;laundry:number;rented:number;missing:number;customers:number;activeOrders:number};
}
