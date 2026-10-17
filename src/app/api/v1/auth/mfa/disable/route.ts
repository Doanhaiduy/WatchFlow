import { api } from "@/server/http";
import { mfaDisable } from "@/server/auth/service";

export const POST = api({ auth: "user" }, async ({ user, requireReauth }) => {
  requireReauth();
  await mfaDisable(user.userId, user.mfaRequired);
  return { ok: true };
});
