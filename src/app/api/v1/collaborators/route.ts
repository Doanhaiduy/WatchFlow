import { api } from "@/server/http";

// Danh sách CTV (người dùng có quyền collab.view_own) + hồ sơ + số chiếc đang giữ + chưa nộp
export const GET = api({ perm: "collab.view" }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT u.id, u.full_name AS "fullName", p.phone, p.area, p.note, coalesce(p.is_active, true) AS "isActive",
                 (SELECT count(*)::int FROM public.watch_units w WHERE w.held_by_collaborator_id = u.id) AS "holding",
                 (SELECT coalesce(sum(l.base_price_vnd),0)::bigint FROM public.watch_units w JOIN public.collaborator_assignment_lines l ON l.unit_id = w.id AND l.status='active'
                   WHERE w.held_by_collaborator_id = u.id) AS "holdingValue",
                 (SELECT coalesce(sum(c.base_price_vnd),0)::bigint FROM public.sales s, app.fn_sale_line_collab(s.id) c
                   WHERE s.collaborator_id = u.id AND s.status='confirmed' AND c.settlement_id IS NULL) AS "unsettled",
                 (SELECT count(*)::int FROM public.sales s WHERE s.collaborator_id = u.id AND s.status = 'draft') AS "pendingOrders"
          FROM app.fn_users_with_permission('collab.view_own') u LEFT JOIN public.collaborator_profiles p ON p.user_id = u.id
          ORDER BY u.full_name`),
  );
  return { items };
});
