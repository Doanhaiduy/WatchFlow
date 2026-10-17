import { api } from "@/server/http";
import { RolePermsBody } from "@/lib/types/admin";

export const PUT = api({ perm: "role.manage", body: RolePermsBody }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  await db((tx) => tx.fn("app.fn_set_role_permissions", [params.id, body.permissions]));
  return { ok: true };
});
