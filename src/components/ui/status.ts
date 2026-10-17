import type { Tone } from "./cx";

// Ánh xạ trạng thái nghiệp vụ → nhãn + tone (ui-design-system §3). Luôn kèm chữ, tone chỉ là phụ.
export type StatusKind = "unit" | "repair" | "doc" | "warranty" | "reservation";
export type StatusInfo = { label: string; tone: Tone };

export const STATUS_MAP: Record<StatusKind, Record<string, StatusInfo>> = {
  unit: {
    in_stock: { label: "Sẵn sàng bán", tone: "ok" },
    reserved: { label: "Đã giữ", tone: "hold" },
    with_collaborator: { label: "Đang ở CTV", tone: "info" },
    sold: { label: "Đã bán", tone: "neutral" },
    in_repair: { label: "Đang sửa", tone: "repair" },
    inspecting: { label: "Chờ kiểm tra", tone: "check" },
    written_off: { label: "Thanh lý/mất", tone: "bad" },
    cancelled: { label: "Nhập nhầm", tone: "neutral" },
  },
  repair: {
    received: { label: "Đã nhận", tone: "info" },
    inspecting: { label: "Đang kiểm tra", tone: "check" },
    repairing: { label: "Đang sửa", tone: "repair" },
    waiting_parts: { label: "Chờ linh kiện", tone: "hold" },
    completed: { label: "Hoàn thành", tone: "ok" },
    delivered: { label: "Đã giao", tone: "neutral" },
    cancelled: { label: "Đã hủy", tone: "bad" },
  },
  doc: {
    draft: { label: "Nháp", tone: "neutral" },
    confirmed: { label: "Đã xác nhận", tone: "ok" },
    voided: { label: "Đã hủy", tone: "bad" },
    debt: { label: "Còn nợ", tone: "hold" },
  },
  warranty: {
    active: { label: "Còn hạn", tone: "ok" },
    expiring: { label: "Sắp hết hạn", tone: "hold" },
    expired: { label: "Hết hạn", tone: "neutral" },
    voided: { label: "Đã hủy", tone: "bad" },
  },
  reservation: {
    active: { label: "Đang giữ", tone: "hold" },
    expired: { label: "Quá hạn", tone: "bad" },
    converted: { label: "Đã chuyển bán", tone: "ok" },
    cancelled: { label: "Đã hủy", tone: "neutral" },
    forfeited: { label: "Tịch thu cọc", tone: "neutral" },
  },
};

const FALLBACK: StatusInfo = { label: "—", tone: "neutral" };

export function statusInfo(kind: StatusKind, status: string): StatusInfo {
  return STATUS_MAP[kind][status] ?? { ...FALLBACK, label: status || FALLBACK.label };
}

/** Bảo hành: quá ≤ 14 ngày là "sắp hết". `daysLeft` < 0 ⇒ hết hạn. */
export function warrantyStatus(daysLeft: number, voided = false): "active" | "expiring" | "expired" | "voided" {
  if (voided) return "voided";
  if (daysLeft < 0) return "expired";
  return daysLeft <= 14 ? "expiring" : "active";
}
