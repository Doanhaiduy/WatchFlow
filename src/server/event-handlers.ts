import "server-only";
// Đăng ký handler outbox (extensibility: module giao tiếp qua domain_events). Import một lần ở jobs/dispatch.
import { onEvent } from "./outbox";

let registered = false;
export function registerEventHandlers() {
  if (registered) return;
  registered = true;
  // Đơn CTV chờ xác nhận ⇒ báo người có quyền xác nhận (FR-PLAT-02)
  onEvent("collab.order_submitted", async (ev, tx) => {
    await tx.q(
      "SELECT app.fn_notify_permission('sale.confirm', 'collab.order', 'Đơn CTV chờ xác nhận', 'Cộng tác viên vừa gửi một đơn bán cần xác nhận.', $1, $2)",
      [`/ban-hang/${ev.payload.saleId}`, `colord:${ev.payload.saleId}`],
    );
  });
  // Linh kiện xuống thấp khi điều chỉnh ⇒ báo người quản lý linh kiện
  onEvent("part.low_stock", async (ev, tx) => {
    await tx.q(
      `SELECT app.fn_notify_permission('part.manage', 'part.low_stock', 'Linh kiện sắp hết: ' || p.code, p.name || ' còn ' || p.qty_on_hand || '.', '/linh-kien/' || p.id, 'low:' || p.id || ':' || app.today_vn())
       FROM public.parts p WHERE p.id = $1`,
      [ev.payload.partId],
    );
  });
}
