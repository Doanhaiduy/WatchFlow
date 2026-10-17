import { Suspense } from "react";
import { ChangePasswordView } from "./ChangePasswordView";

export const metadata = { title: "Đổi mật khẩu" };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordView />
    </Suspense>
  );
}
