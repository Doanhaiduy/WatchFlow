"use client";
// Bảng nổi gắn vào một nút (Select, DateInput…) — desktop. Portal ra <body>, z theo thang --wf-z-popover (trên Modal),
// tự lật lên khi sát đáy, rộng ≥ nút, bám theo nút khi cuộn/đổi cỡ, đóng khi bấm ra ngoài hoặc Esc (chỉ lớp trên cùng).
// Cách làm tham khảo FloatingPanel/Portal của ref-sources/domus-francis, viết lại theo token Glass.
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useIsClient } from "./Modal";
import { useOverlayBehavior, usePresence } from "./overlay";

type Pos = { top: number; left: number; width: number; maxH: number; side: "down" | "up" };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Nút neo (và cũng là vùng "bên trong" khi xét bấm ngoài) */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Chiều cao ước lượng của nội dung (px) để quyết định lật lên/xuống */
  height?: number;
  /** Rộng tối thiểu (px); mặc định bằng nút */
  minWidth?: number;
  /** Rộng cố định (px) thay vì theo nút (vd. lịch) */
  width?: number;
  className?: string;
  id?: string;
  role?: string;
  "aria-label"?: string;
};

const GAP = 8;
const EDGE = 8;

export function Popover({ open, onClose, anchorRef, children, height = 320, minWidth, width, className, id, role, ...aria }: Props) {
  const client = useIsClient();
  const { mounted, shown } = usePresence(open, 220);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useOverlayBehavior(ref, open && mounted && client, onClose, { trap: false, lock: false, autoFocus: false, restoreFocus: false });

  const place = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(width ?? Math.max(r.width, minWidth ?? 0), vw - EDGE * 2);
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const side: Pos["side"] = below >= Math.min(height, 280) || below >= above ? "down" : "up";
    const avail = Math.max(140, side === "down" ? below : above);
    const h = Math.min(height, avail);
    const left = Math.max(EDGE, Math.min(r.left, vw - EDGE - w));
    const top = side === "down" ? r.bottom + GAP : r.top - GAP - h;
    setPos((p) => (p && p.top === top && p.left === left && p.width === w && p.maxH === avail && p.side === side ? p : { top, left, width: w, maxH: avail, side }));
  }, [anchorRef, height, minWidth, width]);

  useLayoutEffect(() => {
    if (!mounted) {
      setPos(null);
      return;
    }
    place();
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    const a = anchorRef.current;
    const ro = a ? new ResizeObserver(on) : null;
    if (a) ro?.observe(a);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
      ro?.disconnect();
    };
  }, [mounted, place, anchorRef]);

  // Bấm ra ngoài (không phải nút neo, không phải bảng) thì đóng
  useLayoutEffect(() => {
    if (!open) return;
    const on = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      closeRef.current();
    };
    document.addEventListener("pointerdown", on, true);
    return () => document.removeEventListener("pointerdown", on, true);
  }, [open, anchorRef]);

  if (!client || !mounted) return null;
  const style: CSSProperties = pos
    ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }
    : { top: 0, left: 0 }; // chưa đo xong: nằm im, trong suốt (data-open=false) nhưng vẫn focus được
  return createPortal(
    <div ref={ref} id={id} role={role} className={cx("wf-pop", className)} style={style} data-side={pos?.side ?? "down"} data-open={shown && !!pos} {...aria}>
      {children}
    </div>,
    document.body,
  );
}
