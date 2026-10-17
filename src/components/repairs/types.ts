// Kiểu client cho phiếu sửa chữa. Giá vốn linh kiện (`cost`, `partsCost`) và lãi (`grossProfit`) chỉ có khi máy chủ trả (cost.view/profit.view).
export type RepairStatus = "received" | "inspecting" | "repairing" | "waiting_parts" | "completed" | "delivered" | "cancelled";
export type RepairListItem = {
  id: string; code: string; kind: "customer" | "internal"; chargeMode: string; status: RepairStatus; receivedAt: string; expectedDate: string | null;
  customerId: string | null; customerName: string | null; customerPhone: string | null; watchLabel: string | null; serialNo: string | null; complaint: string | null;
  finalTotal: number | null; linesTotal: number; lineCount: number; progress: number; held: number | null; due: number | null;
};
/** Tổng tiền hiển thị: chỉ khi đã hoàn thành/đã giao mới dùng số chốt (final_total mặc định 0 lúc đang sửa); còn lại là tổng các dòng hiện có. */
export function repairTotal(r: Pick<RepairListItem, "status" | "finalTotal" | "linesTotal">): number {
  return (r.status === "completed" || r.status === "delivered") && r.finalTotal !== null ? r.finalTotal : r.linesTotal;
}
export type RepairLine = {
  id: string; lineNo: number; lineType: "service" | "part" | "other"; serviceTypeId: string | null; serviceName: string | null; partId: string | null; partCode: string | null; partName: string | null;
  partStock: number | null; description: string | null; qty: number; unitPrice: number; lineTotal: number; consumedAt: string | null; cost?: number;
};
export type RepairDetail = RepairListItem & {
  paidNet: number | null; warrantyId: string | null; unitId: string | null; customerWatchId: string | null; intakeCondition: string | null; findings: string | null;
  quoteApprovedAt: string | null; quoteApprovedChannel: string | null; completedAt: string | null; deliveredAt: string | null; dueDate: string | null; revenue: number | null;
  cancelReason: string | null; version: number; receivedByName: string | null;
  lines: RepairLine[];
  payments: Array<{ id: string; code: string; direction: string; purpose: string; method: "cash" | "bank_transfer"; amount: number; docDate: string; status: string; createdAt: string }>;
  history: Array<{ from: string | null; to: string; at: string; reason: string | null; actorName: string | null }>;
  warranty: { id: string; code: string; startDate: string; endDate: string; status: string } | null;
  photos: Array<{ id: string; thumbUrl: string; url: string }>;
  partsCost?: number; grossProfit?: number;
};
export type ServiceType = { id: string; code: string; name: string; defaultPrice: number; isActive: boolean };
