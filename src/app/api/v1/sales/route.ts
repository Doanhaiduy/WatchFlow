import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { RecordSaleBody, SaleListQuery } from "@/lib/types/sales";

// Danh sách đơn bán (tra cứu theo khách/SĐT/mã/serial). RLS: chỉ sale.view. Không có cột thanh toán/nợ/giá vốn (CF-13).
export const GET = api({ perm: "sale.view", query: SaleListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = ["s.status IN ('confirmed','voided')"];
    const add = (sql: string, v: unknown) => { p.push(v); c.push(sql.replaceAll("?", "$" + p.length)); };
    if (query.status) add("s.status = ?", query.status);
    if (query.customerId) add("s.customer_id = ?", query.customerId);
    if (query.from) add("s.doc_date >= ?", query.from);
    if (query.to) add("s.doc_date <= ?", query.to);
    if (query.channel === "shop") c.push("s.collaborator_id IS NULL");
    if (query.channel === "collab") c.push("s.collaborator_id IS NOT NULL");
    if (query.q) {
      add(`(s.code ILIKE '%' || ? || '%' OR c.search_text LIKE '%' || app.norm_text(?) || '%' OR c.phone_norm LIKE '%' || app.norm_phone(?) || '%'
            OR EXISTS (SELECT 1 FROM public.sale_lines x JOIN public.watch_units w ON w.id = x.unit_id
                       WHERE x.sale_id = s.id AND (w.asset_code ILIKE '%' || ? || '%' OR w.serial_norm LIKE '%' || app.norm_serial(?) || '%')))`, query.q);
    }
    const where = "WHERE " + c.join(" AND ");
    const from = "FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id";
    const items = await tx.q(
      `SELECT s.id, s.code, s.status, s.doc_date AS "docDate", s.customer_id AS "customerId", c.full_name AS "customerName", c.phone AS "customerPhone",
              s.grand_total_vnd AS "grandTotal", s.collaborator_id AS "collaboratorId", app.user_display_name(s.collaborator_id) AS "collaboratorName",
              (SELECT count(*)::int FROM public.sale_lines sl WHERE sl.sale_id = s.id) AS "lineCount",
              (SELECT string_agg(coalesce(m.name, u.asset_code), ', ' ORDER BY sl.line_no) FROM public.sale_lines sl JOIN public.watch_units u ON u.id = sl.unit_id
                 JOIN public.watch_models m ON m.id = u.model_id WHERE sl.sale_id = s.id) AS "items",
              (SELECT u.model_id FROM public.sale_lines sl JOIN public.watch_units u ON u.id = sl.unit_id WHERE sl.sale_id = s.id ORDER BY sl.line_no LIMIT 1) AS "firstModelId",
              (SELECT '/api/v1/files/' || f.id || '/thumb' FROM public.sale_lines sl JOIN public.files f ON f.entity_table = 'watch_units' AND f.entity_id = sl.unit_id AND f.kind = 'product' AND NOT f.is_deleted
                 WHERE sl.sale_id = s.id ORDER BY sl.line_no, f.created_at LIMIT 1) AS "thumbUrl",
              s.confirmed_at AS "confirmedAt"
       ${from} ${where} ORDER BY coalesce(s.confirmed_at, s.created_at) DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const sums = await tx.one<{ n: number; total: number }>(
      `SELECT count(*)::int n, coalesce(sum(s.grand_total_vnd) FILTER (WHERE s.status = 'confirmed'), 0)::bigint total ${from} ${where}`, p);
    return { items, page: query.page, pageSize: query.pageSize, total: sums?.n ?? 0, revenueTotal: sums?.total ?? 0 };
  });
});

// Ghi đơn bán: chiếc + giá + khách + ngày (+ hạn bảo hành). Đơn có hiệu lực ngay; sai thì hủy trong hạn rồi ghi lại (BR-SALE-20…24).
export const POST = api({ perm: "sale.confirm", body: RecordSaleBody, idempotent: "required" }, async ({ body, db, can }) => {
  return db(async (tx) => {
    let customerId = body.customerId ?? null;
    if (!customerId) {
      const c = body.customer!;
      const phone = c.phone?.trim() || null;
      // Cùng SĐT ⇒ dùng lại khách đã có (chỉ trong phạm vi người gọi thấy được), chưa có ⇒ tạo mới
      const dup = phone ? await tx.one<{ id: string }>("SELECT id FROM public.customers WHERE phone_norm = app.norm_phone($1) AND anonymized_at IS NULL ORDER BY created_at LIMIT 1", [phone]) : undefined;
      if (dup) customerId = dup.id;
      else {
        if (!can("customer.create")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền tạo khách hàng mới.");
        customerId = (await tx.one<{ id: string }>("INSERT INTO public.customers (full_name, phone, created_by) VALUES ($1,$2, app.current_user_id()) RETURNING id", [c.fullName, phone]))!.id;
      }
    }
    return tx.fn("app.fn_record_sale", [customerId, body.docDate ?? null, JSON.stringify(body.lines.map((l) => ({ unitId: l.unitId, price: l.price, warrantyMonths: l.warrantyMonths ?? null }))),
      body.note ?? null, body.backdateReason ?? null]);
  });
});
