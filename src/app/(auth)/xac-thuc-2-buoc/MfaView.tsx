"use client";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SessionUser } from "@/lib/session";
import { errMsg, fetchMe, nextStep, safeNext, sapi } from "@/components/auth/helpers";
import { MfaSetupPanel } from "@/components/auth/MfaSetupPanel";
import { OtpInput } from "@/components/lucian/OtpInput";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { TextInput } from "@/components/ui/TextInput";

export function MfaView() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [rc, setRc] = useState("");
  const [rcErr, setRcErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trust, setTrust] = useState(false);
  const [otpErr, setOtpErr] = useState("Mã không đúng hoặc đã hết hạn. Thử lại");

  const proceed = useCallback(async () => {
    const me = await fetchMe();
    if (!me) return router.replace(`/dang-nhap?next=${encodeURIComponent(next)}`);
    const step = nextStep(me);
    router.replace(step && step !== "/xac-thuc-2-buoc" ? `${step}?next=${encodeURIComponent(next)}` : step ? `/xac-thuc-2-buoc?next=${encodeURIComponent(next)}` : next);
  }, [router, next]);

  useEffect(() => {
    let live = true;
    void fetchMe().then((u) => {
      if (!live) return;
      if (!u) return router.replace(`/dang-nhap?next=${encodeURIComponent(next)}`);
      if (nextStep(u) !== "/xac-thuc-2-buoc") return void proceed();
      setUser(u);
    });
    return () => {
      live = false;
    };
  }, [router, next, proceed]);

  if (!user) {
    return (
      <div className="g wf-auth-card">
        <SkeletonGroup>
          <Skeleton w={160} h={26} />
          <div style={{ height: 12 }} />
          <Skeleton w="100%" h={58} radius={14} />
        </SkeletonGroup>
      </div>
    );
  }

  const verifying = user.mfaEnabled; // đã bật nhưng phiên chưa xác thực
  const submitRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setRcErr(null);
    try {
      await sapi("/api/v1/auth/mfa/verify", { body: { code: rc.trim(), trustDevice: trust } });
      await proceed();
    } catch (x) {
      setRcErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="g wf-auth-card">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {verifying ? <ShieldCheck size={26} aria-hidden="true" /> : <KeyRound size={26} aria-hidden="true" />}
        {verifying ? "Xác thực 2 bước" : "Bật xác thực 2 bước"}
      </h1>
      {verifying ? (
        <>
          <p>{recovery ? "Nhập một mã khôi phục (10 ký tự) chưa dùng." : "Nhập mã 6 số trong ứng dụng xác thực của bạn."}</p>
          {recovery ? (
            <form onSubmit={submitRecovery} noValidate>
              <Field label="Mã khôi phục" error={rcErr}>
                <TextInput data-autofocus autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={20} value={rc} onChange={(e) => setRc(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" block loading={busy} disabled={rc.trim().length < 6}>
                Xác nhận
              </Button>
            </form>
          ) : (
            <OtpInput
              autoFocus
              errorText={otpErr}
              onComplete={async (code) => {
                try {
                  await sapi("/api/v1/auth/mfa/verify", { body: { code, trustDevice: trust } });
                  await proceed();
                  return true;
                } catch (e) {
                  setOtpErr(errMsg(e));
                  return false;
                }
              }}
            />
          )}
          {(user.trustedDeviceDays ?? 30) > 0 && (
            <div style={{ marginTop: 12 }}>
              <Checkbox checked={trust} onChange={setTrust} label={`Tin cậy thiết bị này ${user.trustedDeviceDays ?? 30} ngày`} />
              <p className="wf-mute" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Lần sau trên máy này chỉ cần mật khẩu, không hỏi mã 6 số. Chỉ chọn trên máy của bạn.</p>
            </div>
          )}
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <Button sm onClick={() => setRecovery((r) => !r)}>
              {recovery ? "Dùng mã trong ứng dụng" : "Dùng mã khôi phục"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>Vai trò của bạn bắt buộc xác thực 2 bước. Thiết lập một lần, lần sau chỉ cần mã 6 số khi đăng nhập.</p>
          <MfaSetupPanel onDone={() => void proceed()} />
        </>
      )}
    </div>
  );
}
