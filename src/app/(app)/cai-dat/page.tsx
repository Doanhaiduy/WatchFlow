"use client";
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { errMsg, sapi } from "@/components/auth/helpers";
import { MfaSetupPanel } from "@/components/auth/MfaSetupPanel";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { initials } from "@/components/layout/MenuSheet";
import { InstallSection } from "@/components/pwa/InstallPrompt";
import { PushSettings } from "@/components/pwa/PushSettings";
import { roleLabel } from "@/components/layout/nav";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";

type TrustedDev = { id: string; label: string; createdAt: string; lastUsedAt: string | null; expiresAt: string; current: boolean };
type Sess = { id: string; created_at: string; last_seen_at: string; user_agent: string | null; current: boolean };

/** "Chrome · Windows" từ chuỗi user-agent (chỉ để người dùng nhận ra thiết bị) */
function deviceName(ua: string | null): string {
  if (!ua) return "Thiết bị không rõ";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Trình duyệt";
  const o = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return o ? `${b} · ${o}` : b;
}

export default function MePage() {
  const { user, reload, logout } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const sessions = useSWR<{ items: Sess[] }>("/api/v1/auth/sessions", swrFetcher);
  const trusted = useSWR<{ days: number; items: TrustedDev[] }>(user?.mfaEnabled ? "/api/v1/auth/trusted-devices" : null, swrFetcher);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [offBusy, setOffBusy] = useState(false);
  const [revoke, setRevoke] = useState<Sess | null>(null);
  const [revBusy, setRevBusy] = useState(false);
  if (!user) return null;

  const disableMfa = async () => {
    setOffBusy(true);
    try {
      await withReauth(() => sapi("/api/v1/auth/mfa/disable", { method: "POST" }));
      await reload();
      setOffOpen(false);
      toast.success("Đã tắt xác thực 2 bước");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không tắt được xác thực 2 bước", errMsg(e));
    } finally {
      setOffBusy(false);
    }
  };
  const forgetDevices = async (id?: string) => {
    setForgetBusy(true);
    try {
      await sapi(id ? `/api/v1/auth/trusted-devices/${id}` : "/api/v1/auth/trusted-devices", { method: "DELETE" });
      await trusted.mutate();
      toast.success(id ? "Đã bỏ tin cậy thiết bị đó" : "Đã quên các thiết bị tin cậy");
      setForgetOpen(false);
    } catch (e) {
      toast.error("Không thu hồi được thiết bị tin cậy", errMsg(e));
    } finally {
      setForgetBusy(false);
    }
  };
  const doRevoke = async () => {
    if (!revoke) return;
    setRevBusy(true);
    try {
      await sapi(`/api/v1/auth/sessions/${revoke.id}/revoke`, { method: "POST" });
      await sessions.mutate();
      toast.success("Đã đăng xuất thiết bị đó");
      setRevoke(null);
    } catch (e) {
      toast.error("Không thu hồi được phiên", errMsg(e));
    } finally {
      setRevBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Tài khoản" description="Hồ sơ, bảo mật và các thiết bị đăng nhập" />
      <div className="wf-stack" style={{ marginTop: 12 }}>
        <section className="g wf-pad" aria-label="Hồ sơ">
          <div className="wf-me" style={{ marginBottom: 8, background: "none", padding: 0 }}>
            <span className="av" aria-hidden="true" style={{ width: 52, height: 52, fontSize: 20 }}>
              {initials(user.fullName)}
            </span>
            <span className="tx">
              <b style={{ fontSize: 17 }}>{user.fullName}</b>
              <small>{user.email}</small>
            </span>
          </div>
          <div className="wf-dev-row" style={{ marginBottom: 6 }}>
            {user.roles.map((r) => (
              <StatusChip key={r} tone="info">
                {roleLabel(r)}
              </StatusChip>
            ))}
          </div>
        </section>

        <section className="g wf-pad" aria-label="Giao diện">
          <h2 className="wf-g-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            Giao diện
          </h2>
          <ThemeSwitch />
          <p className="wf-mute" style={{ marginTop: 8, fontSize: 12.5 }}>Lưu trên thiết bị này. “Theo hệ thống” đổi sáng/tối theo cài đặt của điện thoại hoặc máy tính.</p>
        </section>

        <InstallSection />
        <PushSettings />

        <section className="g wf-pad" aria-label="Bảo mật">
          <h2 className="wf-g-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Bảo mật
          </h2>
          <KeyValue
            items={[
              { label: "Mật khẩu", value: user.mustChangePassword ? <StatusChip tone="hold">Cần đổi</StatusChip> : <StatusChip tone="ok">Đã đặt</StatusChip> },
              {
                label: "Xác thực 2 bước",
                value: user.mfaEnabled ? <StatusChip tone="ok">Đang bật</StatusChip> : <StatusChip tone={user.mfaRequired ? "bad" : "neutral"}>{user.mfaRequired ? "Bắt buộc, chưa bật" : "Chưa bật"}</StatusChip>,
              },
            ]}
          />
          <div className="wf-dev-row" style={{ marginTop: 12 }}>
            <Button icon={<KeyRound size={18} aria-hidden="true" />} onClick={() => setPwOpen(true)}>
              Đổi mật khẩu
            </Button>
            {user.mfaEnabled ? (
              <Button icon={<ShieldCheck size={18} aria-hidden="true" />} onClick={() => setOffOpen(true)} disabled={user.mfaRequired}>
                Tắt xác thực 2 bước
              </Button>
            ) : (
              <Button variant="primary" icon={<ShieldCheck size={18} aria-hidden="true" />} onClick={() => setMfaOpen(true)}>
                Bật xác thực 2 bước
              </Button>
            )}
          </div>
          {user.mfaEnabled && user.mfaRequired && <p className="wf-mute" style={{ marginTop: 8 }}>Vai trò của bạn bắt buộc xác thực 2 bước nên không tắt được.</p>}
        </section>

        <section aria-label="Thiết bị đăng nhập">
          <div className="wf-sec">
            <h3>Thiết bị đang đăng nhập</h3>
          </div>
          {sessions.isLoading ? (
            <SkeletonList rows={2} />
          ) : sessions.error ? (
            <div className="g wf-pad">
              <ErrorState description={errMsg(sessions.error)} onRetry={async () => (await sessions.mutate()) !== undefined} />
            </div>
          ) : sessions.data && sessions.data.items.length > 0 ? (
            <InsetList label="Phiên đăng nhập">
              {sessions.data.items.map((s) => (
                <InsetRow
                  key={s.id}
                  icon={s.current ? <MonitorSmartphone size={20} aria-hidden="true" /> : <Smartphone size={20} aria-hidden="true" />}
                  tone={s.current ? "ok" : "neutral"}
                  title={deviceName(s.user_agent)}
                  subtitle={`Hoạt động ${formatDateTimeVn(s.last_seen_at)}`}
                  end={s.current ? <StatusChip tone="ok">Phiên này</StatusChip> : <Button sm onClick={() => setRevoke(s)}>Thu hồi</Button>}
                />
              ))}
            </InsetList>
          ) : (
            <div className="g wf-pad">
              <EmptyState title="Không có phiên nào khác" icon={<MonitorSmartphone size={24} aria-hidden="true" />} />
            </div>
          )}
        </section>

        {user.mfaEnabled && trusted.data && trusted.data.days > 0 && (
          <section aria-label="Thiết bị tin cậy">
            <div className="wf-sec">
              <h3>Thiết bị tin cậy ({trusted.data.days} ngày)</h3>
            </div>
            {trusted.data.items.length > 0 ? (
              <>
                <InsetList label="Thiết bị tin cậy">
                  {trusted.data.items.map((d) => (
                    <InsetRow
                      key={d.id}
                      icon={<ShieldCheck size={20} aria-hidden="true" />}
                      tone={d.current ? "ok" : "neutral"}
                      title={d.label}
                      subtitle={`Hết hạn ${formatDateTimeVn(d.expiresAt)}${d.lastUsedAt ? ` · dùng ${formatDateTimeVn(d.lastUsedAt)}` : ""}`}
                      end={d.current ? <StatusChip tone="ok">Máy này</StatusChip> : <Button sm onClick={() => void forgetDevices(d.id)}>Bỏ</Button>}
                    />
                  ))}
                </InsetList>
                <div className="wf-dev-row" style={{ marginTop: 10 }}>
                  <Button onClick={() => setForgetOpen(true)}>Quên các thiết bị đã tin cậy</Button>
                </div>
              </>
            ) : (
              <div className="g wf-pad">
                <p className="wf-mute" style={{ margin: 0 }}>Chưa có thiết bị nào. Khi đăng nhập, tick “Tin cậy thiết bị này” ở bước nhập mã để bỏ qua mã 6 số trong {trusted.data.days} ngày (mật khẩu vẫn luôn cần).</p>
              </div>
            )}
          </section>
        )}

        <Button block icon={<LogOut size={18} aria-hidden="true" />} onClick={() => void logout()}>
          Đăng xuất
        </Button>
      </div>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Đổi mật khẩu">
        <ChangePasswordForm
          onCancel={() => setPwOpen(false)}
          onDone={() => {
            setPwOpen(false);
            toast.success("Đã đổi mật khẩu");
            void sessions.mutate();
          }}
        />
      </Modal>
      <Modal open={mfaOpen} onClose={() => setMfaOpen(false)} title="Bật xác thực 2 bước">
        <MfaSetupPanel
          onDone={async () => {
            setMfaOpen(false);
            await reload();
            toast.success("Đã bật xác thực 2 bước");
          }}
        />
      </Modal>
      <ConfirmDialog
        open={offOpen}
        danger
        title="Tắt xác thực 2 bước?"
        message="Đăng nhập chỉ còn dùng mật khẩu, kém an toàn hơn. Bạn sẽ phải nhập lại mật khẩu để xác nhận."
        confirmLabel="Tắt"
        loading={offBusy}
        onCancel={() => setOffOpen(false)}
        onConfirm={() => void disableMfa()}
      />
      <ConfirmDialog
        open={forgetOpen}
        danger
        title="Quên các thiết bị đã tin cậy?"
        message="Mọi thiết bị (kể cả máy này) sẽ phải nhập mã xác thực 2 bước ở lần đăng nhập sau."
        confirmLabel="Quên hết"
        loading={forgetBusy}
        onCancel={() => setForgetOpen(false)}
        onConfirm={() => void forgetDevices()}
      />
      <ConfirmDialog
        open={!!revoke}
        danger
        title="Thu hồi phiên này?"
        message={revoke ? `Thiết bị "${deviceName(revoke.user_agent)}" sẽ bị đăng xuất ngay.` : ""}
        confirmLabel="Thu hồi"
        loading={revBusy}
        onCancel={() => setRevoke(null)}
        onConfirm={() => void doRevoke()}
      />
    </>
  );
}
