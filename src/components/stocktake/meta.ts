// Nhãn tiếng Việt và kiểu cho kiểm kê
export type Stocktake = { id: string; code: string; scope: string; status: string; locationId: string | null; locationName: string | null; startedAt: string; reconciledAt: string | null; startedByName: string | null; note: string | null; lineCount: number; countedCount: number; loss: number | string };
export const SCOPE_LABEL: Record<string, string> = { all_units: "Tất cả chiếc", location: "Theo vị trí", parts: "Linh kiện", all: "Tất cả (chiếc + linh kiện)" };
export const ST_LABEL: Record<string, { label: string; tone: "info" | "ok" | "neutral" | "bad" }> = {
  open: { label: "Đang kiểm", tone: "info" }, counting: { label: "Đang kiểm", tone: "info" }, in_progress: { label: "Đang kiểm", tone: "info" },
  reconciled: { label: "Đã chốt", tone: "ok" }, cancelled: { label: "Đã hủy", tone: "neutral" },
};

export const REASON_LABEL: Record<string, string> = { lost: "Mất", damaged: "Hư hỏng", input_error: "Nhập liệu sai", count_error: "Đếm sai", found: "Tìm thấy", other: "Lý do khác" };
export type StocktakeLine = {
  id: string; subjectType: "unit" | "part"; unitId: string | null; assetCode: string | null; serialNo: string | null; modelName: string | null; unitStatus: string | null; locationName: string | null;
  partId: string | null; partCode: string | null; partName: string | null; systemQty: number; expectedQty: number | null; countedQty: number | null; diffQty: number | null;
  reasonCode: string | null; note: string | null; applied: boolean; loss?: number | string;
};
export type StocktakeDetail = { id: string; code: string; scope: string; status: string; locationId: string | null; startedAt: string; reconciledAt: string | null; note: string | null; lines: StocktakeLine[] };
