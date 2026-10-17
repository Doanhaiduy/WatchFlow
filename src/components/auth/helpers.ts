import { ApiClientError, api, type ApiOptions } from "@/lib/api-client";
import { humanizeError } from "@/lib/humanize-error";
import type { SessionUser } from "@/lib/session";

/** Câu lỗi tiếng Việt từ lỗi API (hoặc câu chung) */
export function errMsg(e: unknown): string {
  return e instanceof ApiClientError ? e.detail : humanizeError(e);
}

/** Lỗi theo trường: { "newPassword": "…" } */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiClientError && e.errors) for (const x of e.errors) if (!(x.path in out)) out[x.path] = x.message;
  return out;
}

/** Chỉ cho đường dẫn nội bộ ("/…", không "//") để tránh chuyển hướng ra ngoài */
export function safeNext(n: string | null | undefined): string {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

/** Bước đăng nhập còn dở (null = đã đủ để vào ứng dụng) */
export function nextStep(u: SessionUser): "/xac-thuc-2-buoc" | "/doi-mat-khau" | null {
  if (u.mfaEnabled && !u.mfaOk) return "/xac-thuc-2-buoc";
  if (u.mfaRequired && !u.mfaEnabled) return "/xac-thuc-2-buoc";
  if (u.mustChangePassword) return "/doi-mat-khau";
  return null;
}

export async function fetchMe(): Promise<SessionUser | null> {
  try {
    return (await api<{ user: SessionUser }>("/api/v1/auth/me", { noRedirect: true })).user;
  } catch {
    return null;
  }
}

/** Gọi API cho thao tác nhạy cảm: KHÔNG tự chuyển trang khi 401 (để `useReauth` xử lý WF-SEC-REAUTH) */
export function sapi<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  return api<T>(path, { ...opts, noRedirect: true });
}
