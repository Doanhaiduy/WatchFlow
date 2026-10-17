import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import "@/styles/globals.css";
import { ClientErrorReporter } from "@/components/ClientErrorReporter";
import { RegisterSW } from "@/components/layout/RegisterSW";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeSync } from "@/components/ui/ThemeSwitch";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: { default: "WatchFlow", template: "%s · WatchFlow" },
  description: "Quản lý cửa hàng đồng hồ: kho, bán hàng, sửa chữa, cộng tác viên.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "WatchFlow", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5B5BF0",
};

// CSP nonce (src/proxy.ts) chỉ gắn được khi render động ⇒ mọi trang render theo yêu cầu.
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Đặt data-theme trước khi vẽ (chống nháy trắng); có nonce CSP, không cần 'unsafe-inline'. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        <ToastProvider>{children}</ToastProvider>
        <RegisterSW />
        <ClientErrorReporter />
      </body>
    </html>
  );
}
