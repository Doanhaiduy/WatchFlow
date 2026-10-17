import { api } from "@/server/http";
import { PAYMENT_SELECT } from "@/server/payments";
import { PaymentListQuery } from "@/lib/types/payments";

// Danh sách thanh toán (lọc chứng từ, ngày, phương thức). RLS: debt.view/payment.create (CTV: chỉ quyết toán của mình — M5b).
export const GET = api({ query: PaymentListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    const add = (sql: string, v: unknown) => { p.push(v); c.push(sql.replace("?", "$" + p.length)); };
    if (query.docType) add("p.doc_type = ?", query.docType);
    if (query.docId) add("p.doc_id = ?", query.docId);
    if (query.method) add("p.method = ?", query.method);
    if (query.from) add("p.doc_date >= ?", query.from);
    if (query.to) add("p.doc_date <= ?", query.to);
    if (query.status) add("p.status = ?", query.status);
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const items = await tx.q(`${PAYMENT_SELECT} ${where} ORDER BY p.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const sums = await tx.one<{ n: number; inSum: number; outSum: number }>(
      `SELECT count(*)::int n, coalesce(sum(amount_vnd) FILTER (WHERE direction='in' AND status='posted'),0)::bigint "inSum",
              coalesce(sum(amount_vnd) FILTER (WHERE direction='out' AND status='posted'),0)::bigint "outSum" FROM public.payments p ${where}`, p);
    return { items, page: query.page, pageSize: query.pageSize, total: sums?.n ?? 0, inSum: sums?.inSum ?? 0, outSum: sums?.outSum ?? 0 };
  });
});
