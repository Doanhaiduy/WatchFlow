"use client";
// Xác nhận lại (mật khẩu + OTP nếu bật 2FA) cho thao tác nhạy cảm: máy chủ trả 401 WF-SEC-REAUTH ⇒ mở hộp, gọi /auth/reauth, rồi thử lại đúng thao tác.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiClientError } from "@/lib/api-client";
import { useSession } from "@/lib/session";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { TextInput } from "../ui/TextInput";
import { errMsg, sapi } from "./helpers";

/** Người dùng bấm Hủy ở hộp xác nhận lại */
export class ReauthCancelled extends Error {
  constructor() {
    super("Đã hủy xác nhận lại");
  }
}
export const isReauthCancelled = (e: unknown): e is ReauthCancelled => e instanceof ReauthCancelled;

type Ctx = {
  /**
   * Chạy `fn` (nhớ gọi API bằng `sapi`). Nếu máy chủ đòi xác nhận lại: hỏi mật khẩu/OTP rồi chạy lại `fn` một lần.
   * Ném `ReauthCancelled` nếu người dùng hủy.
   */
  withReauth: <T,>(fn: () => Promise<T>) => Promise<T>;
};

const ReauthContext = createContext<Ctx | null>(null);

export function useReauth(): Ctx {
  const c = useContext(ReauthContext);
  if (!c) throw new Error("useReauth phải nằm trong <ReauthProvider>");
  return c;
}

export function ReauthProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ ok: () => void; no: (e: unknown) => void } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const ask = useCallback((): Promise<void> => {
    // Nhiều thao tác cùng bị đòi ⇒ dùng chung một hộp
    if (inFlight.current) return inFlight.current;
    setPw("");
    setCode("");
    setErr(null);
    setOpen(true);
    const p = new Promise<void>((ok, no) => {
      pending.current = { ok, no };
    }).finally(() => {
      inFlight.current = null;
    });
    inFlight.current = p;
    return p;
  }, []);

  const withReauth = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401 && e.code !== "WF-SEC-REAUTH") {
          location.href = "/dang-nhap?next=" + encodeURIComponent(location.pathname + location.search);
          throw e;
        }
        if (!(e instanceof ApiClientError && e.code === "WF-SEC-REAUTH")) throw e;
        await ask();
        return fn();
      }
    },
    [ask],
  );

  const cancel = () => {
    setOpen(false);
    pending.current?.no(new ReauthCancelled());
    pending.current = null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sapi("/api/v1/auth/reauth", { body: { password: pw, code: code.trim() || undefined } });
      setOpen(false);
      pending.current?.ok();
      pending.current = null;
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ withReauth }), [withReauth]);
  return (
    <ReauthContext.Provider value={value}>
      {children}
      <Modal open={open} onClose={cancel} busy={busy} title="Xác nhận lại">
        <form onSubmit={submit} noValidate>
          <p className="wf-confirm-msg">Thao tác này nhạy cảm. Nhập lại mật khẩu để tiếp tục.</p>
          <Field label="Mật khẩu" required error={err && !code ? err : undefined}>
            <TextInput data-autofocus type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          {user?.mfaEnabled && (
            <Field label="Mã xác thực 2 bước" hint="Mã 6 số hoặc mã khôi phục" error={err && code ? err : undefined}>
              <TextInput inputMode="numeric" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          )}
          <div className="wf-modal-f">
            <Button onClick={cancel} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!pw || (!!user?.mfaEnabled && code.trim().length < 6)}>
              Xác nhận
            </Button>
          </div>
        </form>
      </Modal>
    </ReauthContext.Provider>
  );
}
