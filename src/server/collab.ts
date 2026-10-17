import "server-only";
// Cộng tác viên: truy vấn đọc dùng chung (chiếc đang giữ, dòng chưa quyết toán, thống kê). Giá thu giao CTV chỉ cho chủ/collab.view hoặc chính CTV.
import type { Tx } from "./db";
import { todayVn } from "@/lib/dates";

export const UNITS_COLLAB_SELECT = `
  SELECT v.id, v.asset_code AS "assetCode", v.status, v.condition, v.condition_grade AS "conditionGrade", v.serial_no AS "serialNo",
         v.model_id AS "modelId", v.model_code AS "modelCode", v.model_name AS "modelName", v.brand_name AS "brandName",
         v.list_price_vnd AS "listPrice", v.base_price_vnd AS "basePrice", v.assigned_date AS "assignedDate", v.assignment_code AS "assignmentCode",
         (app.today_vn() - v.assigned_date) AS "daysHeld", v.held_by_collaborator_id AS "collaboratorId",
         CASE WHEN v.photo_id IS NOT NULL THEN '/api/v1/files/' || v.photo_id || '/thumb' END AS "thumbUrl"
  FROM public.v_units_collab v`;

export async function unsettledLines(tx: Tx, collaborator: string) {
  return tx.q(
    `SELECT sl.id, s.id AS "saleId", s.code AS "saleCode", s.doc_date AS "docDate", u.asset_code AS "assetCode", m.name AS "modelName",
            sl.line_total_vnd AS "salePrice", c.base_price_vnd AS "basePrice", (sl.line_total_vnd - c.base_price_vnd) AS "collabEarn"
     FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id JOIN app.fn_sale_line_collab(s.id) c ON c.sale_line_id = sl.id
     JOIN public.watch_units u ON u.id = sl.unit_id JOIN public.watch_models m ON m.id = u.model_id
     WHERE s.collaborator_id = $1 AND s.status = 'confirmed' AND c.settlement_id IS NULL ORDER BY s.doc_date, s.code`, [collaborator]);
}

export async function collabStats(tx: Tx, q: { period: string; from?: string; to?: string; collaborator?: string | null }) {
  const today = todayVn();
  const from = q.from ?? `${today.slice(0, 4)}-01-01`;
  const to = q.to ?? today;
  const rows = await tx.q(
    `SELECT collaborator_id AS "collaboratorId", collaborator_name AS "collaboratorName", period_start AS "periodStart", units_sold AS "unitsSold",
            sales_total AS "salesTotal", base_total AS "baseTotal", collab_earn AS "collabEarn", settled, unsettled
     FROM app.rpt_collaborator($1, $2, $3, $4)`, [from, to, q.period, q.collaborator ?? null]);
  const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  return { from, to, period: q.period, rows, totals: { unitsSold: sum("unitsSold"), salesTotal: sum("salesTotal"), baseTotal: sum("baseTotal"),
    collabEarn: sum("collabEarn"), settled: sum("settled"), unsettled: sum("unsettled") } };
}
