import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { mfaVerify } from "@/server/auth/service";
import { COOKIE } from "@/server/auth/cookies";
import { mergeTrustTokens, parseTrustCookie, setTrustCookie } from "@/server/auth/trusted-device";
import { MfaVerifyBody } from "@/lib/types/auth";
import { limitFailures } from "@/server/ratelimit";

// Xác minh mã 2FA khi đăng nhập / thiết lập. trustDevice=true (chỉ khi 2FA đã bật từ trước) ⇒ cấp cookie thiết bị tin cậy.
export const POST = api({ auth: "auth", body: MfaVerifyBody }, async ({ req, user, body, userAgent, ipHash }) => {
  const r = await limitFailures([["authAccount", "mfa:" + user.userId]], ["WF-AUTH-MFA-INVALID"], () =>
    mfaVerify(user.userId, user.sessionId, body.code, body.trustDevice ? { userAgent, ipHash } : undefined),
  );
  const res = NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes ?? null, trusted: !!r.trusted });
  if (r.trusted) setTrustCookie(res, mergeTrustTokens(r.trusted.token, parseTrustCookie(req.cookies.get(COOKIE.trusted)?.value)), r.trusted.days);
  return res;
});
