"use client";
import { KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { initials } from "@/components/layout/MenuSheet";
import { roleLabel } from "@/components/layout/nav";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";

export default function CtvMePage() {
  const { user, logout } = useSession();
  const toast = useToast();
  const [pw, setPw] = useState(false);
  return (
    <>
      <PageHeader title="Tài khoản của tôi" description="Hồ sơ và mật khẩu" />
      <RequirePerm perm="collab.view_own">
        {user && (
          <div className="wf-stack">
            <section className="g wf-pad">
              <div className="wf-me" style={{ background: "none", padding: 0, marginBottom: 8 }}>
                <span className="av" aria-hidden="true" style={{ width: 52, height: 52, fontSize: 20 }}>{initials(user.fullName)}</span>
                <span className="tx"><b style={{ fontSize: 17 }}>{user.fullName}</b><small>{user.email}</small></span>
              </div>
              <KeyValue items={[{ label: "Vai trò", value: user.roles.map(roleLabel).join(", ") || "Cộng tác viên" }, { label: "Xác thực 2 bước", value: user.mfaEnabled ? "Đang bật" : "Chưa bật" }]} />
            </section>
            <section className="g wf-pad" aria-label="Giao diện">
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Giao diện</h2>
              <ThemeSwitch />
            </section>
            <Button block icon={<KeyRound size={16} aria-hidden="true" />} onClick={() => setPw(true)}>Đổi mật khẩu</Button>
            <Button block icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void logout()}>Đăng xuất</Button>
          </div>
        )}
        <Modal open={pw} onClose={() => setPw(false)} title="Đổi mật khẩu">
          <ChangePasswordForm onCancel={() => setPw(false)} onDone={() => { setPw(false); toast.success("Đã đổi mật khẩu"); }} />
        </Modal>
      </RequirePerm>
    </>
  );
}
