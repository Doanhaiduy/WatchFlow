import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { COOKIE } from "@/server/auth/cookies";
import { clearTrustCookie, listTrustedDevices, parseTrustCookie, revokeAllTrustedDevices } from "@/server/auth/trusted-device";

// Thiết bị tin cậy của CHÍNH MÌNH (cài đặt → Bảo mật). Bảng trusted_devices chỉ wf_auth truy cập (wf_app không đọc được).
export const GET = api({}, async ({ req, user }) => listTrustedDevices(user.userId, parseTrustCookie(req.cookies.get(COOKIE.trusted)?.value)));

/** "Quên các thiết bị đã tin cậy": thu hồi tất cả + gỡ cookie trên trình duyệt này. */
export const DELETE = api({}, async ({ user, ipHash }) => {
  const n = await revokeAllTrustedDevices(user.userId, ipHash);
  return clearTrustCookie(NextResponse.json({ ok: true, revoked: n }));
});
