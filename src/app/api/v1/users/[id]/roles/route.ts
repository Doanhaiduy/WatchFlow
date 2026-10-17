import { api } from "@/server/http";
import { SetRolesBody } from "@/lib/types/admin";

export const PUT = api({ perm: "user.manage", body: SetRolesBody }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  await db((tx) => tx.fn("app.fn_assign_roles", [params.id, body.roles, body.reason ?? null]));
  return { ok: true };
});
