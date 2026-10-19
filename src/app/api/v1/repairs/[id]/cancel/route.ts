import { api } from "@/server/http";
import { CancelRepairBody } from "@/lib/types/repairs";

// Hủy phiếu sửa (trước khi sửa xong)
export const POST = api({ perm: "repair.update", body: CancelRepairBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_cancel_repair", [params.id, body.reason, "cash"]));
});
