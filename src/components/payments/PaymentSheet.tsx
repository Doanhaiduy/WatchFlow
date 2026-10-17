"use client";
import { useEffect, useState, type ReactNode } from "react";
import { MoneyAmountInput } from "../lucian/MoneyAmountInput";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { MoneyInput } from "../ui/MoneyInput";
import { useOnline } from "../ui/OfflineBanner";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TransferQr } from "./TransferQr";
import { formatVnd } from "@/lib/money";

export type PaymentMethod = "cash" | "bank_transfer";
export type PaymentLineInput = { method: PaymentMethod; amount: number; cashTendered?: number };
type Mode = "cash" | "bank" | "mixed";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Số còn phải thu — do MÁY CHỦ tính; sheet không tự tính tiền, chỉ gợi ý hiển thị */
  payable: number;
  /** Cho phép thu thiếu (phần thiếu ghi nợ, có hạn hẹn trả) */
  allowDebt?: boolean;
  submitting?: boolean;
  /** Dòng thanh toán gửi đi: số THU thực (không phải số khách đưa). Tiền thừa chỉ để hiển thị. */
  onSubmit: (lines: PaymentLineInput[]) => void;
  title?: string;
  /** Nội dung thêm đặt dưới phần tóm tắt (vd. ô hẹn trả nợ) */
  extra?: ReactNode;
  /** Mã phiếu thật (nếu đã có) — làm nội dung chuyển khoản trong mã VietQR */
  reference?: string | null;
  /** Mã tạm khi phiếu chưa có mã (vd. phiếu nháp ở POS) */
  fallbackRef?: string;
};

const min = (a: number, b: number) => (a < b ? a : b);

/**
 * Tờ thanh toán (M3): chip Tiền mặt / Chuyển khoản / Kết hợp, "Khách đưa" → tiền thừa, còn nợ nếu thiếu.
 * `cashTendered` chỉ gửi kèm dòng tiền mặt để máy chủ ghi tiền thừa; số tiền ghi sổ là `amount`.
 */
export function PaymentSheet({ open, onClose, payable, allowDebt, submitting, onSubmit, title = "Thanh toán", extra, reference, fallbackRef = "THANH TOAN" }: Props) {
  const online = useOnline();
  const [mode, setMode] = useState<Mode>("cash");
  const [tendered, setTendered] = useState(0);
  const [bank, setBank] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setMode("cash");
      setTendered(payable);
      setBank(null);
    }
  }, [open, payable]);
  const changeMode = (m: Mode) => {
    setMode(m);
    setTendered(m === "cash" ? payable : 0);
    setBank(m === "bank" ? payable : null);
  };

  // Phân bổ số thu (chỉ để hiển thị/gửi; máy chủ kiểm lại)
  const bankAmt = mode === "bank" ? min(allowDebt ? (bank ?? payable) : payable, payable) : mode === "mixed" ? min(bank ?? 0, payable) : 0;
  const cashAmt = mode === "bank" ? 0 : min(tendered, payable - bankAmt);
  const collected = cashAmt + bankAmt;
  const remaining = payable - collected;
  const change = mode === "bank" ? 0 : Math.max(0, tendered - cashAmt);
  const ok = collected > 0 && (remaining === 0 || !!allowDebt) && online;

  const submit = () => {
    const lines: PaymentLineInput[] = [];
    if (cashAmt > 0) lines.push({ method: "cash", amount: cashAmt, ...(tendered > cashAmt ? { cashTendered: tendered } : {}) });
    if (bankAmt > 0) lines.push({ method: "bank_transfer", amount: bankAmt });
    onSubmit(lines);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      title={title}
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>Hủy</Button>
          <Button variant="primary" guard loading={submitting} disabled={!ok} onClick={submit}>
            Xác nhận thu {formatVnd(collected)}
          </Button>
        </>
      }
    >
      <div className="g wf-pad" style={{ marginBottom: 12, textAlign: "center" }}>
        <p className="wf-mute">Còn phải thu</p>
        <div className="wf-uprice">{formatVnd(payable)}</div>
      </div>
      <SegmentedControl ariaLabel="Hình thức thanh toán" value={mode} onChange={changeMode} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank", label: "Chuyển khoản" }, { value: "mixed", label: "Kết hợp" }]} />

      {mode !== "bank" && (
        <div style={{ marginTop: 14 }}>
          <p className="wf-fld-label" style={{ textAlign: "center" }}>Khách đưa (tiền mặt)</p>
          <MoneyAmountInput
            value={tendered}
            onChange={setTendered}
            fullAmount={mode === "cash" ? payable : Math.max(0, payable - bankAmt)}
            quickAdds={[50_000, 100_000, 500_000]}
            subText={(v) => (v === 0 ? "Nhập số tiền khách đưa" : change > 0 ? `Tiền thừa trả khách: ${formatVnd(change)}` : v < payable - bankAmt ? `Thiếu ${formatVnd(payable - bankAmt - v)}` : "Vừa đủ")}
            ariaLabel="Khách đưa tiền mặt"
          />
        </div>
      )}
      {(mode === "bank" || mode === "mixed") && (
        <div style={{ marginTop: 10 }}>
          <Field label="Số tiền chuyển khoản" hint={mode === "bank" && !allowDebt ? "Chuyển khoản đủ số còn phải thu" : undefined}>
            <MoneyInput value={mode === "bank" ? bankAmt : bank} onChange={setBank} disabled={mode === "bank" && !allowDebt} max={payable} quickAdds={mode === "mixed" ? [Math.max(0, payable - cashAmt)].filter((x) => x > 0) : undefined} />
          </Field>
        </div>
      )}

      <div className="g wf-pad" style={{ marginTop: 12 }} aria-live="polite">
        <div className="wf-kv">
          <div style={{ display: "flex", justifyContent: "space-between" }}><span className="wf-mute">Thu tiền mặt</span><b className="wf-num">{formatVnd(cashAmt)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span className="wf-mute">Thu chuyển khoản</span><b className="wf-num">{formatVnd(bankAmt)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span className="wf-mute">Tổng thu</span><b className="wf-num">{formatVnd(collected)}</b></div>
          {remaining > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: allowDebt ? "var(--wf-hold-text)" : "var(--wf-bad-text)" }}>
              <span>{allowDebt ? "Còn nợ" : "Chưa đủ"}</span>
              <b className="wf-num">{formatVnd(remaining)}</b>
            </div>
          )}
        </div>
        {remaining > 0 && !allowDebt && <p className="wf-fld-err" role="status">Phiếu này phải thu đủ, chưa cho ghi nợ.</p>}
        {!online && <p className="wf-fld-err" role="status">Mất kết nối — chưa thể xác nhận.</p>}
      </div>
      {bankAmt > 0 && <TransferQr amount={bankAmt} reference={reference} fallbackRef={fallbackRef} />}
      {extra}
    </Modal>
  );
}
