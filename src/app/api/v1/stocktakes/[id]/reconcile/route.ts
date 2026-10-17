import { api } from "@/server/http";

// Đối chiếu & chốt (BR-INV-02): chiếc mất ⇒ ghi mất (cần stock.writeoff), linh kiện lệch ⇒ movement stocktake
export const POST = api({ perm: "stocktake.manage", idempotent: "required" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_reconcile_stocktake", [params.id]));
});
