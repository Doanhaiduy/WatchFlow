import { api } from "@/server/http";
import { changePassword } from "@/server/auth/service";
import { ChangePasswordBody } from "@/lib/types/auth";
import { limitFailures } from "@/server/ratelimit";

export const POST = api({ auth: "auth", body: ChangePasswordBody }, async ({ user, body }) => {
  await limitFailures([["authAccount", "pw:" + user.userId]], ["WF-VALIDATION"], () =>
    changePassword(user.userId, user.sessionId, body.currentPassword, body.newPassword),
  );
  return { ok: true };
});
