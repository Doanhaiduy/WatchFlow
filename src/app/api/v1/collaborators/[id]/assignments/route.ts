import { api } from "@/server/http";
import { AssignmentBody } from "@/lib/types/collab";

// Giao hàng cho CTV (BR-COL-01): tạo phiếu giao + xác nhận trong một transaction; trả cảnh báo giá thu < giá vốn (nếu có)
export const POST = api({ perm: "collab.manage", body: AssignmentBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db(async (tx) => {
    const a = await tx.one<{ id: string }>(
      `INSERT INTO public.collaborator_assignments (collaborator_id, doc_date, note, created_by) VALUES ($1, coalesce($2::date, app.today_vn()), $3, app.current_user_id()) RETURNING id`,
      [params.id, body.docDate ?? null, body.note ?? null]);
    let no = 0;
    for (const l of body.lines) {
      await tx.q("INSERT INTO public.collaborator_assignment_lines (assignment_id, line_no, unit_id, base_price_vnd) VALUES ($1,$2,$3,$4)", [a!.id, ++no, l.unitId, l.basePrice]);
    }
    return tx.fn("app.fn_confirm_assignment", [a!.id]);
  });
});

export const GET = api({ perm: "collab.view" }, async ({ params, db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT a.id, a.code, a.status, a.doc_date AS "docDate", a.note,
                 coalesce((SELECT json_agg(json_build_object('lineNo', l.line_no, 'unitId', l.unit_id, 'assetCode', u.asset_code, 'basePrice', l.base_price_vnd, 'status', l.status) ORDER BY l.line_no)
                   FROM public.collaborator_assignment_lines l JOIN public.watch_units u ON u.id = l.unit_id WHERE l.assignment_id = a.id), '[]') AS lines
          FROM public.collaborator_assignments a WHERE a.collaborator_id = $1 ORDER BY a.created_at DESC`, [params.id]),
  );
  return { items };
});
