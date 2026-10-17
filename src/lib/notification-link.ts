// Liên kết mở khi bấm thông báo (đẩy hoặc trong hộp thư). Thuần hàm — dùng được ở máy chủ, trình duyệt và test.

/** Liên kết trong ứng dụng hợp lệ: đường dẫn tương đối, không trỏ ra ngoài (chặn "//host", "/\host", ký tự điều khiển), tối đa 500 ký tự. */
export function safeLink(link: unknown): string | null {
  if (typeof link !== "string" || link.length > 500) return null;
  if (!link.startsWith("/") || link.startsWith("//")) return null;
  for (let i = 0; i < link.length; i++) {
    const c = link.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return null; // ký tự điều khiển hoặc dấu gạch chéo ngược
  }
  return link;
}
