// Nhận diện trình duyệt NHÚNG trong ứng dụng khác (Zalo, Facebook…) — nơi không cài được ứng dụng, không nhận thông báo đẩy
// và hay mất đăng nhập. Thuần hàm (không đụng window) — có test đơn vị. Mẫu: ref-sources/domus-francis/src/lib/push.ts.

export interface InAppBrowserInfo {
  app: "zalo" | "facebook" | "messenger" | "instagram" | "tiktok" | "line";
  label: string;
}

/** Nhận diện theo user-agent; null = trình duyệt thường. */
export function detectInAppBrowser(ua: string): InAppBrowserInfo | null {
  if (/Zalo/i.test(ua)) return { app: "zalo", label: "Zalo" };
  if (/FBAN\/Messenger|MessengerForiOS|FB_IAB\/MESSENGER|\bMessenger\b/i.test(ua)) return { app: "messenger", label: "Messenger" };
  if (/Instagram/i.test(ua)) return { app: "instagram", label: "Instagram" };
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|\[FB/i.test(ua)) return { app: "facebook", label: "Facebook" };
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return { app: "tiktok", label: "TikTok" };
  if (/\bLine\/\d/i.test(ua)) return { app: "line", label: "LINE" };
  return null;
}

/** Liên kết intent:// mở trang bằng Chrome trên Android (trình duyệt nhúng của Zalo/Facebook thường cho phép). null nếu href không hợp lệ. */
export function chromeIntentUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  } catch {
    return null;
  }
}
