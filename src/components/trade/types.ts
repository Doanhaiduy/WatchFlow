// Kiểu client cho phiếu nhập / phiếu bán / giữ hàng / bảo hành (khớp DTO máy chủ). Số tiền luôn do máy chủ tính.
export type PurchaseKind = "purchase" | "customer_buyback" | "trade_in" | "opening";

export type PurchaseListItem = {
  id: string; code: string; kind: PurchaseKind; sourceName: string | null; sellerName: string | null; docDate: string; status: "draft" | "confirmed" | "voided";
  grandTotal: number; lineCount: number; createdByName: string | null; createdAt: string;
};
export type PurchaseLine = {
  id?: string; lineNo?: number; lineType: "watch" | "part";
  modelId?: string; modelCode?: string; modelName?: string; brandName?: string; serialNo?: string | null; hasSerial?: boolean;
  condition?: string; conditionGrade?: string | null; conditionNote?: string | null; initialStatus?: string; locationId?: string | null; locationName?: string | null;
  listPrice?: number | null; rebuyUnitId?: string | null;
  partId?: string; partCode?: string; partName?: string; qty: number; unitPrice: number; lineTotal?: number; allocatedCost?: number; unitCost?: number;
  unitId?: string | null; assetCode?: string | null; note?: string | null;
};
export type PurchaseCost = { id?: string; kind: string; description: string | null; amount: number; allocateMethod: "by_value" | "equal" };
export type PurchaseDetail = {
  id: string; code: string | null; kind: PurchaseKind; sourceName: string | null; sellerCustomerId: string | null; sellerName: string | null; sellerPhone: string | null;
  docDate: string; status: "draft" | "confirmed" | "voided"; subtotal: number; extraCostTotal: number; grandTotal: number; paymentNote: string | null; note: string | null;
  confirmedAt: string | null; voidedAt: string | null; voidReason: string | null; version: number; createdAt: string;
  createdByName: string | null; receivedByName: string | null; confirmedByName: string | null;
  lines: PurchaseLine[]; costs: PurchaseCost[]; files: Array<{ id: string; kind: string; thumbUrl: string }>;
};
export type PurchaseConfirmResult = { id: string; code?: string; status: string; units?: Array<{ lineNo: number; unitId: string; assetCode: string; rebuy?: boolean }> };

export type SaleListItem = {
  id: string; code: string | null; status: "draft" | "confirmed" | "voided"; docDate: string; customerId: string | null; customerName: string | null; customerPhone: string | null;
  grandTotal: number; paidNet: number | null; due: number | null; dueDate: string | null; collaboratorId: string | null; lineCount: number; items: string | null;
  createdAt: string; confirmedAt: string | null; createdByName: string | null;
};
export type SaleLine = {
  id: string; lineNo: number; lineType: "watch" | "part"; unitId: string | null; assetCode: string | null; serialNo: string | null; modelName: string | null; brandName: string | null;
  unitStatus: string | null; partId: string | null; partCode: string | null; partName: string | null; qty: number;
  listPrice: number; unitPrice: number; lineDiscount: number; allocDiscount: number; lineTotal: number; isEffective: boolean; note: string | null; cost?: number | null; basePrice?: number | null; collabEarn?: number | null;
};
export type TradeInDraft = {
  modelId: string; serialNo?: string | null; hasSerial: boolean; condition: string; conditionGrade?: string | null; conditionNote?: string | null;
  initialStatus: string; locationId: string; listPrice?: number | null;
};
export type SaleDetail = {
  id: string; code: string | null; status: "draft" | "confirmed" | "voided"; customerId: string | null; customerCode: string | null; customerName: string | null; customerPhone: string | null;
  docDate: string; reservationId: string | null; orderDiscount: number; subtotalList: number; discountTotal: number; discountPct: number; grandTotal: number; tradeInTotal: number;
  depositApplied: number; cashTendered: number | null; dueDate: string | null; note: string | null; confirmedAt: string | null; voidedAt: string | null; voidReason: string | null;
  version: number; createdAt: string; createdByName: string | null; confirmedByName: string | null; collaboratorId: string | null; printCount: number;
  lines: SaleLine[];
  tradeIns: Array<{ id: string; credit: number; draftLine: TradeInDraft | null; purchaseReceiptId: string | null; assetCode: string | null }>;
  payments: Array<{ id: string; code: string; method: "cash" | "bank_transfer"; amount: number; docDate: string; status: string; cashTendered: number | null; voidReason: string | null; createdAt: string; createdByName: string | null }>;
  warranties: Array<{ id: string; code: string; unitId: string; startDate: string; endDate: string; status: string }>;
  balance: { payable: number; paidNet: number; due: number } | null;
  grossProfit?: number;
  /** Xem trước (nháp): số còn phải thu do máy chủ tính */
  payablePreview?: number;
  /** Đơn CTV: doanh thu cửa hàng (tổng giá thu) */
  shopRevenue?: number;
};
export type SaleConfirmResult = { id: string; code: string; status: string; grandTotal: number; tradeIn: number; depositApplied: number; payable: number; paid: number; due: number; change: number };

export type Reservation = {
  id: string; code: string; status: "active" | "expired" | "converted" | "cancelled" | "forfeited"; docDate: string; holdUntil: string; overdue: boolean;
  customerId: string; customerName: string; customerPhone: string | null; unitId: string; assetCode: string; modelName: string; priceSnapshot: number; minDeposit: number;
  received: number | null; held: number | null; applied: number; forfeited: number; saleId: string | null; note: string | null; createdByName: string | null;
};
export type Warranty = {
  id: string; code: string; kind: string; status: string; startDate: string; endDate: string; effectiveStatus: "active" | "expired" | "voided"; daysLeft: number;
  unitId: string | null; assetCode: string | null; serialNo: string | null; modelName: string | null; customerId: string | null; customerName: string | null; customerPhone: string | null;
  saleId: string | null; saleCode: string | null; repairOrderId: string | null; brandText: string | null; modelText: string | null;
};
