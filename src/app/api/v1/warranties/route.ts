import { api } from "@/server/http";
import { WarrantyQuery } from "@/lib/types/sales";

// Tra cứu bảo hành theo mã phiếu / SĐT khách / mã chiếc / serial; lọc sắp hết hạn (≤ warranty.expiry_alert_days)
export const GET = api({ perm: ["warranty.view", "repair.view"], query: WarrantyQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    if (query.status) { p.push(query.status); c.push(`w.status = $${p.length}`); }
    if (query.expiring) c.push("w.status = 'active' AND w.end_date <= app.today_vn() + app.setting_int('warranty.expiry_alert_days', 14)");
    if (query.q) {
      p.push(query.q);
      const i = p.length;
      c.push(`(w.code = upper($${i}) OR s.code = upper($${i}) OR u.asset_code = upper($${i}) OR u.serial_norm = app.norm_serial($${i})
               OR cw.serial_norm = app.norm_serial($${i}) OR (app.norm_phone($${i}) IS NOT NULL AND cu.phone_norm = app.norm_phone($${i})))`);
    }
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const items = await tx.q(
      `SELECT w.id, w.code, w.kind, w.status, w.start_date AS "startDate", w.end_date AS "endDate",
              CASE WHEN w.status = 'active' AND w.end_date < app.today_vn() THEN 'expired' ELSE w.status END AS "effectiveStatus",
              (w.end_date - app.today_vn()) AS "daysLeft", w.unit_id AS "unitId", u.asset_code AS "assetCode", u.serial_no AS "serialNo", m.name AS "modelName",
              w.customer_id AS "customerId", cu.full_name AS "customerName", cu.phone AS "customerPhone", s.id AS "saleId", s.code AS "saleCode",
              w.repair_order_id AS "repairOrderId", cw.brand_text AS "brandText", cw.model_text AS "modelText"
       FROM public.warranties w
       LEFT JOIN public.watch_units u ON u.id = w.unit_id LEFT JOIN public.watch_models m ON m.id = u.model_id
       LEFT JOIN public.sale_lines sl ON sl.id = w.sale_line_id LEFT JOIN public.sales s ON s.id = sl.sale_id
       LEFT JOIN public.customers cu ON cu.id = w.customer_id LEFT JOIN public.customer_watches cw ON cw.id = w.customer_watch_id
       ${where} ORDER BY w.end_date DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    return { items, page: query.page, pageSize: query.pageSize };
  });
});
