"use client";
// Bảo vệ đóng lớp phủ (Modal / ActionSheet / DetentSheet) bằng prop RÕ RÀNG `dirty` / `busy` — không dò DOM, không đoán theo chữ nút.
//   dirty ⇒ mọi đường đóng (bấm nền, Esc, X, vuốt xuống, nút Hủy dùng <ModalClose/>) hỏi "Bỏ thay đổi chưa lưu?" ("Ở lại" là mặc định).
//   busy  ⇒ chặn đóng + chặn thao tác bên trong (inert) + lớp "Đang xử lý…" (hiện sau 0,2 giây để lần xử lý nhanh không nháy).
// Ý tưởng từ ModalGuard của ref-sources/domus-francis; khác: ở đây ứng dụng khai báo trạng thái, không quét giao diện.
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useIsClient, useOverlayBehavior, usePresence } from "./overlay";

/** Trình duyệt hỏi lại khi đóng tab/tải lại trang lúc còn thay đổi chưa lưu hoặc đang gửi dữ liệu */
export function useBeforeUnload(active: boolean, skip?: { current: boolean }) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => {
      if (skip?.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active, skip]);
}

type DiscardProps = {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  title?: string;
  message?: ReactNode;
  stayLabel?: string;
  discardLabel?: string;
};

/**
 * Hộp "Bỏ thay đổi chưa lưu?": "Ở lại" là nút mặc định (focus + Esc), "Bỏ thay đổi" đỏ.
 * Tự dựng (không dùng Modal/ConfirmDialog) để Modal dùng được mà không vòng phụ thuộc.
 */
export function DiscardConfirm({ open, onStay, onDiscard, title = "Bỏ thay đổi chưa lưu?", message = "Những gì bạn vừa nhập sẽ mất.", stayLabel = "Ở lại", discardLabel = "Bỏ thay đổi" }: DiscardProps) {
  const client = useIsClient();
  const { mounted, shown } = usePresence(open, 400);
  const ref = useRef<HTMLDivElement>(null);
  useOverlayBehavior(ref, open && mounted && client, onStay);
  if (!client || !mounted) return null;
  return createPortal(
    <div className="wf-layer">
      <div className="wf-scrim" data-open={shown} onClick={onStay} aria-hidden="true" />
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="wf-discard-t" aria-describedby="wf-discard-m" tabIndex={-1} className="wf-modal" data-open={shown}>
        <div className="wf-gb" aria-hidden="true" />
        <h2 id="wf-discard-t" className="wf-modal-h">
          <span>{title}</span>
        </h2>
        <div className="wf-confirm-ic" data-tone="bad" aria-hidden="true">
          <AlertTriangle size={26} />
        </div>
        <p id="wf-discard-m" className="wf-confirm-msg">{message}</p>
        <div className="wf-modal-f">
          <Button data-autofocus onClick={onStay}>{stayLabel}</Button>
          <Button variant="danger" onClick={onDiscard}>{discardLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type GuardOpts = { dirty?: boolean; busy?: boolean; open: boolean; onClose: () => void };

/** Cổng đóng dùng chung: `request()` thay cho `onClose` ở mọi đường đóng; `dialog` render ở cuối lớp phủ. */
export function useCloseGuard({ dirty, busy, open, onClose }: GuardOpts) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!open || busy || !dirty) setAsk(false);
  }, [open, busy, dirty]);
  const request = useCallback(() => {
    if (busy) return;
    if (dirty) setAsk(true);
    else onClose();
  }, [busy, dirty, onClose]);
  const dialog = <DiscardConfirm open={ask} onStay={() => setAsk(false)} onDiscard={() => { setAsk(false); onClose(); }} />;
  useBeforeUnload(!!open && (!!dirty || !!busy));
  return { request, dialog };
}

/** Khi busy: trả focus về phần tử đang giữ focus lúc bắt đầu (inert làm mất focus), nếu còn trong lớp phủ */
export function useBusyFocus(busy: boolean | undefined, scope: RefObject<HTMLElement | null>) {
  const saved = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (busy) {
      const a = document.activeElement as HTMLElement | null;
      saved.current = a && scope.current?.contains(a) ? a : null;
      return;
    }
    const el = saved.current;
    saved.current = null;
    if (el && el.isConnected && !(el as HTMLButtonElement).disabled) el.focus({ preventScroll: true });
  }, [busy, scope]);
}

/** Lớp "Đang xử lý…" phủ đúng khung của `target` (đặt cùng cấp với khung, không cuộn theo nội dung) */
export function BusyVeil({ target, inline, label = "Đang xử lý…" }: { target?: RefObject<HTMLElement | null>; /** true: phủ kín phần tử cha có position (không đo khung) */ inline?: boolean; label?: string }) {
  const [r, setR] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (inline || !target) return;
    const measure = () => {
      const b = target.current?.getBoundingClientRect();
      if (b) setR({ top: b.top, left: b.left, width: b.width, height: b.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [target, inline]);
  return (
    <div className={inline ? "wf-busy wf-busy-in" : "wf-busy"} role="status" aria-live="polite" style={inline ? undefined : (r ?? { top: 0, left: 0, width: 0, height: 0 })}>
      <span className="wf-spin" aria-hidden="true" />
      <b>{label}</b>
    </div>
  );
}
