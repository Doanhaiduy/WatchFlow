import { api } from "@/server/http";
import { saveDraft } from "@/server/purchases";
import { PurchaseBody, PurchaseListQuery } from "@/lib/types/purchases";

// Lịch sử nhập hàng (FR-PUR-10): lọc ngày, nguồn, trạng thái, loại
export const GET = api({ perm: "purchase.view", query: PurchaseListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    const add = (sql: string, v: unknown) => { p.push(v); c.push(sql.replaceAll("?", "$" + p.length)); };
    if (query.status) add("r.status = ?", query.status);
    if (query.kind) add("r.kind = ?", query.kind);
    if (query.from) add("r.doc_date >= ?", query.from);
    if (query.to) add("r.doc_date <= ?", query.to);
    if (query.q) add("(r.code ILIKE '%' || ? || '%' OR app.norm_text(coalesce(r.source_name,'') || ' ' || coalesce(r.seller_name,'')) LIKE '%' || app.norm_text(?) || '%')", query.q);
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const items = await tx.q(
      `SELECT r.id, r.code, r.kind, r.source_name AS "sourceName", r.seller_name AS "sellerName", r.doc_date AS "docDate", r.status,
              r.grand_total_vnd AS "grandTotal", (SELECT count(*)::int FROM public.purchase_lines l WHERE l.receipt_id = r.id) AS "lineCount",
              app.user_display_name(r.created_by) AS "createdByName", r.created_at AS "createdAt"
       FROM public.purchase_receipts r ${where} ORDER BY r.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.purchase_receipts r ${where}`, p))?.n ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total };
  });
});

// Lập phiếu nhập nháp
export const POST = api({ perm: "purchase.create", body: PurchaseBody, idempotent: "optional" }, async ({ body, db }) => {
  const id = await db((tx) => saveDraft(tx, null, body));
  return { id };
});
