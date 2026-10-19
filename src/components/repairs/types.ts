// Kiểu client cho phiếu sửa chữa (chỉ chủ). Không giá vốn/lãi/thanh toán (CF-16).
export type RepairStatus = "received" | "inspecting" | "repairing" | "waiting_parts" | "completed" | "delivered" | "cancelled";
export type RepairListItem = {
  id: string; code: string; chargeMode: string; status: RepairStatus; receivedAt: string; expectedDate: string | null;
  customerId: string | null; customerName: string | null; customerPhone: string | null; watchLabel: string | null; serialNo: string | null; complaint: string | null;
  finalTotal: number | null; linesTotal: number; lineCount: number; progress: number;
};
/** Tổng tiền hiển thị: chỉ khi đã sửa xong/đã giao mới dùng số chốt (final_total mặc định 0 lúc đang sửa); còn lại là tổng các khoản hiện có. */
export function repairTotal(r: Pick<RepairListItem, "status" | "finalTotal" | "linesTotal">): number {
  return (r.status === "completed" || r.status === "delivered") && r.finalTotal !== null ? r.finalTotal : r.linesTotal;
}
export type RepairLine = {
  id: string; lineNo: number; lineType: "service" | "other"; serviceTypeId: string | null; serviceName: string | null;
  description: string | null; qty: number; unitPrice: number; lineTotal: number;
};
export type RepairDetail = RepairListItem & {
  warrantyId: string | null; unitId: string | null; customerWatchId: string | null; intakeCondition: string | null; findings: string | null;
  completedAt: string | null; deliveredAt: string | null; deliveredDate: string | null; revenue: number | null;
  cancelReason: string | null; version: number; receivedByName: string | null;
  lines: RepairLine[];
  history: Array<{ from: string | null; to: string; at: string; reason: string | null; actorName: string | null }>;
  warranty: { id: string; code: string; startDate: string; endDate: string; status: string } | null;
  photos: Array<{ id: string; thumbUrl: string; url: string }>;
};
export type ServiceType = { id: string; code: string; name: string; defaultPrice: number; isActive: boolean };
