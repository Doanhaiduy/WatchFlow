import "server-only";
// Cookie phiên (security-model §7): access __Host-wf_at (HttpOnly, Path=/); refresh __Secure-wf_rt (Path=/api/v1/auth — tiền tố
// __Host- bắt buộc Path=/ nên dùng __Secure-); CSRF __Host-wf_csrf (đọc được bởi JS, double-submit).
// Chạy http local (COOKIE_SECURE=false) ⇒ bỏ tiền tố và cờ Secure.
import type { NextResponse } from "next/server";
import { env } from "../env";

const secure = () => env.cookieSecure;
export const COOKIE = {
  get at() { return secure() ? "__Host-wf_at" : "wf_at"; },
  get rt() { return secure() ? "__Secure-wf_rt" : "wf_rt"; },
  get csrf() { return secure() ? "__Host-wf_csrf" : "wf_csrf"; },
  /** Thiết bị tin cậy 2FA (httpOnly, Path=/api/v1/auth, SameSite=Strict) — chỉ chứa token ngẫu nhiên, DB giữ SHA-256 */
  get trusted() { return secure() ? "__Secure-wf_td" : "wf_td"; },
};

/** rt = null ⇒ giữ nguyên cookie refresh hiện có (ân hạn hai tab, CQ-005). */
export function setAuthCookies(res: NextResponse, at: string, atTtl: number, rt: string | null, rtTtlDays: number) {
  res.cookies.set(COOKIE.at, at, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: atTtl });
  if (rt) res.cookies.set(COOKIE.rt, rt, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/api/v1/auth", maxAge: rtTtlDays * 86400 });
}

export function setCsrfCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE.csrf, token, { httpOnly: false, secure: secure(), sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(COOKIE.at, "", { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(COOKIE.rt, "", { httpOnly: true, secure: secure(), sameSite: "lax", path: "/api/v1/auth", maxAge: 0 });
}

/** Cookie thiết bị tin cậy: token(s) ngẫu nhiên 256-bit, chỉ gửi tới /api/v1/auth (cùng đường dẫn cookie refresh). */
export function setTrustCookie(res: NextResponse, value: string, days: number) {
  res.cookies.set(COOKIE.trusted, value, { httpOnly: true, secure: secure(), sameSite: "strict", path: "/api/v1/auth", maxAge: days * 86400 });
}

export function clearTrustCookie(res: NextResponse) {
  res.cookies.set(COOKIE.trusted, "", { httpOnly: true, secure: secure(), sameSite: "strict", path: "/api/v1/auth", maxAge: 0 });
}
