"use client";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { useOnline } from "./OfflineBanner";
import { Textarea } from "./TextInput";

type Props = {
  open: boolean;
  title: string;
  /** Nêu hậu quả bằng số, vd. "Sẽ trả máy về kho và hủy thanh toán 8.200.000 ₫" */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Thao tác nguy hiểm (hủy/tịch thu/ghi mất): nút đỏ + biểu tượng cảnh báo */
  danger?: boolean;
  /** Bắt nhập lý do */
  requireReason?: boolean;
  /** Số ký tự tối thiểu của lý do (mặc định 10) */
  reasonMin?: number;
  reasonLabel?: string;
  loading?: boolean;
  /** Focus mặc định vào nút Hủy/Ở lại (Enter = không làm gì). Mặc định bật khi `danger`. */
  focusCancel?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
  onCancel: () => void;
};

/** Hộp xác nhận (UX nguyên tắc 8): nêu hậu quả, tùy chọn bắt lý do ≥ 10 ký tự, khóa khi mất mạng hoặc đang gửi. */
export function ConfirmDialog({
  open, title, message, confirmLabel = "Xác nhận", cancelLabel = "Hủy", danger, requireReason, reasonMin = 10,
  reasonLabel = "Lý do", loading, focusCancel = !!danger, onConfirm, onCancel,
}: Props) {
  const [reason, setReason] = useState("");
  const online = useOnline();
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);
  const trimmed = reason.trim();
  const missing = requireReason ? Math.max(0, reasonMin - trimmed.length) : 0;
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      locked={loading}
      title={title}
      footer={
        <>
          <Button data-autofocus={focusCancel && !requireReason ? "" : undefined} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} disabled={missing > 0 || !online} onClick={() => onConfirm(requireReason ? trimmed : undefined)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="wf-confirm-ic" data-tone={danger ? "bad" : "info"} aria-hidden="true">
        <Icon size={26} />
      </div>
      <p className="wf-confirm-msg">{message}</p>
      {requireReason && (
        <Field label={reasonLabel} required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}>
          <Textarea data-autofocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Ghi rõ lý do để lưu vào nhật ký" />
        </Field>
      )}
      {!online && (
        <p className="wf-fld-err" role="status">
          Mất kết nối — chưa thể xác nhận.
        </p>
      )}
    </Modal>
  );
}
