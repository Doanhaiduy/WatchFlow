import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

// Phải thu / đã trả / còn nợ của một chứng từ (v_doc_balances — có từ M5a). Kiểm quyền đọc chứng từ trong view (RLS).
export const GET = api({}, async ({ params, db }) => {
  if (!["sale", "repair", "reservation", "settlement"].includes(params.type ?? "")) throw new ApiError(404, "WF-NOT-FOUND", "Loại chứng từ không hợp lệ.");
  const r = await db(async (tx) => {
    const has = await tx.one("SELECT 1 AS x FROM pg_views WHERE schemaname='public' AND viewname='v_doc_balances'");
    if (!has) return null;
    return tx.one(`SELECT payable, paid_net AS "paidNet", due, held FROM public.v_doc_balances WHERE doc_type = $1 AND doc_id = $2`, [params.type, params.id]);
  });
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy chứng từ.");
  return r;
});
