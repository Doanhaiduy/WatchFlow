import { api } from "@/server/http";
import { reauth } from "@/server/auth/service";
import { ReauthBody } from "@/lib/types/auth";
import { limitFailures } from "@/server/ratelimit";

export const POST = api({ auth: "auth", body: ReauthBody }, async ({ user, body }) => {
  await limitFailures([["authAccount", "reauth:" + user.userId]], ["WF-AUTH-INVALID", "WF-AUTH-MFA-INVALID"], () =>
    reauth(user.userId, user.sessionId, body.password, body.code),
  );
  return { ok: true };
});
