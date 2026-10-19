import "server-only";
// Đơn bán gọn: đọc chi tiết (chiếc + khách + giá + ngày + hạn bảo hành). Không thanh toán/nợ/giá vốn/lãi trên màn đơn (CF-13, CF-14).
import type { Tx } from "./db";

export async function getSale(tx: Tx, idOrCode: string) {
  const s = await tx.one<Record<string, unknown>>(
    `SELECT s.id, s.code, s.status, s.customer_id AS "customerId", c.code AS "customerCode", c.full_name AS "customerName", c.phone AS "customerPhone",
            s.doc_date AS "docDate", s.subtotal_list_vnd AS "subtotalList", s.discount_total_vnd AS "discountTotal", s.grand_total_vnd AS "grandTotal",
            s.note, s.confirmed_at AS "confirmedAt", s.voided_at AS "voidedAt", s.void_reason AS "voidReason", s.collaborator_id AS "collaboratorId",
            app.user_display_name(s.collaborator_id) AS "collaboratorName", s.print_count AS "printCount", s.created_at AS "createdAt",
            app.user_display_name(s.confirmed_by) AS "confirmedByName", s.confirmed_at + make_interval(hours => app.setting_int('sales.void_window_hours', 24)) AS "voidUntil"
     FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id WHERE s.id::text = $1 OR s.code = upper($1)`, [idOrCode]);
  if (!s) return null;
  const lines = await tx.q<Record<string, unknown>>(
    `SELECT sl.id, sl.line_no AS "lineNo", sl.unit_id AS "unitId", u.asset_code AS "assetCode", u.serial_no AS "serialNo", u.condition,
            m.name AS "modelName", b.name AS "brandName", sl.list_price_snapshot_vnd AS "listPrice", sl.unit_price_vnd AS "unitPrice", sl.line_total_vnd AS "lineTotal",
            (SELECT w.end_date FROM public.warranties w WHERE w.sale_line_id = sl.id AND w.status <> 'voided' ORDER BY w.created_at DESC LIMIT 1) AS "warrantyEnd",
            CASE WHEN ph.id IS NOT NULL THEN '/api/v1/files/' || ph.id || '/thumb' END AS "thumbUrl"
     FROM public.sale_lines sl JOIN public.watch_units u ON u.id = sl.unit_id JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
     LEFT JOIN LATERAL (SELECT f.id FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1) ph ON true
     WHERE sl.sale_id = $1 AND sl.line_type = 'watch' ORDER BY sl.line_no`, [s.id]);
  return { ...s, lines };
}
