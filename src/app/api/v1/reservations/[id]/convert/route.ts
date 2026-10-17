import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

// Chuyển giữ hàng thành phiếu bán nháp (cùng khách, chiếc đang giữ, giá hiệu lực) — xác nhận ở POS (BR-RSV-04)
export const POST = api({ perm: ["sale.create_draft"], idempotent: "optional" }, async ({ params, db }) => {
  return db(async (tx) => {
    const r = await tx.one<{ id: string; customer_id: string; unit_id: string; status: string; price: number }>(
      `SELECT r.id, r.customer_id, r.unit_id, r.status, app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS price
       FROM public.reservations r JOIN public.watch_units u ON u.id = r.unit_id WHERE r.id = $1`, [params.id]);
    if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy giữ hàng.");
    if (!["active", "expired"].includes(r.status)) throw new ApiError(409, "WF-RSV-NOT-ACTIVE", "Giữ hàng đã đóng.");
    const existing = await tx.one<{ id: string }>("SELECT id FROM public.sales WHERE reservation_id = $1 AND status = 'draft' LIMIT 1", [r.id]);
    if (existing) return { saleId: existing.id };
    const s = await tx.one<{ id: string }>(
      `INSERT INTO public.sales (customer_id, reservation_id, created_by) VALUES ($1,$2, app.current_user_id()) RETURNING id`, [r.customer_id, r.id]);
    await tx.q("INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, unit_price_vnd) VALUES ($1,1,'watch',$2,1,$3)", [s!.id, r.unit_id, r.price]);
    return { saleId: s!.id };
  });
});
