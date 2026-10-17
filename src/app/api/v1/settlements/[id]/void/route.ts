import { api } from "@/server/http";
import { ReasonBody } from "@/lib/types/collab";

// Hủy quyết toán (BR-COL-08): chủ + lý do + xác thực lại
export const POST = api({ perm: "collab.manage", body: ReasonBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_void_settlement", [params.id, body.reason]));
});
