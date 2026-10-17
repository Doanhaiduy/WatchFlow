import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { UNITS_COLLAB_SELECT, unsettledLines } from "@/server/collab";
import { ProfileBody } from "@/lib/types/collab";

// Chi tiết CTV (chủ): hồ sơ, hàng đang giữ (giá thu), đơn, chưa nộp, quyết toán
export const GET = api({ perm: "collab.view" }, async ({ params, db }) => {
  return db(async (tx) => {
    const u = await tx.one(`SELECT u.id, u.full_name AS "fullName", p.phone, p.area, p.note, coalesce(p.is_active, true) AS "isActive"
      FROM app.fn_users_with_permission('collab.view_own') u LEFT JOIN public.collaborator_profiles p ON p.user_id = u.id WHERE u.id = $1`, [params.id]);
    if (!u) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy cộng tác viên.");
    const units = await tx.q(`${UNITS_COLLAB_SELECT} WHERE v.held_by_collaborator_id = $1 ORDER BY v.assigned_date`, [params.id]);
    const orders = await tx.q(`SELECT s.id, s.code, s.status, s.doc_date AS "docDate", s.grand_total_vnd AS "grandTotal", c.full_name AS "customerName",
        s.created_at AS "createdAt" FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE s.collaborator_id = $1 ORDER BY s.created_at DESC LIMIT 100`, [params.id]);
    const settlements = await tx.q(`SELECT id, code, doc_date AS "docDate", status, total_vnd AS total, method, note, void_reason AS "voidReason"
      FROM public.collaborator_settlements WHERE collaborator_id = $1 ORDER BY created_at DESC LIMIT 100`, [params.id]);
    const assignments = await tx.q(`SELECT a.id, a.code, a.status, a.doc_date AS "docDate", (SELECT count(*)::int FROM public.collaborator_assignment_lines l WHERE l.assignment_id = a.id) AS "lineCount"
      FROM public.collaborator_assignments a WHERE a.collaborator_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [params.id]);
    return { ...u, units, orders, settlements, assignments, unsettled: await unsettledLines(tx, params.id!) };
  });
});

export const PATCH = api({ perm: "collab.manage", body: ProfileBody }, async ({ params, body, db }) => {
  await db((tx) => tx.fn("app.fn_upsert_collaborator_profile", [params.id, body.phone ?? null, body.area ?? null, body.note ?? null, body.isActive]));
  return { ok: true };
});
