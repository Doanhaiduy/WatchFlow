import { api } from "@/server/http";

// Gợi ý "Nguồn hàng" cho phiếu nhập / thêm đồng hồ: tên nguồn đã dùng ở các phiếu nhập NGƯỜI GỌI THẤY ĐƯỢC (RLS), gộp không phân biệt hoa/thường/dấu,
// mới dùng gần nhất trước. Chỉ trả tên + số phiếu + ngày gần nhất (không có tiền/giá vốn).
export const GET = api({ perm: ["purchase.create", "purchase.view"] }, async ({ db }) => {
  return db(async (tx) => {
    const items = await tx.q<{ name: string; count: number; lastDate: string }>(
      `SELECT (array_agg(source_name ORDER BY doc_date DESC, created_at DESC))[1] AS name,
              count(*)::int AS count, max(doc_date)::text AS "lastDate"
       FROM public.purchase_receipts
       WHERE source_name IS NOT NULL AND btrim(source_name) <> '' AND status <> 'voided'
       GROUP BY app.norm_text(source_name)
       ORDER BY max(doc_date) DESC, max(created_at) DESC
       LIMIT 200`,
    );
    return { items };
  });
});
