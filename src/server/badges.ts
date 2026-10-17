import "server-only";
// Huy hiệu "số việc" trên điều hướng (FR-NAV-02): đếm nhẹ theo QUYỀN, mỗi loại việc gắn với một mục điều hướng (navId).
// `overdue` > 0 ⇒ đỏ (quá hạn), chỉ `count` ⇒ vàng (đang chờ). Chạy dưới wf_app nên RLS vẫn lọc đúng phạm vi người xem.
// Không trả số tiền/giá vốn — chỉ số lượng. Ngưỡng ngày lấy từ cài đặt giống job cảnh báo hằng ngày (fn_daily_alerts).
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
    key: "ctv_pending", navId: "sales", label: "Đơn CTV chờ xác nhận", perm: ["sale.confirm"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.sales WHERE collaborator_id IS NOT NULL AND status = 'draft'`,
  },
  {
    key: "debt_due", navId: "sales", label: "Khách đến hạn trả nợ", perm: ["debt.view"],
    sql: `SELECT count(*)::int n, (count(*) FILTER (WHERE due_date < app.today_vn()))::int o FROM public.v_doc_balances
          WHERE doc_type IN ('sale','repair') AND due > 0 AND due_date IS NOT NULL AND due_date <= app.today_vn()`,
  },
  {
    key: "reservation_due", navId: "reservations", label: "Giữ hàng sắp/quá hạn", perm: ["reservation.manage"],
    sql: `SELECT count(*)::int n, (count(*) FILTER (WHERE status = 'expired' OR hold_until < app.today_vn()))::int o FROM public.reservations
          WHERE status IN ('active','expired') AND hold_until <= app.today_vn() + app.setting_int('reservation.alert_days', 2)`,
  },
  {
    key: "repair_new", navId: "repairs", label: "Máy mới nhận chờ xử lý", perm: ["repair.view"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.repair_orders WHERE status = 'received'`,
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
  {
    key: "part_low", navId: "parts", label: "Linh kiện sắp hết", perm: ["part.view"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.parts WHERE is_active AND qty_on_hand <= reorder_level`,
  },
  {
    key: "collab_overdue", navId: "collaborators", label: "Chiếc ở CTV quá hạn", perm: ["collab.view"],
    sql: `SELECT count(DISTINCT u.id)::int n, count(DISTINCT u.id)::int o FROM public.watch_units u
          JOIN public.collaborator_assignment_lines l ON l.unit_id = u.id AND l.status = 'active'
          JOIN public.collaborator_assignments a ON a.id = l.assignment_id
          WHERE u.status = 'with_collaborator' AND app.today_vn() - a.doc_date > app.setting_int('collab.hold_alert_days', 30)`,
  },
  {
    key: "warranty_expiring", navId: "warranties", label: "Bảo hành sắp hết hạn", perm: ["warranty.view"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.warranties
          WHERE status = 'active' AND end_date BETWEEN app.today_vn() AND app.today_vn() + app.setting_int('warranty.expiry_alert_days', 14)`,
  },
  {
    key: "stocktake_open", navId: "stocktakes", label: "Kiểm kê đang mở", perm: ["stocktake.manage"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.stocktakes WHERE status = 'open'`,
  },
  {
    key: "ctv_my_pending", navId: "ctv-sales", label: "Đơn chờ cửa hàng xác nhận", perm: ["collab.view_own"],
    sql: `SELECT count(*)::int n, 0::int o FROM public.sales WHERE collaborator_id = app.current_user_id() AND status = 'draft'`,
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
