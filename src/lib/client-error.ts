// Làm sạch lỗi phía trình duyệt trước khi ghi nhật ký (security-model §5: không log PII). Thuần TS — dùng cả hai phía + test đơn vị.

/** Che email, chuỗi số dài (SĐT/CCCD/số tài khoản), token/UUID, và phần query của URL trong một đoạn văn bản lỗi. */
export function scrubErrorText(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, "[token]")
    .replace(/(https?:\/\/[^\s?#)"']+|\/[\w./-]+)\?[^\s)"']*/g, "$1")
    .replace(/(?<![\d.])\d[\d .-]{6,}\d(?![\d])/g, (m) => (m.replace(/\D/g, "").length >= 7 ? "#" : m))
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]");
}

/** Đường dẫn trang: bỏ query/hash, thay đoạn là UUID hoặc số bằng :id để gộp lỗi cùng một trang. */
export function normalizeRoute(path: string): string {
  const p = path.split(/[?#]/)[0] ?? "";
  return (
    p
      .split("/")
      .map((seg) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
      .join("/")
      .slice(0, 200) || "/"
  );
}

/** Dòng đầu của stack có vị trí mã (bỏ nguồn ngoài ứng dụng), rút gọn. */
export function topStackFrame(stack: string | undefined): string | undefined {
  const line = stack?.split(/\r?\n/).find((l) => /\/_next\/|webpack|\.tsx?|\.js/.test(l))?.trim();
  return line ? scrubErrorText(line).slice(0, 160) : undefined;
}

/** Lỗi do tiện ích trình duyệt / vòng quan sát kích thước — không phải lỗi của ứng dụng. */
export function isNoiseError(text: string): boolean {
  return /chrome-extension:|moz-extension:|safari-extension:|ResizeObserver loop|Script error\./i.test(text);
}
