import "server-only";
// Huy hiệu "số việc" trên điều hướng (FR-NAV-02): đếm nhẹ theo QUYỀN, mỗi loại việc gắn với một mục điều hướng (navId).
// `overdue` > 0 ⇒ đỏ (quá hạn), chỉ `count` ⇒ vàng (đang chờ). Chạy dưới wf_app nên RLS vẫn lọc đúng phạm vi người xem.
// Không trả số tiền/giá vốn — chỉ số lượng. Bản gọn (CF-18): chỉ còn việc thật sự cần ai đó làm.
import type { Tx } from "./db";
import type { Permission } from "@/lib/permissions";

type CanFn = (p: Permission | Permission[]) => boolean;

export type BadgeItem = {
  key: string;
  /** id mục điều hướng (src/components/layout/nav.ts) */
  navId: string;
  label: string;
  /** Tổng số việc (đã gồm số quá hạn) */
  count: number;
  /** Trong đó quá hạn */
  overdue: number;
};

type Def = { key: string; navId: string; label: string; perm: Permission | Permission[]; sql: string };

// Mỗi định nghĩa trả đúng hai cột: n (tổng), o (quá hạn)
const DEFS: Def[] = [
  {
    key: "claim_pending", navId: "collaborators", label: "CTV báo đã bán, chờ xác nhận", perm: ["sale.confirm"],
    sql: `SELECT count(*)::int n, (count(*) FILTER (WHERE created_at < now() - interval '1 day'))::int o FROM public.collaborator_claims WHERE status = 'pending'`,
  },
  {
    key: "repair_new", navId: "repairs", label: "Máy mới nhận chờ xử lý", perm: ["repair.view"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.repair_orders WHERE status = 'received' AND kind = 'customer'`,
  },
  {
    key: "repair_late", navId: "repairs", label: "Máy quá hẹn trả", perm: ["repair.view"],
    sql: `SELECT count(*)::int n, count(*)::int o FROM public.repair_orders
          WHERE status IN ('received','inspecting','repairing','waiting_parts') AND kind = 'customer' AND expected_date < app.today_vn()`,
  },
  {
    key: "repair_pickup", navId: "repairs", label: "Máy xong chưa lấy", perm: ["repair.view"],
    sql: `SELECT count(*)::int n, (count(*) FILTER (WHERE (completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= app.today_vn() - app.setting_int('repair.pickup_alert_days', 14)))::int o
          FROM public.repair_orders WHERE status = 'completed' AND kind = 'customer'`,
  },
];

/** Chỉ chạy các truy vấn mà người gọi có quyền (không quyền ⇒ không đếm, không lộ số liệu). */
export async function loadBadges(tx: Tx, can: CanFn): Promise<{ items: BadgeItem[]; total: number; overdue: number }> {
  const items: BadgeItem[] = [];
  for (const d of DEFS.filter((x) => can(x.perm))) {
    const r = await tx.one<{ n: number; o: number }>(d.sql);
    const count = r?.n ?? 0;
    if (count > 0) items.push({ key: d.key, navId: d.navId, label: d.label, count, overdue: Math.min(r?.o ?? 0, count) });
  }
  return { items, total: items.reduce((s, i) => s + i.count, 0), overdue: items.reduce((s, i) => s + i.overdue, 0) };
}
