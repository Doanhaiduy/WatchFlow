import { api } from "@/server/http";

// Danh sách CTV (người dùng có quyền collab.view_own) + hồ sơ + số chiếc đang được giao + báo bán chờ + kết quả bán tháng này (chủ)
export const GET = api({ perm: "collab.view" }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT u.id, u.full_name AS "fullName", p.phone, p.area, p.note, coalesce(p.is_active, true) AS "isActive",
                 (SELECT count(*)::int FROM public.collaborator_offers o JOIN public.watch_units w ON w.id = o.unit_id
                   WHERE o.collaborator_id = u.id AND o.status = 'active' AND w.status = 'in_stock') AS "offered",
                 (SELECT count(*)::int FROM public.collaborator_claims k WHERE k.collaborator_id = u.id AND k.status = 'pending') AS "pendingClaims",
                 (SELECT count(*)::int FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
                   WHERE s.collaborator_id = u.id AND s.status = 'confirmed' AND sl.line_type = 'watch' AND s.doc_date >= date_trunc('month', app.today_vn())::date) AS "soldMonth",
                 (SELECT coalesce(sum(sl.line_total_vnd), 0)::bigint FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
                   WHERE s.collaborator_id = u.id AND s.status = 'confirmed' AND s.doc_date >= date_trunc('month', app.today_vn())::date) AS "revenueMonth"
          FROM app.fn_users_with_permission('collab.view_own') u LEFT JOIN public.collaborator_profiles p ON p.user_id = u.id
          ORDER BY u.full_name`),
  );
  return { items };
});
