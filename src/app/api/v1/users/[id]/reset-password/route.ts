import crypto from "node:crypto";
import { api } from "@/server/http";
import { hashPassword } from "@/server/auth/password";

export const POST = api({ perm: "user.manage", idempotent: "optional" }, async ({ params, db, requireReauth }) => {
  requireReauth();
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const hash = await hashPassword(tempPassword);
  await db((tx) => tx.fn("app.fn_reset_password", [params.id, hash]));
  return { tempPassword };
});
