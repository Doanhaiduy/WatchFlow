import { api } from "@/server/http";
import { ReasonBody } from "@/lib/types/collab";

export const POST = api({ perm: "collab.manage", body: ReasonBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_void_assignment", [params.id, body.reason]));
});
