import { defineConfig } from "@playwright/test";

// e2e (testing-strategy): điện thoại 390×844 + máy tính 1366×768, axe, ảnh chụp giao diện Glass.
// Chạy qua `pnpm test:e2e` (scripts/test-e2e.mjs dựng DB watchflow_e2e + máy chủ cổng 3300). Dùng Edge/Chrome có sẵn (channel) — không cần tải trình duyệt.
const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3300";
const channel = process.env.E2E_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: { baseURL: BASE, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" },
  projects: [
    { name: "mobile-390", use: { channel, viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "desktop-1366", use: { channel, viewport: { width: 1366, height: 768 } } },
  ],
});
