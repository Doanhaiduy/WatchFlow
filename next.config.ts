import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const isDev = process.env.NODE_ENV !== "production";

// CSP của trang: nonce theo yêu cầu ở src/proxy.ts. Ở đây chỉ CSP chặt cho API/tệp tĩnh (không chạy script).
const apiCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

// Tệp tĩnh ngoài proxy (không có nonce): trang offline chỉ chạy style nội tuyến + /offline.js cùng nguồn; service worker chỉ tải script cùng nguồn.
const offlineCsp = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const swCsp = "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const config: NextConfig = {
  reactStrictMode: true,
  // Dev: cho phép mở bằng 127.0.0.1 (Playwright/e2e); thiếu mục này Next 16 chặn tài nguyên dev cross-origin ⇒ trang không hydrate (nút đăng nhập mãi bị khóa)
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "sharp", "pg"],
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: apiCsp }] },
      { source: "/offline.html", headers: [{ key: "Content-Security-Policy", value: offlineCsp }, { key: "Cache-Control", value: "no-cache" }] },
      { source: "/offline.js", headers: [{ key: "Content-Security-Policy", value: swCsp }, { key: "Cache-Control", value: "no-cache" }] },
      { source: "/sw.js", headers: [{ key: "Content-Security-Policy", value: swCsp }, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default config;
