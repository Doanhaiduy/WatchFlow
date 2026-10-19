import { api } from "@/server/http";
import { RejectClaimBody } from "@/lib/types/collab";

// Từ chối báo bán (lý do ≥ 10 ký tự): chiếc quay lại cho các CTV khác
export const POST = api({ perm: "sale.confirm", body: RejectClaimBody }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_reject_claim", [params.id, body.reason]));
});
