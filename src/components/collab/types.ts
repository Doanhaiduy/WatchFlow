// Kiểu client cho cộng tác viên (CTV). Chủ thấy giá niêm yết + doanh thu; CTV chỉ thấy giá niêm yết (không doanh thu/giá vốn).
export type CollabRow = { id: string; fullName: string; phone: string | null; area: string | null; note: string | null; isActive: boolean; offered: number; pendingClaims: number; soldMonth: number; revenueMonth: number | string };
export type OfferedCollab = { collaboratorId: string; name: string | null; offeredAt: string; claimId: string | null };
export type OfferedUnit = {
  id: string; assetCode: string; serialNo: string | null; condition: string; conditionGrade: string | null; modelName: string; brandName: string;
  listPrice: number; thumbUrl: string | null; offeredAt: string; collaborators: OfferedCollab[];
};
export type ClaimStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "voided";
export type ClaimRow = {
  id: string; status: ClaimStatus; unitId: string; assetCode: string; condition: string; modelName: string; brandName: string; listPrice: number;
  collaboratorId: string; collaboratorName: string | null; customerName: string; customerPhone: string; note: string | null; rejectReason: string | null;
  createdAt: string; decidedAt: string | null; decidedByName: string | null; saleId: string | null; saleCode: string | null; salePrice: number | null; thumbUrl: string | null;
};
export type CollabDetail = {
  id: string; fullName: string; phone: string | null; area: string | null; note: string | null; isActive: boolean;
  units: OfferedUnit[]; claims: ClaimRow[];
  orders: Array<{ id: string; code: string; status: string; docDate: string; grandTotal: number; customerName: string | null; items: string | null }>;
};

/** Hàng của CTV (màn của chính CTV) */
export type MyOffer = {
  id: string; assetCode: string; serialNo: string | null; condition: string; conditionGrade: string | null; modelName: string; brandName: string;
  listPrice: number; offeredAt: string; claimId: string | null; taken: boolean; thumbUrl: string | null;
};
export type MyClaim = {
  id: string; unitId: string; assetCode: string; modelName: string; brandName: string; customerName: string; customerPhone: string; note: string | null;
  status: ClaimStatus; rejectReason: string | null; createdAt: string; decidedAt: string | null; thumbUrl: string | null;
};
export type MyStats = { from: string; to: string; period: string; rows: Array<{ periodStart: string; unitsSold: number }>; total: number };
export const n = (v: number | string | null | undefined) => Number(v ?? 0);
