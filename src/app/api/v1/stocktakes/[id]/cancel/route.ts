import { api } from "@/server/http";
import { VoidBody } from "@/lib/types/purchases";

export const POST = api({ perm: "stocktake.manage", body: VoidBody, idempotent: "optional" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_cancel_stocktake", [params.id, body.reason]));
});
