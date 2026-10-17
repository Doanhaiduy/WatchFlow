"use client";
import { useEffect, useRef, useState } from "react";
import { OtpInput } from "../lucian/OtpInput";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton, SkeletonGroup } from "../ui/Skeleton";
import { CopyButton } from "./CopyButton";
import { errMsg, sapi } from "./helpers";

type Setup = { secret: string; uri: string; qrSvg: string };

/**
 * Thiết lập xác thực 2 bước: quét QR (hoặc nhập khóa) → nhập mã 6 số → hiện mã khôi phục MỘT LẦN.
 * `qrSvg` do máy chủ sinh từ thư viện qrcode (không phải dữ liệu người dùng) nên được render trực tiếp.
 */
export function MfaSetupPanel({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [otpErr, setOtpErr] = useState("Mã không đúng hoặc đã hết hạn. Thử lại");
  const started = useRef(false);

  const load = async () => {
    setLoadErr(null);
    try {
      setSetup(await sapi<Setup>("/api/v1/auth/mfa/setup", { method: "POST" }));
    } catch (e) {
      setLoadErr(errMsg(e));
    }
  };
  useEffect(() => {
    if (started.current) return; // StrictMode: chỉ sinh khóa một lần
    started.current = true;
    void load();
  }, []);

  if (codes) {
    return (
      <div>
        <p className="wf-confirm-msg">
          <b>Lưu mã khôi phục ngay.</b> Mỗi mã dùng được một lần khi mất điện thoại. Sẽ không hiện lại lần nữa.
        </p>
        <ul className="wf-codes" aria-label="Mã khôi phục">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="wf-dev-row" style={{ margin: "12px 0" }}>
          <CopyButton text={codes.join("\n")} label="Sao chép tất cả" />
        </div>
        <Checkbox checked={saved} onChange={setSaved} label="Tôi đã lưu mã khôi phục ở nơi an toàn" />
        <div className="wf-modal-f">
          <Button variant="primary" disabled={!saved} onClick={onDone}>
            Hoàn tất
          </Button>
        </div>
      </div>
    );
  }
  if (loadErr) return <ErrorState title="Không tạo được khóa 2 bước" description={loadErr} onRetry={async () => (await load(), true)} />;
  if (!setup) {
    return (
      <SkeletonGroup>
        <Skeleton w={200} h={200} radius={20} style={{ margin: "0 auto 16px" }} />
        <Skeleton w="100%" h={58} radius={14} />
      </SkeletonGroup>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <ol className="wf-mute" style={{ textAlign: "left", marginBottom: 12, paddingLeft: 18, listStyle: "decimal" }}>
        <li>Mở ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…).</li>
        <li>Quét mã QR bên dưới hoặc nhập khóa thủ công.</li>
        <li>Nhập mã 6 số ứng dụng hiển thị.</li>
      </ol>
      <div className="wf-qr" role="img" aria-label="Mã QR thiết lập xác thực 2 bước" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
      <p className="wf-mute" style={{ margin: "10px 0 4px" }}>
        Khóa thủ công
      </p>
      <p className="wf-mono">{setup.secret}</p>
      <CopyButton text={setup.secret} label="Sao chép khóa" />
      <div style={{ marginTop: 16 }}>
        <OtpInput
          hint="Nhập mã 6 số để xác nhận"
          errorText={otpErr}
          autoFocus
          onComplete={async (code) => {
            try {
              const r = await sapi<{ ok: boolean; recoveryCodes: string[] | null }>("/api/v1/auth/mfa/verify", { body: { code } });
              if (r.recoveryCodes?.length) setCodes(r.recoveryCodes);
              else onDone();
              return true;
            } catch (e) {
              setOtpErr(errMsg(e));
              return false;
            }
          }}
        />
      </div>
    </div>
  );
}
