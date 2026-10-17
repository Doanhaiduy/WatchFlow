"use client";
import { X } from "lucide-react";
import { createContext, useContext, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonVariant } from "./Button";
import { BusyVeil, useBusyFocus, useCloseGuard } from "./CloseGuard";
import { cx } from "./cx";
import { useIsClient, useOverlayBehavior, usePresence } from "./overlay";

export { useIsClient };

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  /** Hàng nút cuối (thường Button) */
  footer?: ReactNode;
  /** "modal": trượt từ đáy (mobile) / giữa màn hình 520px (desktop). "full": sheet toàn màn hình (menu) */
  variant?: "modal" | "full";
  /** Không đóng khi bấm nền/Esc (đang gửi dữ liệu…). Dùng `busy` nếu muốn thêm lớp "Đang xử lý…" */
  locked?: boolean;
  /** Có thay đổi chưa lưu: bấm nền/Esc/X/<ModalClose/> hỏi "Bỏ thay đổi chưa lưu?" ("Ở lại" mặc định) */
  dirty?: boolean;
  /** Đang gửi: chặn đóng, chặn thao tác bên trong (inert) và phủ lớp "Đang xử lý…" */
  busy?: boolean;
  className?: string;
};

const CloseCtx = createContext<(() => void) | null>(null);

/** Hàm đóng CÓ bảo vệ của Modal bao quanh (hỏi khi `dirty`, bỏ qua khi `busy`). Ngoài Modal: undefined. */
export function useModalClose(): (() => void) | undefined {
  return useContext(CloseCtx) ?? undefined;
}

/** Nút "Hủy/Đóng" trong chân hộp thoại: đi qua cổng bảo vệ của Modal (khác `onClick={onClose}` trần). */
export function ModalClose({ children = "Hủy", variant, sm, block, disabled }: { children?: ReactNode; variant?: ButtonVariant; sm?: boolean; block?: boolean; disabled?: boolean }) {
  const close = useModalClose();
  return (
    <Button variant={variant} sm={sm} block={block} disabled={disabled} onClick={close}>
      {children}
    </Button>
  );
}

/**
 * Bottom sheet / Modal Glass: scrim, Esc đóng, bẫy focus, khóa cuộn nền, trả focus khi đóng.
 * Mobile: trượt từ đáy + thanh kéo; desktop ≥ 1000px: hộp giữa màn hình rộng 520px (§4.2).
 * Quy tắc `dirty`/`busy`: ui-design-system §5.2.
 */
export function Modal({ open, onClose, title, children, footer, variant = "modal", locked, dirty, busy, className }: Props) {
  const client = useIsClient();
  const { mounted, shown } = usePresence(open, variant === "full" ? 450 : 400);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const blocked = !!locked || !!busy;
  const guard = useCloseGuard({ dirty, busy: blocked, open: open && mounted, onClose });
  const close = () => {
    if (!blocked) guard.request();
  };
  useOverlayBehavior(ref, open && mounted && client, close);
  useBusyFocus(busy, ref);
  if (!client || !mounted) return null;

  const full = variant === "full";
  return createPortal(
    <CloseCtx.Provider value={close}>
      <div className="wf-layer">
        {!full && <div className="wf-scrim" data-open={shown} onClick={close} aria-hidden="true" />}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : "Hộp thoại"}
          aria-busy={busy || undefined}
          tabIndex={-1}
          className={cx(full ? "wf-sheet" : "wf-modal", className)}
          data-open={shown}
          data-busy={busy || undefined}
        >
          {!full && <div className="wf-gb" aria-hidden="true" />}
          <div className={full ? "wf-sheet-in" : undefined} inert={busy || undefined}>
            {title && (
              <h2 id={titleId} className="wf-modal-h">
                <span>{title}</span>
                <button type="button" className="wf-modal-x" onClick={close} aria-label="Đóng" disabled={blocked}>
                  <X size={20} />
                </button>
              </h2>
            )}
            {children}
            {footer && <div className="wf-modal-f">{footer}</div>}
          </div>
        </div>
        {busy && <BusyVeil target={ref} />}
        {guard.dialog}
      </div>
    </CloseCtx.Provider>,
    document.body,
  );
}

/** Tên khác của Modal — dùng khi ý đồ là tờ trượt từ đáy (giỏ POS, form nhận máy…) */
export const BottomSheet = Modal;
