// Kiểu client cho cộng tác viên (CTV). Giá thu giao CTV (`basePrice`) CTV được xem; GIÁ VỐN thì không bao giờ có ở đây.
export type CollabRow = { id: string; fullName: string; phone: string | null; area: string | null; note: string | null; isActive: boolean; holding: number; holdingValue: number | string; unsettled: number | string; pendingOrders: number };
export type CollabUnit = {
  id: string; assetCode: string; status: string; condition: string; conditionGrade: string | null; serialNo: string | null; modelId: string; modelCode: string; modelName: string; brandName: string;
  listPrice: number; basePrice: number; assignedDate: string; assignmentCode: string | null; daysHeld: number; collaboratorId: string; thumbUrl: string | null;
};
export type Unsettled = { id: string; saleId: string; saleCode: string; docDate: string; assetCode: string; modelName: string; salePrice: number; basePrice: number; collabEarn: number };
export type CollabDetail = {
  id: string; fullName: string; phone: string | null; area: string | null; note: string | null; isActive: boolean;
  units: CollabUnit[];
  orders: Array<{ id: string; code: string | null; status: string; docDate: string; grandTotal: number; customerName: string | null; createdAt: string }>;
  settlements: Array<{ id: string; code: string; docDate: string; status: string; total: number; method: string; note: string | null; voidReason: string | null }>;
  assignments: Array<{ id: string; code: string; status: string; docDate: string; lineCount: number }>;
  unsettled: Unsettled[];
};
export type StatRow = { collaboratorId: string; collaboratorName: string; periodStart: string; unitsSold: number | string; salesTotal: number | string; baseTotal: number | string; collabEarn: number | string; settled: number | string; unsettled: number | string };
export type Stats = { from: string; to: string; period: string; rows: StatRow[]; totals: { unitsSold: number; salesTotal: number; baseTotal: number; collabEarn: number; settled: number; unsettled: number } };
export type MySale = {
  id: string; code: string | null; status: "draft" | "confirmed" | "voided"; docDate: string; grandTotal: number; customerName: string | null; customerPhone: string | null; createdAt: string; confirmedAt: string | null; voidReason: string | null;
  lines: Array<{ assetCode: string; modelName: string; salePrice: number; basePrice: number | null; settled: boolean }>;
};
export const n = (v: number | string | null | undefined) => Number(v ?? 0);
