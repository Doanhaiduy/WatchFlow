import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { claimsList, offeredUnits } from "@/server/collab";
import { ProfileBody } from "@/lib/types/collab";

// Chi tiết CTV (chủ): hồ sơ, chiếc đang giao, báo bán, đơn đã bán được (kèm giá bán = doanh thu cửa hàng)
export const GET = api({ perm: "collab.view" }, async ({ params, db }) => {
  return db(async (tx) => {
    const u = await tx.one(`SELECT u.id, u.full_name AS "fullName", p.phone, p.area, p.note, coalesce(p.is_active, true) AS "isActive"
      FROM app.fn_users_with_permission('collab.view_own') u LEFT JOIN public.collaborator_profiles p ON p.user_id = u.id WHERE u.id = $1`, [params.id]);
    if (!u) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy cộng tác viên.");
    const units = await offeredUnits(tx, { collaboratorId: params.id });
    const claims = await claimsList(tx, { status: "all", collaboratorId: params.id, page: 1, pageSize: 50 });
    const orders = await tx.q(`SELECT s.id, s.code, s.status, s.doc_date AS "docDate", s.grand_total_vnd AS "grandTotal", c.full_name AS "customerName",
        (SELECT string_agg(m.name, ', ' ORDER BY sl.line_no) FROM public.sale_lines sl JOIN public.watch_units w ON w.id = sl.unit_id JOIN public.watch_models m ON m.id = w.model_id WHERE sl.sale_id = s.id) AS items
      FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE s.collaborator_id = $1 AND s.status IN ('confirmed','voided') ORDER BY s.confirmed_at DESC LIMIT 100`, [params.id]);
    return { ...u, units, claims: claims.items, orders };
  });
});

export const PATCH = api({ perm: "collab.manage", body: ProfileBody }, async ({ params, body, db }) => {
  await db((tx) => tx.fn("app.fn_upsert_collaborator_profile", [params.id, body.phone ?? null, body.area ?? null, body.note ?? null, body.isActive]));
  return { ok: true };
});
