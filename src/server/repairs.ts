import "server-only";
// Phiếu sửa (chỉ chủ — repair.*): đọc danh sách/chi tiết. Bản gọn (CF-16): không linh kiện, không thanh toán/nợ, không giá vốn/lãi.
import type { Tx } from "./db";

export const REPAIR_LIST_SELECT = `
  SELECT o.id, o.code, o.charge_mode AS "chargeMode", o.status, o.received_at AS "receivedAt", o.expected_date AS "expectedDate",
         o.customer_id AS "customerId", c.full_name AS "customerName", c.phone AS "customerPhone",
         coalesce(u.asset_code, nullif(concat_ws(' ', cw.brand_text, cw.model_text), '')) AS "watchLabel", coalesce(u.serial_no, cw.serial_no) AS "serialNo",
         o.customer_complaint AS complaint, o.final_total_vnd AS "finalTotal",
         (SELECT coalesce(sum(line_total_vnd),0)::bigint FROM public.repair_lines rl WHERE rl.order_id = o.id) AS "linesTotal",
         (SELECT count(*)::int FROM public.repair_lines rl WHERE rl.order_id = o.id) AS "lineCount",
         CASE o.status WHEN 'received' THEN 10 WHEN 'inspecting' THEN 30 WHEN 'waiting_parts' THEN 50 WHEN 'repairing' THEN 70 WHEN 'completed' THEN 90 ELSE 100 END AS progress
  FROM public.repair_orders o LEFT JOIN public.customers c ON c.id = o.customer_id LEFT JOIN public.customer_watches cw ON cw.id = o.customer_watch_id
  LEFT JOIN public.watch_units u ON u.id = o.unit_id`;

export async function getRepair(tx: Tx, idOrCode: string) {
  const o = await tx.one<Record<string, unknown>>(
    `${REPAIR_LIST_SELECT.replace('AS progress', `AS progress, o.warranty_id AS "warrantyId", o.unit_id AS "unitId",
       o.customer_watch_id AS "customerWatchId", o.intake_condition AS "intakeCondition", o.findings,
       o.completed_at AS "completedAt", o.delivered_at AS "deliveredAt", o.delivered_date AS "deliveredDate",
       o.revenue_vnd AS revenue, o.cancel_reason AS "cancelReason", o.version, app.user_display_name(o.received_by) AS "receivedByName"`)}
     WHERE (o.id::text = $1 OR o.code = upper($1)) AND o.kind = 'customer'`, [idOrCode]);
  if (!o) return null;
  const lines = await tx.q<Record<string, unknown>>(
    `SELECT rl.id, rl.line_no AS "lineNo", rl.line_type AS "lineType", rl.service_type_id AS "serviceTypeId", st.name AS "serviceName",
            rl.description, rl.qty, rl.unit_price_vnd AS "unitPrice", rl.line_total_vnd AS "lineTotal"
     FROM public.repair_lines rl LEFT JOIN public.service_types st ON st.id = rl.service_type_id
     WHERE rl.order_id = $1 AND rl.line_type <> 'part' ORDER BY rl.line_no`, [o.id]);
  const history = await tx.q(
    `SELECT h.from_status AS "from", h.to_status AS "to", h.at, h.reason, app.user_display_name(h.actor_id) AS "actorName"
     FROM public.repair_status_history h WHERE h.order_id = $1 ORDER BY h.at`, [o.id]);
  const warranty = await tx.one(`SELECT id, code, start_date AS "startDate", end_date AS "endDate", status FROM public.warranties WHERE repair_order_id = $1`, [o.id]);
  const photos = await tx.q(`SELECT id, '/api/v1/files/' || id || '/thumb' AS "thumbUrl", '/api/v1/files/' || id AS url FROM public.files
     WHERE entity_table = 'repair_orders' AND entity_id = $1 AND NOT is_deleted ORDER BY created_at`, [o.id]);
  return { ...o, lines, history, warranty, photos };
}
