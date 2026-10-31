export type ItemStatus = 'AVAILABLE' | 'RENTED' | 'LAUNDRY' | 'MAINTENANCE' | 'MISSING';
export type OrderStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED' | 'VOIDED';
export type Role = 'admin' | 'staff';
export interface InventoryItem {
  id: string; name: string; nameKey?: string; nameSearchBigrams?: string[]; visualSignature?: import('./visual-index').VisualSignature; visualSignatures?: import('./visual-index').VisualIndexEntry[]; visualImagePath?: string; sku: string; hangerCode?: string; category: string; size: string; color: string;
  cameraModel?: import('./camera-rental').CameraModel; cameraSerial?: string;
  dailyRate: number; bufferDays: number; replacementValue: number;
  inspectionAngles?: string[]; referenceShots?: Record<string,string>; archivedAt?: string|null; imagePaths?: string[]; requiresLaundry?: boolean; laundryStartedAt?: string|null; laundryCompletedAt?: string|null; expectedReturnDate?: string|null; currentOrderId?: string|null; status: ItemStatus; createdAt: string; createdBy?: string;
}
export interface Customer { id: string; name: string; phone: string; sizeNote?: string; note: string; createdAt: string; }
export interface RentalLine {
  itemId: string; name: string; sku: string; hangerCode?: string; size: string;
  cameraModel?: import('./camera-rental').CameraModel; cameraSerial?: string;
  cameraPackageHours?: import('./camera-rental').CameraPackageHours; cameraPackageBasePrice?: number;
  dailyRate: number; category?: string; bufferDays: number; replacementValue: number; lineTotal: number; startDate?: string; startAt?: string;
}
export interface ProductCategory { id: string; name: string; createdAt: string; }
export type InspectionStatus = 'OK' | 'MISSING';
export interface ReturnInspection { itemId: string; sku: string; status: InspectionStatus; compensation: number; }
export interface RentalEvent { action: string; at: string; by: string; detail?: string; amount?: number; }
export interface RentalOrder {
  id: string; code: string; customerId: string; customerName: string; customerPhone: string;
  pickupDate: string; returnDate: string; rentalDays: number;
  lines: RentalLine[]; total: number; paid: number; depositDue: number;
  refundTotal?: number; compensationTotal?: number; returnInspection?: ReturnInspection[]; lateDays?: number; lateFeeTotal?: number; otherFeeTotal?: number; surchargeNote?: string; returnedAt?: string;
  settlementPolicyVersion?: 'CLOTHING_CASH_OR_ID_V1'|'CAMERA_CASH_OR_ID_V2'; collateralRequiredAmount?: number; handoverCashCollateralAmount?: number; collateralAppliedAmount?: number; collateralRefundedAmount?: number; bookingKind?: 'RESERVE'|'WALK_IN'; bookedRentTotal?: number; prepaidRentTotal?: number; reservationPaymentProofId?: string; handoverDepositProofId?: string; handoverDepositKind?: 'CCCD'|'CASH'|'OTHER'; hadHandoverDeposit?: boolean; sensitiveEvidenceStatus?: 'DELETING'|'PURGED'; sensitiveEvidencePurgedAt?: string; collateralReturnedAt?: string; collateralReturnedBy?: string; photoReviewAssessments?: Record<string,'OK'|'ISSUE'|'MISSING'>; photoReviewStatus?: 'PENDING'|'REVIEWED'; photoReviewedAt?: string; photoReviewedBy?: string; refundPending?: number;
  pickupAt?: string; scheduledPickupAt?: string; returnAt?: string; pricingVersion?: 'GU_HOURLY_V1'; rentalType?: 'CLOTHING'|'ACCESSORY'; rentalGroup?: 'CAMERA'|'CLOTHING'; photoTemplates?: Record<string,string[]>; referencePhotos?: Record<string,Record<string,string>>; pendingExtraItemIds?: string[]; handoverProof?: import('./inspection-proof').ProofSet; returnProof?: import('./inspection-proof').ProofSet; returnStage?: 'AWAITING_ADMIN'|'APPROVED'; cameraLateFeePending?: boolean; cameraLatePendingItemIds?: string[]; cameraOvertimeFeeTotal?: number; voidedAt?: string; voidedBy?: string; note: string; status: OrderStatus; createdAt: string; updatedAt: string; createdBy: string; createdByName?: string; history: RentalEvent[];
}
export interface StaffProfile { uid: string; name: string; email: string; username?:string; role: Role; disabled: boolean; createdAt?: string; }
export interface AuditRecord {
  id: string; actorUid: string; actorName: string; actorRole: Role;
  action: string; entityType: string; entityId: string; detail: string; createdAt: string;
}
export interface DashboardData {
  items: InventoryItem[]; customers: Customer[]; orders: RentalOrder[]; categories: ProductCategory[];
  me: { uid: string; role: Role; name: string }; staffNames?: Record<string,string>; calendarCreatorOptions?:Array<{uid:string;name:string}>; counts?:{items:number;available:number;laundry:number;rented:number;missing:number;customers:number;activeOrders:number};
}
