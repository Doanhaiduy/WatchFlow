import "server-only";
// Phiếu sửa: đọc chi tiết (giá vốn linh kiện & lãi chỉ khi có quyền), danh sách, lịch sử theo serial (BR-REP-13).
import type { Tx } from "./db";

export const REPAIR_LIST_SELECT = `
  SELECT o.id, o.code, o.kind, o.charge_mode AS "chargeMode", o.status, o.received_at AS "receivedAt", o.expected_date AS "expectedDate",
         o.customer_id AS "customerId", c.full_name AS "customerName", c.phone AS "customerPhone",
         coalesce(u.asset_code, nullif(concat_ws(' ', cw.brand_text, cw.model_text), '')) AS "watchLabel", coalesce(u.serial_no, cw.serial_no) AS "serialNo",
         o.customer_complaint AS complaint, o.final_total_vnd AS "finalTotal",
         (SELECT coalesce(sum(line_total_vnd),0)::bigint FROM public.repair_lines rl WHERE rl.order_id = o.id) AS "linesTotal",
         (SELECT count(*)::int FROM public.repair_lines rl WHERE rl.order_id = o.id) AS "lineCount",
         CASE o.status WHEN 'received' THEN 10 WHEN 'inspecting' THEN 30 WHEN 'waiting_parts' THEN 50 WHEN 'repairing' THEN 70 WHEN 'completed' THEN 90 ELSE 100 END AS progress,
         b.held, b.due
  FROM public.repair_orders o LEFT JOIN public.customers c ON c.id = o.customer_id LEFT JOIN public.customer_watches cw ON cw.id = o.customer_watch_id
  LEFT JOIN public.watch_units u ON u.id = o.unit_id LEFT JOIN public.v_doc_balances b ON b.doc_type = 'repair' AND b.doc_id = o.id`;

export async function getRepair(tx: Tx, idOrCode: string, perms: { cost: boolean; profit: boolean }) {
  const o = await tx.one<Record<string, unknown>>(
    `${REPAIR_LIST_SELECT.replace('b.held, b.due', `b.held, b.due, b.paid_net AS "paidNet", o.warranty_id AS "warrantyId", o.unit_id AS "unitId",
       o.customer_watch_id AS "customerWatchId", o.intake_condition AS "intakeCondition", o.findings, o.quote_approved_at AS "quoteApprovedAt",
       o.quote_approved_channel AS "quoteApprovedChannel", o.completed_at AS "completedAt", o.delivered_at AS "deliveredAt", o.due_date AS "dueDate",
       o.revenue_vnd AS revenue, o.cancel_reason AS "cancelReason", o.version, app.user_display_name(o.received_by) AS "receivedByName"`)}
     WHERE o.id::text = $1 OR o.code = upper($1)`, [idOrCode]);
  if (!o) return null;
  const lines = await tx.q<Record<string, unknown>>(
    `SELECT rl.id, rl.line_no AS "lineNo", rl.line_type AS "lineType", rl.service_type_id AS "serviceTypeId", st.name AS "serviceName",
            rl.part_id AS "partId", p.code AS "partCode", p.name AS "partName", p.qty_on_hand AS "partStock", rl.description, rl.qty,
            rl.unit_price_vnd AS "unitPrice", rl.line_total_vnd AS "lineTotal", rl.consumed_at AS "consumedAt"
            ${perms.cost ? `, (SELECT coalesce(sum(cost_vnd),0)::bigint FROM public.repair_line_costs x WHERE x.repair_line_id = rl.id) AS cost` : ""}
     FROM public.repair_lines rl LEFT JOIN public.service_types st ON st.id = rl.service_type_id LEFT JOIN public.parts p ON p.id = rl.part_id
     WHERE rl.order_id = $1 ORDER BY rl.line_no`, [o.id]);
  const payments = await tx.q(
    `SELECT id, code, direction, purpose, method, amount_vnd AS amount, doc_date AS "docDate", status, created_at AS "createdAt"
     FROM public.payments WHERE doc_type = 'repair' AND doc_id = $1 ORDER BY created_at`, [o.id]);
  const history = await tx.q(
    `SELECT h.from_status AS "from", h.to_status AS "to", h.at, h.reason, app.user_display_name(h.actor_id) AS "actorName"
     FROM public.repair_status_history h WHERE h.order_id = $1 ORDER BY h.at`, [o.id]);
  const warranty = await tx.one(`SELECT id, code, start_date AS "startDate", end_date AS "endDate", status FROM public.warranties WHERE repair_order_id = $1`, [o.id]);
  const photos = await tx.q(`SELECT id, '/api/v1/files/' || id || '/thumb' AS "thumbUrl", '/api/v1/files/' || id AS url FROM public.files
     WHERE entity_table = 'repair_orders' AND entity_id = $1 AND NOT is_deleted ORDER BY created_at`, [o.id]);
  const extra: Record<string, unknown> = {};
  if (perms.cost) {
    const cost = lines.reduce((a, l) => a + Number(l.cost ?? 0), 0);
    extra.partsCost = cost;
    if (perms.profit && o.kind === "customer") extra.grossProfit = (o.chargeMode === "paid" ? Number(o.status === "delivered" ? o.revenue : o.linesTotal) : 0) - cost;
  }
  return { ...o, lines, payments, history, warranty, photos, ...extra };
}

export async function repairsBySerial(tx: Tx, serial: string) {
  return tx.q(
    `${REPAIR_LIST_SELECT} WHERE (u.serial_norm IS NOT NULL AND u.serial_norm = app.norm_serial($1)) OR (cw.serial_norm IS NOT NULL AND cw.serial_norm = app.norm_serial($1))
       OR upper(u.asset_code) = upper($1) ORDER BY o.received_at DESC LIMIT 100`, [serial]);
}
