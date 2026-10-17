import { api } from "@/server/http";
import { RestoreBody } from "@/lib/types/catalog";

export const POST = api({ perm: "stock.writeoff", body: RestoreBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_restore_unit", [params.id, body.locationId, body.reason]));
});
