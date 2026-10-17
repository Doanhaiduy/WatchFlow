import { api } from "@/server/http";
import { WriteoffBody } from "@/lib/types/catalog";

export const POST = api({ perm: "stock.writeoff", body: WriteoffBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_writeoff_unit", [params.id, body.reason]));
});
