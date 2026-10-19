// Logic thuần của nhật ký hoạt động (không phụ thuộc máy chủ ⇒ test đơn vị được): chuẩn hóa route mẫu, chọn request nào được ghi,
// gắn mã "đọc nhạy cảm". Quy tắc riêng tư: KHÔNG ghi query, KHÔNG ghi giá trị tham số đường dẫn, KHÔNG ghi nội dung gửi lên.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Khớp CHECK ck của activity_logs.route (0021) — route sai mẫu bị bỏ, không làm hỏng cả lô ghi. */
export const ROUTE_RE = /^\/api\/[a-z0-9/_[\]-]{1,180}$/;

/** Đường dẫn → mẫu: giá trị tham số thay bằng [tên] (vd. /api/v1/sales/[id]/confirm). Bỏ query nếu lỡ có. */
export function routeOf(pathname: string, params: Record<string, string>): string {
  const byValue = new Map<string, string>();
  for (const [k, v] of Object.entries(params)) if (!byValue.has(v)) byValue.set(v, k);
  return pathname
    .split("?")[0]!
    .split("/")
    .map((seg) => {
      let dec = seg;
      try { dec = decodeURIComponent(seg); } catch { /* giữ nguyên */ }
      const k = byValue.get(dec);
      return k ? `[${k}]` : seg;
    })
    .join("/")
    .replace(/\/+$/, "");
}

/** UUID của đối tượng được thao tác (tham số đường dẫn đầu tiên có dạng UUID) — định danh, không phải PII. */
export function entityIdOf(params: Record<string, string>): string | null {
  for (const v of Object.values(params)) if (UUID_RE.test(v)) return v.toLowerCase();
  return null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Thao tác ghi KHÔNG phải hành động của người dùng (poll/đánh dấu đã đọc/tự báo lỗi) — không ghi. */
export const SKIP_ROUTES = new Set([
  "POST /api/v1/notifications/[id]/read",
  "POST /api/v1/notifications/read-all",
  "POST /api/v1/public/client-error",
  "POST /api/v1/public/ops-heartbeat",
]);

/** Route đọc rất hay bị gọi (poll, gõ từng phím, nạp trang) — không bao giờ ghi dù lỗi quyền. */
export const SKIP_READ_PREFIXES = [
  "/api/health",
  "/api/v1/me/badges",
  "/api/v1/notifications",
  "/api/v1/search",
  "/api/v1/store-info",
  "/api/v1/auth/me",
  "/api/v1/system/status",
  "/api/v1/catalog/units/lookup",
];

/**
 * Mã sự kiện đọc/ghi nhạy cảm (cột action): xuất file, in, xem báo cáo, xem nhật ký.
 * Chỉ dựa trên method + route + tham số `format` (không lưu query).
 */
export function actionOf(method: string, route: string, query: URLSearchParams): string | null {
  const key = `${method} ${route}`;
  switch (key) {
    case "GET /api/v1/reports/[code]": return query.get("format") === "xlsx" ? "export" : "view_report";
    case "GET /api/v1/reports/collaborators": return "view_report";
    // Tổng quan (reports/dashboard) tự nạp mỗi lần mở trang chủ ⇒ không ghi (sẽ làm ngập nhật ký); số liệu nhạy cảm vẫn do RLS/quyền chặn
    case "POST /api/v1/sales/[id]/print":
    case "GET /api/v1/catalog/units/[id]/label": return "print";
    case "GET /api/v1/audit": return query.get("page") && query.get("page") !== "1" ? null : "view_audit";
    case "GET /api/v1/activity": return query.get("before") ? null : "view_audit";
    default: return null;
  }
}

/**
 * Có ghi request này không?
 *  • Mọi thao tác ghi (POST/PUT/PATCH/DELETE), trừ SKIP_ROUTES — kể cả khi lỗi (thấy được ai thử làm gì).
 *  • Đọc (GET): chỉ khi là sự kiện nhạy cảm (action ≠ null) hoặc bị từ chối quyền (403, trừ khi chỉ thiếu bước 2FA/đổi mật khẩu).
 */
export function shouldRecord(method: string, route: string, status: number, errorCode: string | null, action: string | null): boolean {
  if (SKIP_ROUTES.has(`${method} ${route}`)) return false;
  if (MUTATING.has(method)) return true;
  if (method !== "GET") return false;
  if (SKIP_READ_PREFIXES.some((p) => route === p || route.startsWith(p + "/"))) return false;
  if (action) return true;
  return status === 403 && errorCode !== "WF-AUTH-MFA-REQUIRED" && errorCode !== "WF-AUTH-MUST-CHANGE-PASSWORD";
}
