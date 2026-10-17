"use client";
// Mã VietQR cho khoản thu CHUYỂN KHOẢN (port từ Lưu Xá: PayQrDialog/QrImage/CopyField, vẽ bằng token Glass).
// Mã được dựng NGAY TRÊN TRÌNH DUYỆT (thư viện qrcode) từ cài đặt tài khoản của cửa hàng — không gọi dịch vụ ngoài.
// QR CHỈ HIỂN THỊ để khách quét: không tự ghi tiền (BR-PAY-02). Người thu bấm "Xác nhận" sau khi thấy tiền vào tài khoản.
import { QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CopyCodeButton } from "../lucian/CopyCodeButton";
import { useOptionalSession } from "@/lib/session";
import { useStoreInfo } from "@/lib/store-info";
import { formatVnd } from "@/lib/money";
import { bankByBin, buildTransferContent, buildVietQrPayload, canBuildVietQr, qrDataUrl } from "@/lib/vietqr";

type Props = {
  /** Số tiền chuyển khoản (VND nguyên). ≤ 0 ⇒ không hiện */
  amount: number;
  /** Mã phiếu thật (đã có). Chưa có (phiếu đang tạo) ⇒ dùng `fallbackRef` */
  reference?: string | null;
  /** Mã tạm khi phiếu chưa có mã, vd. "COC GIU HANG" */
  fallbackRef: string;
};

/** Ảnh QR (data URL) của một chuỗi; màu lấy từ token "giấy in" (luôn đen trên trắng, kể cả chế độ tối). */
function useQr(payload: string | null, size: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!payload) return;
    const cs = getComputedStyle(document.documentElement);
    const dark = cs.getPropertyValue("--wf-paper-ink").trim();
    const light = cs.getPropertyValue("--wf-paper").trim();
    void qrDataUrl(payload, size, /^#[0-9a-f]{6}$/i.test(dark) ? dark : undefined, /^#[0-9a-f]{6}$/i.test(light) ? light : undefined)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [payload, size]);
  return url;
}

function Row({ label, value, shown, copyLabel }: { label: string; value: string; shown?: string; copyLabel: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--wf-line)" }}>
      <span style={{ minWidth: 0 }}>
        <small className="wf-mute" style={{ display: "block", fontSize: 11.5 }}>{label}</small>
        <b className="wf-num" style={{ fontSize: 14, overflowWrap: "anywhere" }}>{shown ?? value}</b>
      </span>
      <CopyCodeButton text={value} label={copyLabel} />
    </div>
  );
}

export function TransferQr({ amount, reference, fallbackRef }: Props) {
  const session = useOptionalSession();
  const { data } = useStoreInfo();
  const pay = data?.payment;
  const ok = !!pay && pay.configured && canBuildVietQr(pay.bankBin, pay.accountNo);
  const content = useMemo(() => buildTransferContent(pay?.transferTemplate, reference || fallbackRef), [pay?.transferTemplate, reference, fallbackRef]);
  const payload = useMemo(() => {
    if (!ok || !pay || amount <= 0) return null;
    try {
      return buildVietQrPayload({ bankBin: pay.bankBin, accountNo: pay.accountNo, amountVnd: amount, content });
    } catch {
      return null;
    }
  }, [ok, pay, amount, content]);
  const img = useQr(payload, 480);

  if (!data || amount <= 0) return null;
  if (!ok) {
    if (!session?.can(["settings.view", "settings.manage"])) return null;
    return (
      <p className="wf-mute" style={{ fontSize: 12.5, marginTop: 10 }} role="note">
        Chưa cấu hình tài khoản nhận tiền nên chưa hiện mã QR. <Link href="/quan-tri/cai-dat" style={{ color: "var(--wf-accent-text)", textDecoration: "underline" }}>Quản trị → Cài đặt → Thanh toán</Link>.
      </p>
    );
  }
  const bank = bankByBin(pay.bankBin);
  return (
    <section className="g wf-pad" style={{ marginTop: 12 }} aria-label="Mã QR chuyển khoản">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ width: 208, height: 208, borderRadius: 18, background: "var(--wf-paper)", padding: 8, boxShadow: "0 1px 0 var(--wf-line)", display: "grid", placeItems: "center" }}>
          {img ? <img src={img} alt={`Mã QR chuyển khoản ${formatVnd(amount)}, nội dung ${content}`} width={192} height={192} style={{ width: 192, height: 192, display: "block" }} /> : <QrCode size={40} aria-label="Đang tạo mã QR" style={{ color: "var(--wf-mute)" }} />}
        </div>
        <small className="wf-mute" style={{ textAlign: "center" }}>Quét bằng ứng dụng ngân hàng bất kỳ (VietQR)</small>
      </div>
      <div style={{ marginTop: 6 }}>
        <Row label="Ngân hàng" value={bank?.name ?? pay.bankBin} copyLabel="Sao chép tên ngân hàng" />
        <Row label="Số tài khoản" value={pay.accountNo} copyLabel="Sao chép số tài khoản" />
        {pay.accountName && <Row label="Chủ tài khoản" value={pay.accountName} copyLabel="Sao chép tên chủ tài khoản" />}
        <Row label="Số tiền" value={String(Math.round(amount))} shown={formatVnd(amount)} copyLabel="Sao chép số tiền" />
        <Row label="Nội dung chuyển khoản" value={content} copyLabel="Sao chép nội dung chuyển khoản" />
      </div>
      <p className="wf-mute" style={{ fontSize: 12.5, marginTop: 8 }} role="note">Mã QR chỉ để khách quét. Bấm <b>Xác nhận</b> sau khi đã thấy tiền vào tài khoản — hệ thống không tự ghi nhận tiền.</p>
    </section>
  );
}
