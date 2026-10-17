import { api } from "@/server/http";
import { SetStatusBody } from "@/lib/types/admin";

export const POST = api({ perm: "user.manage", body: SetStatusBody, idempotent: "optional" }, async ({ params, body, db }) => {
  await db((tx) => tx.fn("app.fn_set_user_status", [params.id, body.status, body.reason]));
  return { ok: true };
});
