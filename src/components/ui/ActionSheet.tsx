"use client";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BusyVeil, useBusyFocus, useCloseGuard } from "./CloseGuard";
import { type Tone } from "./cx";
import { useIsClient } from "./Modal";
import { useOverlayBehavior, usePresence } from "./overlay";

export type ActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  onSelect?: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  actions: ActionItem[];
  title?: string;
  cancelLabel?: string;
  /** Có thay đổi chưa lưu: bấm nền/Esc/Hủy hỏi "Bỏ thay đổi chưa lưu?" (chọn một hành động thì không hỏi) */
  dirty?: boolean;
  /** Đang xử lý: chặn đóng + thao tác, phủ lớp "Đang xử lý…" */
  busy?: boolean;
};

/** `.as` — nhóm hành động nhanh trong thẻ kính trượt từ đáy + nút "Hủy" rời, scrim mờ (từ nút "+" của dock). */
export function ActionSheet({ open, onClose, actions, title, cancelLabel = "Hủy", dirty, busy }: Props) {
  const client = useIsClient();
  const { mounted, shown } = usePresence(open, 400);
  const ref = useRef<HTMLDivElement>(null);
  const guard = useCloseGuard({ dirty, busy, open: open && mounted, onClose });
  useOverlayBehavior(ref, open && mounted && client, guard.request);
  useBusyFocus(busy, ref);
  if (!client || !mounted) return null;
  return createPortal(
    <div className="wf-layer">
      <div className="wf-scrim" data-open={shown} onClick={guard.request} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title ?? "Hành động nhanh"} tabIndex={-1} className="wf-as" data-open={shown} aria-busy={busy || undefined} inert={busy || undefined}>
        <div className="wf-as-grp">
          {title && <div className="wf-as-t">{title}</div>}
          {actions.map((a) => {
            const inner = (
              <>
                <i data-tone={a.tone} aria-hidden="true">
                  {a.icon}
                </i>
                {a.label}
              </>
            );
            return a.href ? (
              <Link key={a.id} href={a.href} className="wf-as-it" onClick={() => { onClose(); a.onSelect?.(); }}>
                {inner}
              </Link>
            ) : (
              <button key={a.id} type="button" className="wf-as-it" onClick={() => { onClose(); a.onSelect?.(); }}>
                {inner}
              </button>
            );
          })}
        </div>
        <button type="button" className="wf-as-cancel" onClick={guard.request}>
          {cancelLabel}
        </button>
      </div>
      {busy && <BusyVeil target={ref} />}
      {guard.dialog}
    </div>,
    document.body,
  );
}
