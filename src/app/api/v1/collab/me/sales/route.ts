import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { CollabSaleBody } from "@/lib/types/collab";

// CTV: đơn của tôi (kèm giá thu & phần hưởng từng dòng — chỉ của chính mình)
export const GET = api({ perm: "collab.view_own" }, async ({ db }) => {
  return db(async (tx) => {
    const items = await tx.q<Record<string, unknown>>(
      `SELECT s.id, s.code, s.status, s.doc_date AS "docDate", s.grand_total_vnd AS "grandTotal", c.full_name AS "customerName", c.phone AS "customerPhone",
              s.created_at AS "createdAt", s.confirmed_at AS "confirmedAt", s.void_reason AS "voidReason"
       FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
       WHERE s.collaborator_id = app.current_user_id() ORDER BY s.created_at DESC LIMIT 200`);
    for (const s of items) {
      // Qua hàm definer: chiếc đã bán không còn "đang giữ" nên JOIN watch_units dưới RLS sẽ mất dòng (0013e)
      const lines = await tx.q<{ salePrice: number; basePrice: number | null; settled: boolean; assetCode: string; modelName: string }>(
        `SELECT asset_code AS "assetCode", model_name AS "modelName", brand_name AS "brandName", sale_price_vnd AS "salePrice",
                base_price_vnd AS "basePrice", settled FROM app.fn_collab_my_sale_lines($1)`, [s.id]);
      s.lines = lines;
    }
    return { items };
  });
});

// CTV tạo đơn nháp từ chiếc đang giữ (BR-COL-03). Chiếc không phải của mình ⇒ WF-COL-UNIT-NOT-HELD.
export const POST = api({ perm: ["collab.view_own"], body: CollabSaleBody, idempotent: "optional" }, async ({ body, db, can }) => {
  if (!can("sale.create_draft")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền tạo đơn.");
  return db(async (tx) => {
    for (const l of body.lines) {
      const ok = await tx.one("SELECT 1 AS x FROM public.v_units_collab WHERE id = $1 AND held_by_collaborator_id = app.current_user_id()", [l.unitId]);
      if (!ok) throw new ApiError(409, "WF-COL-UNIT-NOT-HELD", "Chiếc này không do bạn đang giữ.");
    }
    const s = await tx.one<{ id: string }>(
      `INSERT INTO public.sales (customer_id, note, created_by, collaborator_id) VALUES ($1,$2, app.current_user_id(), app.current_user_id()) RETURNING id`,
      [body.customerId, body.note ?? null]);
    let no = 0;
    for (const l of body.lines) {
      await tx.q("INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, unit_price_vnd) VALUES ($1,$2,'watch',$3,1,$4)", [s!.id, ++no, l.unitId, l.unitPrice]);
    }
    await tx.fn("app.fn_emit_event", ["collab.order_submitted", JSON.stringify({ saleId: s!.id })]);
    return { id: s!.id };
  });
});
