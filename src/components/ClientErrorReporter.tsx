"use client";
// Báo lỗi phía trình duyệt về máy chủ (POST /api/v1/public/client-error → error_events, Quản trị → Hệ thống).
// Bắt: window.onerror, unhandledrejection, và lỗi từ error boundary (error.tsx / global-error.tsx gọi reportClientError).
// Không gửi PII: chỉ thông điệp rút gọn, pathname (bỏ query/hash), stack rút gọn, phiên bản ứng dụng. Gộp trùng + trần mỗi lần mở trang.
import { useEffect } from "react";
import { scrubErrorText } from "@/lib/client-error";

type Kind = "boundary" | "global" | "window" | "promise";

const MAX_PER_PAGE = 8;
let sent = 0;
let stopped = false; // máy chủ báo vượt giới hạn (429) ⇒ ngừng gửi trong phiên trang này
const seen = new Set<string>();

/** Gửi một lỗi. Không bao giờ ném lỗi. */
export function reportClientError(kind: Kind, message: string, stack?: string | null, digest?: string | null) {
  try {
    if (typeof window === "undefined" || stopped || sent >= MAX_PER_PAGE) return;
    const msg = scrubErrorText(message || "unknown").slice(0, 500); // che email/số dài/token ngay tại trình duyệt (máy chủ làm sạch thêm lần nữa)
    const key = `${kind}|${msg}`.slice(0, 300);
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({
      kind,
      message: msg,
      digest: digest ? digest.slice(0, 100) : undefined,
      path: window.location.pathname.slice(0, 300), // chỉ pathname: không query/hash (có thể chứa mã/tên)
      stack: stack ? scrubErrorText(stack.split(/\r?\n/).slice(0, 8).join("\n")).slice(0, 2000) : undefined,
      version: process.env.NEXT_PUBLIC_APP_VERSION,
    });
    // keepalive: vẫn gửi được khi người dùng rời trang ngay sau lỗi; dự phòng sendBeacon
    fetch("/api/v1/public/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })
      .then((r) => {
        if (r.status === 429) stopped = true;
      })
      .catch(() => {
        try {
          navigator.sendBeacon?.("/api/v1/public/client-error", new Blob([body], { type: "application/json" }));
        } catch {
          /* bỏ qua */
        }
      });
  } catch {
    /* bỏ qua */
  }
}

/** Lỗi do mạng của người dùng / hủy yêu cầu / lỗi API đã có mã (máy chủ đã ghi) — không phải lỗi giao diện. */
function isExpectedRejection(r: unknown): boolean {
  const o = r as { name?: string; message?: string; status?: unknown; code?: unknown } | undefined;
  if (o?.name === "AbortError") return true;
  if (/Failed to fetch|NetworkError|Load failed|network request failed/i.test(o?.message ?? "")) return true;
  return !!o && typeof o === "object" && "status" in o && "code" in o;
}

/** Gắn một lần ở root layout. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Lỗi tải tài nguyên / script ngoài nguồn (không có thông tin) ⇒ bỏ qua
      if (!e.message || e.message === "Script error.") return;
      reportClientError("window", e.message, e.error instanceof Error ? e.error.stack : `${e.filename}:${e.lineno}:${e.colno}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isExpectedRejection(e.reason)) return;
      const r = e.reason as { message?: string; stack?: string } | undefined;
      reportClientError("promise", r?.message ?? String(e.reason ?? "unhandled rejection"), r?.stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
