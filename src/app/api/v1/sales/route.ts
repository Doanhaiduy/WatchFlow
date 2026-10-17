import { api } from "@/server/http";
import { saveSaleDraft } from "@/server/sales";
import { SaleBody, SaleListQuery } from "@/lib/types/sales";

// Danh sách phiếu bán (lọc "còn nợ" ?due=true — FR-SALE-17). RLS: sale.view tất cả; sale.view_own của mình.
export const GET = api({ perm: ["sale.view", "sale.view_own"], query: SaleListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    const add = (sql: string, v: unknown) => { p.push(v); c.push(sql.replaceAll("?", "$" + p.length)); };
    if (query.status) add("s.status = ?", query.status);
    if (query.customerId) add("s.customer_id = ?", query.customerId);
    if (query.from) add("s.doc_date >= ?", query.from);
    if (query.to) add("s.doc_date <= ?", query.to);
    if (query.mine) c.push("s.created_by = app.current_user_id()");
    if (query.due) c.push("b.due > 0");
    if (query.q) add("(s.code ILIKE '%' || ? || '%' OR c.search_text LIKE '%' || app.norm_text(?) || '%' OR c.phone_norm LIKE '%' || app.norm_phone(?) || '%')", query.q);
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const from = `FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
                  LEFT JOIN public.v_doc_balances b ON b.doc_type = 'sale' AND b.doc_id = s.id`;
    const items = await tx.q(
      `SELECT s.id, s.code, s.status, s.doc_date AS "docDate", s.customer_id AS "customerId", c.full_name AS "customerName", c.phone AS "customerPhone",
              s.grand_total_vnd AS "grandTotal", b.paid_net AS "paidNet", b.due, s.due_date AS "dueDate", s.collaborator_id AS "collaboratorId",
              (SELECT count(*)::int FROM public.sale_lines sl WHERE sl.sale_id = s.id) AS "lineCount",
              (SELECT string_agg(coalesce(u.asset_code, pp.code), ', ' ORDER BY sl.line_no) FROM public.sale_lines sl LEFT JOIN public.watch_units u ON u.id = sl.unit_id
                LEFT JOIN public.parts pp ON pp.id = sl.part_id WHERE sl.sale_id = s.id) AS "items",
              s.created_at AS "createdAt", s.confirmed_at AS "confirmedAt", app.user_display_name(s.created_by) AS "createdByName"
       ${from} ${where} ORDER BY coalesce(s.confirmed_at, s.created_at) DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const sums = await tx.one<{ n: number; due: number }>(`SELECT count(*)::int n, coalesce(sum(greatest(b.due,0)),0)::bigint due ${from} ${where}`, p);
    return { items, page: query.page, pageSize: query.pageSize, total: sums?.n ?? 0, dueTotal: sums?.due ?? 0 };
  });
});

// Lập phiếu bán nháp (nháp KHÔNG giữ hàng — BR-SALE-01)
export const POST = api({ perm: "sale.create_draft", body: SaleBody, idempotent: "optional" }, async ({ body, db }) => {
  const id = await db((tx) => saveSaleDraft(tx, null, body));
  return { id };
});
