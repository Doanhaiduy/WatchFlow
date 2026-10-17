import { api } from "@/server/http";
import { RepairStatusBody } from "@/lib/types/repairs";

export const POST = api({ perm: "repair.update", body: RepairStatusBody, idempotent: "optional" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_set_repair_status", [params.id, body.to, body.reason ?? null]));
});
