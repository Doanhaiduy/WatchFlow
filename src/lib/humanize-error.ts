// Diễn giải lỗi kỹ thuật thành câu tiếng Việt dễ hiểu + gợi ý việc làm tiếp (mẫu: Lưu Xá src/lib/humanize-error.ts, viết lại cho WatchFlow).
// Thuần TS, dùng được ở trình duyệt lẫn máy chủ. Quy tắc: thông điệp WF-* và câu tiếng Việt do máy chủ viết được GIỮ NGUYÊN;
// chỉ lỗi mạng/hủy/hết giờ/lỗi lạ (tiếng Anh, không có mã) và 5xx không có `detail` mới bị thay bằng câu dễ hiểu.

export const MSG = {
  offline: "Thiết bị đang không có mạng. Hãy kiểm tra Wi-Fi/4G rồi thử lại.",
  network: "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại; nếu mạng ổn mà vẫn lỗi, hãy báo cho quản trị viên.",
  timeout: "Máy chủ phản hồi quá chậm nên yêu cầu bị dừng. Hãy thử lại sau vài giây.",
  aborted: "Yêu cầu đã bị hủy. Hãy thử lại.",
  server: "Máy chủ gặp sự cố tạm thời. Hãy thử lại sau ít phút; nếu lặp lại hãy báo cho quản trị viên.",
  unavailable: "Máy chủ đang bận hoặc đang bảo trì. Hãy chờ vài phút rồi thử lại.",
  badResponse: "Máy chủ trả về dữ liệu không đọc được. Hãy tải lại trang rồi thử lại.",
  tooMany: "Bạn thao tác quá nhiều lần. Hãy chờ một chút rồi thử lại.",
  generic: "Có lỗi xảy ra. Vui lòng thử lại; nếu lặp lại hãy báo cho quản trị viên.",
} as const;

const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|err_(?:internet_disconnected|network|connection)|econn(?:refused|reset)|enotfound|socket hang up/i;
const VI_RE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

/** Thông điệp theo mã trạng thái HTTP khi máy chủ không gửi `detail` (vd. trang lỗi HTML của nền tảng). */
export function humanizeHttpStatus(status: number): string {
  if (status === 429) return MSG.tooMany;
  if (status === 502 || status === 503) return MSG.unavailable;
  if (status === 504 || status === 408) return MSG.timeout;
  if (status >= 500) return MSG.server;
  if (status === 404) return "Không tìm thấy nội dung yêu cầu. Hãy tải lại trang.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  return MSG.generic;
}

/**
 * Lỗi bất kỳ (ném từ fetch, từ api-client, từ mã giao diện) → một câu tiếng Việt cho người dùng.
 * - Có `detail` do máy chủ (ApiClientError) ⇒ giữ nguyên.
 * - Lỗi mạng / hủy / hết giờ / JSON hỏng ⇒ câu dễ hiểu kèm gợi ý.
 * - Câu tiếng Việt hoặc bắt đầu bằng mã WF-* ⇒ giữ nguyên; còn lại (tiếng Anh kỹ thuật) ⇒ câu chung.
 */
export function humanizeError(e: unknown): string {
  const o = (e ?? {}) as { name?: string; message?: unknown; detail?: unknown; status?: unknown; code?: unknown };
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (typeof o.detail === "string" && o.detail.trim() && typeof o.status === "number" && o.status > 0) return o.detail; // thông điệp máy chủ (WF-*)
  if (o.name === "TimeoutError") return MSG.timeout;
  if (o.name === "AbortError") return MSG.aborted;
  const msg = typeof e === "string" ? e : typeof o.message === "string" ? o.message : "";
  if (o.name === "SyntaxError" && /json|unexpected (?:token|end)/i.test(msg)) return MSG.badResponse;
  if (NETWORK_RE.test(msg)) return online ? MSG.network : MSG.offline;
  if (!online && (o.name === "TypeError" || !msg)) return MSG.offline;
  if (/timed? ?out|timeout/i.test(msg)) return MSG.timeout;
  if (typeof o.status === "number" && o.status > 0) return humanizeHttpStatus(o.status);
  const m = msg.trim();
  if (m && (/^WF-[A-Z]+/.test(m) || VI_RE.test(m))) return m;
  return MSG.generic;
}

/** Lỗi do mạng/hủy/hết giờ phía người dùng (không phải lỗi của ứng dụng) — để api-client biết có đóng gói thành WF-NETWORK hay không. */
export function isNetworkLevelError(e: unknown): boolean {
  const o = (e ?? {}) as { name?: string; message?: unknown };
  const msg = typeof o.message === "string" ? o.message : "";
  return o.name === "TimeoutError" || (o.name === "TypeError" && NETWORK_RE.test(msg)) || NETWORK_RE.test(msg);
}
