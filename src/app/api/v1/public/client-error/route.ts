import { z } from "zod";
import { publicApi } from "@/server/http";
import { hitDb } from "@/server/ratelimit";
import { recordErrorEvent } from "@/server/ops";
import { isNoiseError, normalizeRoute, scrubErrorText, topStackFrame } from "@/lib/client-error";

export const runtime = "nodejs";

const Body = z.object({
  /** boundary (error.tsx) | global (global-error.tsx) | window (onerror) | promise (unhandledrejection) */
  kind: z.enum(["boundary", "global", "window", "promise"]),
  message: z.string().min(1).max(500),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
  stack: z.string().max(2000).optional(),
  version: z.string().max(32).optional(),
});

/**
 * Lỗi phía trình duyệt báo về (không cần đăng nhập — lỗi có thể xảy ra ở trang đăng nhập). Bảo vệ: kiểm Origin (cùng nguồn),
 * Zod giới hạn độ dài, giới hạn tốc độ lưu DB theo ipHash (30/phút) + trần chung 600/giờ (security-model §7),
 * làm sạch PII (email/số dài/token/query) rồi ghi error_events (source "client"). Không lưu IP, cookie, user-agent.
 */
export const POST = publicApi({ body: Body, csrf: "origin" }, async (ctx) => {
  await hitDb("clientError", ctx.ipHash);
  await hitDb("clientErrorAll", "all");
  const b = ctx.body;
  if (isNoiseError(`${b.message} ${b.stack ?? ""}`)) return { ok: true, ignored: true };
  const top = topStackFrame(b.stack);
  await recordErrorEvent({
    source: "client",
    route: b.path ? normalizeRoute(b.path) : undefined,
    code: b.kind,
    message: `${scrubErrorText(b.message)}${top ? ` @ ${top}` : ""}`,
    requestId: b.digest ?? ctx.requestId,
    appVersion: b.version,
  });
  return { ok: true };
});
