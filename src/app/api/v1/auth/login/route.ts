import { NextResponse } from "next/server";
import { publicApi, ensureCsrf } from "@/server/http";
import { login } from "@/server/auth/service";
import { COOKIE, setAuthCookies } from "@/server/auth/cookies";
import { parseTrustCookie } from "@/server/auth/trusted-device";
import { limitFailures } from "@/server/ratelimit";
import { LoginBody } from "@/lib/types/auth";

// Giới hạn tốc độ đăng nhập: chỉ tính lần THẤT BẠI theo IP và theo tài khoản (CQ-004 — cửa hàng dùng chung một IP).
// Giữ chỗ trước khi kiểm mật khẩu (yêu cầu song song không lách được); khóa tài khoản theo email đã chuẩn hóa như service.
// Thiết bị tin cậy (cookie httpOnly): mật khẩu LUÔN được kiểm; chỉ khi token hợp lệ của đúng tài khoản này mới bỏ bước mã 2FA.
export const POST = publicApi({ body: LoginBody, csrf: "origin" }, async ({ req, body, ipHash, userAgent }) => {
  const email = body.email.trim().toLowerCase();
  const trustTokens = parseTrustCookie(req.cookies.get(COOKIE.trusted)?.value);
  const { issued, mfaPending, viaTrusted } = await limitFailures(
    [["authIp", ipHash], ["authAccount", email]],
    ["WF-AUTH-INVALID", "WF-AUTH-LOCKED"],
    () => login(email, body.password, userAgent, ipHash, trustTokens),
    "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  );
  const res = NextResponse.json({ ok: true, mfaPending, trustedDevice: viaTrusted });
  setAuthCookies(res, issued.accessToken, issued.accessTtl, issued.refreshToken, issued.refreshTtlDays);
  return ensureCsrf(req, res);
});
