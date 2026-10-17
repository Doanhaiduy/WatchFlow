"use client";
import { useEffect } from "react";
import { captureInstallPrompt, registerServiceWorker } from "@/lib/pwa";

/**
 * Đăng ký service worker `/sw.js` một lần khi mở ứng dụng (trang "mất kết nối", thông báo đẩy, cài PWA; KHÔNG cache API/trang nghiệp vụ)
 * và bắt sự kiện `beforeinstallprompt` từ lúc tải trang (lib/pwa.ts giữ trong kho dùng chung). Đặt một lần trong root layout; chỉ chạy ở production.
 */
export function RegisterSW() {
  useEffect(() => {
    captureInstallPrompt();
    void registerServiceWorker();
  }, []);
  return null;
}
