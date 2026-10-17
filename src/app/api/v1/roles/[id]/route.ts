import { api } from "@/server/http";
import { RoleBody } from "@/lib/types/admin";

export const PATCH = api({ perm: "role.manage", body: RoleBody }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  await db((tx) =>
    tx.fn("app.fn_upsert_role", [params.id, null, body.nameVi ?? null, body.description ?? null, body.maxDiscountPct ?? null, body.isActive ?? null]),
  );
  return { ok: true };
});
