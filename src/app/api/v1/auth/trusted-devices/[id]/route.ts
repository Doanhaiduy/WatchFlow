import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { COOKIE } from "@/server/auth/cookies";
import { clearTrustCookie, parseTrustCookie, revokeTrustedDevice, setTrustCookie } from "@/server/auth/trusted-device";
import { sha256 } from "@/server/auth/tokens";

/** Bỏ tin cậy một thiết bị của chính mình; nếu là trình duyệt này thì gỡ token khỏi cookie. */
export const DELETE = api({}, async ({ req, user, params, ipHash }) => {
  const hash = await revokeTrustedDevice(user.userId, params.id!, ipHash);
  const res = NextResponse.json({ ok: true });
  const cookieTokens = parseTrustCookie(req.cookies.get(COOKIE.trusted)?.value);
  const keep = cookieTokens.filter((t) => sha256(t) !== hash);
  if (keep.length !== cookieTokens.length) {
    if (keep.length) setTrustCookie(res, keep, 90);
    else clearTrustCookie(res);
  }
  return res;
});
