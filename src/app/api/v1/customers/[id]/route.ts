import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { CUSTOMER_SELECT, dupError, phoneDuplicates, piiColumns, withMask } from "@/server/customers";
import { CustomerBody } from "@/lib/types/customers";

export const GET = api({ perm: ["customer.view", "customer.view_own"] }, async ({ params, db }) => {
  return db(async (tx) => {
    const c = await tx.one(`${CUSTOMER_SELECT} WHERE c.id::text = $1 OR c.code = upper($1)`, [params.id]);
    if (!c) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy khách hàng.");
    const watches = await tx.q(
      `SELECT w.id, w.brand_text AS "brandText", w.model_text AS "modelText", w.serial_no AS "serialNo", w.unit_id AS "unitId", w.note, w.created_at AS "createdAt"
       FROM public.customer_watches w WHERE w.customer_id = $1 ORDER BY w.created_at DESC`, [c.id]);
    return { ...withMask(c as { idLast3?: string | null }), watches };
  });
});

export const PATCH = api({ perm: ["customer.manage", "customer.create"], body: CustomerBody.partial() }, async ({ req, params, body, db }) => {
  return db(async (tx) => {
    if (body.phone && !body.force) {
      const d = await phoneDuplicates(tx, body.phone, params.id);
      if (d.length) throw dupError(d);
    }
    const sets: string[] = [];
    const p: unknown[] = [params.id];
    const add = (col: string, v: unknown) => { p.push(v); sets.push(`${col} = $${p.length}`); };
    if (body.fullName !== undefined) add("full_name", body.fullName);
    if (body.phone !== undefined) add("phone", body.phone || null);
    if (body.email !== undefined) add("email", body.email);
    if (body.address !== undefined) add("address", body.address);
    if (body.groupId !== undefined) add("group_id", body.groupId);
    if (body.note !== undefined) add("note", body.note);
    if (body.idNumber !== undefined) {
      const pii = piiColumns(body.idNumber);
      add("id_number_enc", pii.enc); add("id_number_bidx", pii.bidx); add("id_number_last3", pii.last3);
    }
    if (!sets.length) return { ok: true };
    const ver = req.headers.get("if-match");
    p.push(ver ? Number(ver) : null);
    const r = await tx.one(`UPDATE public.customers SET ${sets.join(", ")} WHERE id = $1 AND ($${p.length}::int IS NULL OR version = $${p.length}) RETURNING id`, p);
    if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Khách hàng vừa được sửa, đã ẩn danh hoặc bạn không có quyền sửa. Hãy tải lại.");
    return { ok: true };
  });
});
