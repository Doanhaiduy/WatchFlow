"use client";
// Gọi API từ trình duyệt: gắn CSRF (double-submit), tự làm mới phiên khi 401, ném ApiClientError có mã WF-* + câu tiếng Việt.
// Lỗi mạng/hết giờ (fetch ném trước khi có phản hồi) ⇒ ApiClientError(0, "WF-NETWORK", câu dễ hiểu); hủy chủ động (AbortError) giữ nguyên.
import { humanizeError, humanizeHttpStatus, isNetworkLevelError } from "./humanize-error";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string,
    public requestId?: string,
    public errors?: { path: string; message: string }[],
  ) {
    super(detail);
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
}

export function csrfToken(): string | undefined {
  return readCookie("__Host-wf_csrf") ?? readCookie("wf_csrf");
}

let refreshing: Promise<boolean> | null = null;
export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken() ?? "" },
      credentials: "same-origin",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => setTimeout(() => (refreshing = null), 0));
  }
  return refreshing;
}

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Gửi Idempotency-Key (giữ nguyên khi thử lại) */
  idempotencyKey?: string;
  ifMatch?: number;
  signal?: AbortSignal;
  /** Không tự chuyển trang đăng nhập khi 401 */
  noRedirect?: boolean;
};

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    let body: BodyInit | undefined;
    if (opts.body instanceof FormData) body = opts.body;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (method !== "GET") headers["X-CSRF-Token"] = csrfToken() ?? "";
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts.ifMatch !== undefined) headers["If-Match"] = String(opts.ifMatch);
    return fetch(path.startsWith("/") ? path : `/api/v1/${path}`, { method, headers, body, credentials: "same-origin", signal: opts.signal }).catch((e: unknown) => {
      if (opts.signal?.aborted || (e as { name?: string })?.name === "AbortError") throw e; // hủy chủ động: để nơi gọi (SWR/AbortController) tự xử lý
      if (isNetworkLevelError(e)) throw new ApiClientError(0, "WF-NETWORK", humanizeError(e));
      throw e;
    });
  };
  let res = await doFetch();
  if (res.status === 401 && !path.includes("/auth/login")) {
    const ok = await refreshSession();
    if (ok) res = await doFetch();
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const code = data?.code ?? "WF-UNKNOWN";
    const sessionGone = code === "WF-AUTH-UNAUTHENTICATED";
    // Phiên đã chết thật (làm mới cũng thất bại) ⇒ về trang đăng nhập, kể cả lời gọi noRedirect ngoài /auth/*
    // (tránh màn im lặng "danh sách rỗng"); /auth/* (me, đăng nhập, xác thực lại) tự xử lý.
    const redirectable = !opts.noRedirect || !path.includes("/auth/");
    if (res.status === 401 && sessionGone && redirectable && typeof window !== "undefined" && !location.pathname.startsWith("/dang-nhap")) {
      location.href = "/dang-nhap?next=" + encodeURIComponent(location.pathname + location.search);
    }
    if (code === "WF-AUTH-MUST-CHANGE-PASSWORD" && typeof window !== "undefined" && !location.pathname.startsWith("/doi-mat-khau")) {
      location.href = "/doi-mat-khau";
    }
    if (code === "WF-AUTH-MFA-REQUIRED" && typeof window !== "undefined" && !location.pathname.startsWith("/xac-thuc-2-buoc")) {
      location.href = "/xac-thuc-2-buoc";
    }
    throw new ApiClientError(res.status, code, data?.detail ?? humanizeHttpStatus(res.status), data?.requestId, data?.errors);
  }
  return data as T;
}

/** fetcher cho SWR */
export const swrFetcher = <T,>(path: string) => api<T>(path);

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
