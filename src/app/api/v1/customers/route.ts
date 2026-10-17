import { api } from "@/server/http";
import { CUSTOMER_SELECT, dupError, phoneDuplicates, piiColumns, withMask } from "@/server/customers";
import { blindIndex } from "@/server/pii";
import { CustomerBody, CustomerListQuery } from "@/lib/types/customers";

// Danh sách khách (RLS: customer.view tất cả; customer.view_own chỉ khách mình tạo) — FR-CUS-06/07
export const GET = api({ perm: ["customer.view", "customer.view_own"], query: CustomerListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    if (query.groupId) { p.push(query.groupId); c.push(`c.group_id = $${p.length}`); }
    if (query.active) { p.push(query.active === "1"); c.push(`c.is_active = $${p.length}`); }
    if (query.idNumber) { p.push(blindIndex(query.idNumber)); c.push(`c.id_number_bidx = $${p.length}`); }
    let order = "c.created_at DESC";
    if (query.q) {
      p.push(query.q);
      const i = p.length;
      c.push(`(c.search_text LIKE '%' || app.norm_text($${i}) || '%' OR c.phone_norm LIKE '%' || app.norm_phone($${i}) || '%' OR app.norm_text($${i}) <% c.search_text)`);
      order = `coalesce(c.phone_norm = app.norm_phone($${i}), false) DESC, word_similarity(app.norm_text($${i}), c.search_text) DESC, c.full_name`;
    }
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const rows = await tx.q(`${CUSTOMER_SELECT} ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.customers c ${where}`, p))?.n ?? 0;
    return { items: rows.map(withMask), page: query.page, pageSize: query.pageSize, total };
  });
});

// Tạo khách (tạo nhanh tại quầy/CTV). Trùng SĐT ⇒ 409 kèm gợi ý, gửi lại với force=true để vẫn tạo.
export const POST = api({ perm: "customer.create", body: CustomerBody, idempotent: "optional" }, async ({ body, db }) => {
  return db(async (tx) => {
    if (!body.force) {
      const d = await phoneDuplicates(tx, body.phone);
      if (d.length) throw dupError(d);
    }
    const pii = piiColumns(body.idNumber);
    const r = await tx.one<{ id: string; code: string }>(
      `INSERT INTO public.customers (full_name, phone, email, address, group_id, note, id_number_enc, id_number_bidx, id_number_last3, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, app.current_user_id()) RETURNING id, code`,
      [body.fullName, body.phone || null, body.email ?? null, body.address ?? null, body.groupId ?? null, body.note ?? null, pii.enc, pii.bidx, pii.last3],
    );
    return r;
  });
});
