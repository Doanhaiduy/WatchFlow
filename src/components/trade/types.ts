// Kiểu client cho đơn bán / thêm đồng hồ (khớp DTO máy chủ). Số tiền luôn do máy chủ tính.
export type PurchaseConfirmResult = { id: string; code?: string; status: string; units?: Array<{ lineNo: number; unitId: string; assetCode: string; rebuy?: boolean }> };

export type SaleListItem = {
  id: string; code: string; status: "confirmed" | "voided"; docDate: string; customerId: string | null; customerName: string | null; customerPhone: string | null;
  grandTotal: number; collaboratorId: string | null; collaboratorName: string | null; lineCount: number; items: string | null; firstModelId: string | null;
  thumbUrl: string | null; confirmedAt: string | null;
};
export type SaleLine = {
  id: string; lineNo: number; unitId: string; assetCode: string; serialNo: string | null; condition: string; modelName: string; brandName: string;
  listPrice: number; unitPrice: number; lineTotal: number; warrantyEnd: string | null; thumbUrl: string | null;
};
export type SaleDetail = {
  id: string; code: string; status: "confirmed" | "voided"; customerId: string | null; customerCode: string | null; customerName: string | null; customerPhone: string | null;
  docDate: string; subtotalList: number; discountTotal: number; grandTotal: number; note: string | null;
  confirmedAt: string | null; voidedAt: string | null; voidReason: string | null; voidUntil: string | null; createdAt: string; confirmedByName: string | null;
  collaboratorId: string | null; collaboratorName: string | null; printCount: number; lines: SaleLine[];
};

export type ClaimStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "voided";
export const CLAIM_LABELS: Record<ClaimStatus, string> = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", rejected: "Bị từ chối", cancelled: "Đã rút", voided: "Đơn đã hủy" };
