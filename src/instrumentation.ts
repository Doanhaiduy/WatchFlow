// Hook khởi động / bắt lỗi của Next.js (mẫu: Lưu Xá src/instrumentation.ts).
// KHÔNG chạy tác vụ nền trong tiến trình: WatchFlow dùng route cron (/api/cron/*, Vercel Cron — overview §7;
// máy local gọi tay bằng Bearer CRON_SECRET) nên không cần bộ hẹn giờ trong tiến trình như Lưu Xá; chỉ giữ phần mở sẵn kết nối DB.
export async function register() {
  // Điều kiện đúng dạng này để Next loại import khỏi bản build Edge (pg cần module Node)
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    // Máy chủ chạy lâu (local / `pnpm start`): mở sẵn vài kết nối DB. Trên Vercel (serverless) bỏ qua — chỉ làm chậm khởi động lạnh.
    const { warmPool } = await import("./server/db");
    warmPool().catch((e) => console.warn("[db] không mở sẵn được kết nối:", (e as Error).message));
  }
}

/**
 * Lỗi chưa bắt khi render Server Component / chạy Route Handler / Server Action (Next ≥ 15). Ghi error_events (source "server-render").
 * Không ghi nội dung request, header, cookie, query — chỉ phương thức + đường dẫn đã chuẩn hóa, mã digest, thông điệp rút gọn.
 * Lỗi trong route bọc bằng api()/publicApi() đã được handleError ghi (source "api") và trả phản hồi, nên không tới đây;
 * hook này chỉ thấy lỗi ở trang (render) và route không bọc (cron, health, ops-heartbeat).
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType?: string; routePath?: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as { message?: string; digest?: string };
  const path = (request.path ?? "").split(/[?#]/)[0] ?? "";
  try {
    const { recordErrorEvent } = await import("./server/ops");
    const { normalizeRoute, scrubErrorText } = await import("./lib/client-error");
    await recordErrorEvent({
      source: "server-render",
      route: `${request.method} ${context.routePath ?? normalizeRoute(path)}`.slice(0, 200),
      code: context.routeType ?? undefined,
      message: scrubErrorText(String(e?.message ?? "unknown")).slice(0, 300),
      requestId: e?.digest,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    });
  } catch {
    /* không để lỗi ghi log làm hỏng yêu cầu */
  }
}
