import "server-only";
// Cộng tác viên: truy vấn dùng chung. Chủ thấy giá niêm yết + doanh thu; CTV chỉ gọi hàm DB an toàn (fn_my_*) — không có tiền ngoài giá niêm yết.
import type { Tx } from "./db";
import { todayVn } from "@/lib/dates";

/** Chiếc đang được giao (còn chào hàng) kèm danh sách CTV và báo bán đang chờ — cho chủ */
export async function offeredUnits(tx: Tx, q: { q?: string; collaboratorId?: string; pendingOnly?: boolean }) {
  const p: unknown[] = [];
  const c: string[] = ["u.status = 'in_stock'", "EXISTS (SELECT 1 FROM public.collaborator_offers o WHERE o.unit_id = u.id AND o.status = 'active')"];
  if (q.collaboratorId) { p.push(q.collaboratorId); c.push(`EXISTS (SELECT 1 FROM public.collaborator_offers o WHERE o.unit_id = u.id AND o.status = 'active' AND o.collaborator_id = $${p.length})`); }
  if (q.pendingOnly) c.push("EXISTS (SELECT 1 FROM public.collaborator_claims k WHERE k.unit_id = u.id AND k.status = 'pending')");
  if (q.q) { p.push(q.q); c.push(`(u.search_text LIKE '%' || app.norm_text($${p.length}) || '%' OR u.asset_code ILIKE '%' || $${p.length} || '%')`); }
  return tx.q(
    `SELECT u.id, u.asset_code AS "assetCode", u.serial_no AS "serialNo", u.condition, u.condition_grade AS "conditionGrade", m.name AS "modelName", b.name AS "brandName",
            app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS "listPrice",
            (SELECT '/api/v1/files/' || f.id || '/thumb' FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1) AS "thumbUrl",
            (SELECT coalesce(jsonb_agg(jsonb_build_object('collaboratorId', o.collaborator_id, 'name', app.user_display_name(o.collaborator_id), 'offeredAt', o.offered_at,
                     'claimId', k.id) ORDER BY o.offered_at, o.id), '[]')
               FROM public.collaborator_offers o LEFT JOIN public.collaborator_claims k ON k.offer_id = o.id AND k.status = 'pending'
              WHERE o.unit_id = u.id AND o.status = 'active') AS collaborators,
            (SELECT min(o.offered_at) FROM public.collaborator_offers o WHERE o.unit_id = u.id AND o.status = 'active') AS "offeredAt"
     FROM public.watch_units u JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
     WHERE ${c.join(" AND ")}
     ORDER BY EXISTS (SELECT 1 FROM public.collaborator_claims k WHERE k.unit_id = u.id AND k.status = 'pending') DESC, "offeredAt" DESC, u.asset_code LIMIT 300`, p);
}

/** Báo bán của CTV (chủ/người xác nhận): kèm chiếc, giá niêm yết hiện hành, đơn bán nếu đã xác nhận */
export async function claimsList(tx: Tx, q: { status: "pending" | "decided" | "all"; collaboratorId?: string; page: number; pageSize: number }) {
  const p: unknown[] = [];
  const c: string[] = [];
  if (q.status === "pending") c.push("k.status = 'pending'");
  if (q.status === "decided") c.push("k.status <> 'pending'");
  if (q.collaboratorId) { p.push(q.collaboratorId); c.push(`k.collaborator_id = $${p.length}`); }
  const where = c.length ? "WHERE " + c.join(" AND ") : "";
  const from = `FROM public.collaborator_claims k JOIN public.watch_units u ON u.id = k.unit_id JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
                LEFT JOIN public.sales s ON s.id = k.sale_id`;
  const items = await tx.q(
    `SELECT k.id, k.status, k.unit_id AS "unitId", u.asset_code AS "assetCode", u.condition, m.name AS "modelName", b.name AS "brandName",
            app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS "listPrice",
            k.collaborator_id AS "collaboratorId", app.user_display_name(k.collaborator_id) AS "collaboratorName",
            k.customer_name AS "customerName", k.customer_phone AS "customerPhone", k.note, k.reject_reason AS "rejectReason",
            k.created_at AS "createdAt", k.decided_at AS "decidedAt", app.user_display_name(k.decided_by) AS "decidedByName",
            s.id AS "saleId", s.code AS "saleCode", s.grand_total_vnd AS "salePrice",
            (SELECT '/api/v1/files/' || f.id || '/thumb' FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1) AS "thumbUrl"
     ${from} ${where} ORDER BY CASE WHEN k.status = 'pending' THEN 0 ELSE 1 END, k.created_at DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`, p);
  const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n ${from} ${where}`, p))?.n ?? 0;
  return { items, page: q.page, pageSize: q.pageSize, total };
}

/** Khoảng ngày mặc định của thống kê: từ đầu năm đến hôm nay */
export function statsRange(q: { from?: string; to?: string }) {
  const today = todayVn();
  return { from: q.from ?? `${today.slice(0, 4)}-01-01`, to: q.to ?? today };
}
