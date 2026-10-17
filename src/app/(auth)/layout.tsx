import type { ReactNode } from "react";
import { InAppBrowserBar } from "@/components/pwa/InstallPrompt";

/** Khung các trang trước khi vào ứng dụng (đăng nhập, 2 bước, đổi mật khẩu): không có sidebar/dock, không SessionProvider.
 *  Dải trên cùng cảnh báo khi đang mở trong trình duyệt nhúng của Zalo/Facebook… (đăng nhập dễ bị mất). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="wf-auth-wrap">
      <InAppBrowserBar />
      <main className="wf-auth">
        <div className="wf-auth-in">{children}</div>
      </main>
    </div>
  );
}
