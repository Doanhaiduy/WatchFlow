"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe, nextStep, safeNext } from "@/components/auth/helpers";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { useToast } from "@/components/ui/Toast";

export function ChangePasswordView() {
  const router = useRouter();
  const toast = useToast();
  const next = safeNext(useSearchParams().get("next"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchMe().then((u) => {
      if (!live) return;
      if (!u) return router.replace(`/dang-nhap?next=${encodeURIComponent(next)}`);
      const step = nextStep(u);
      if (step === "/xac-thuc-2-buoc") return router.replace(`/xac-thuc-2-buoc?next=${encodeURIComponent(next)}`);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [router, next]);

  if (!ready) return <div className="g wf-auth-card" role="status" aria-busy="true" aria-label="Đang tải" style={{ minHeight: 280 }} />;
  return (
    <div className="g wf-auth-card">
      <h1>Đổi mật khẩu</h1>
      <p>Bạn đang dùng mật khẩu tạm hoặc cần đổi mật khẩu. Đặt mật khẩu mới để tiếp tục.</p>
      <ChangePasswordForm
        submitLabel="Lưu mật khẩu mới"
        onDone={() => {
          toast.success("Đã đổi mật khẩu");
          router.replace(next);
        }}
      />
    </div>
  );
}
