"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/** Chỉ render portal sau khi đã ở trình duyệt (tránh lệch hydrate) */
export function useIsClient() {
  const [c, setC] = useState(false);
  useEffect(() => setC(true), []);
  return c;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const stack: object[] = []; // lớp phủ trên cùng mới nhận phím (Esc/Tab)
let lockCount = 0;
let savedOverflow = "";
function lockScroll() {
  if (lockCount++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--lockCount === 0) document.body.style.overflow = savedOverflow;
}

/**
 * Giữ một lớp phủ (sheet/modal/action sheet) mounted đủ lâu để chạy hoạt ảnh đóng.
 * Trả `{ mounted, shown }`: render khi `mounted`; gắn `data-open={shown}` để CSS chuyển động.
 */
export function usePresence(open: boolean, ms = 400) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // đợi một khung để CSS thấy trạng thái đầu rồi mới chuyển
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

export type OverlayOptions = {
  /** Bẫy Tab trong lớp phủ (mặc định true) */
  trap?: boolean;
  /** Khóa cuộn nền (mặc định true) */
  lock?: boolean;
  /** Chuyển focus vào lớp phủ khi mở (mặc định true) */
  autoFocus?: boolean;
  /** Trả focus về phần tử đang giữ focus trước khi mở (mặc định true) */
  restoreFocus?: boolean;
};

/**
 * Hành vi chung của mọi lớp phủ (Modal, sheet, ActionSheet, Select/DateInput…): Esc đóng lớp TRÊN CÙNG (xếp chồng),
 * bẫy focus trong `ref`, khóa cuộn nền, focus vào phần tử `data-autofocus` (hoặc phần tử đầu tiên), trả focus khi đóng.
 * Popover chỉ cần Esc: truyền `{ trap: false, lock: false, autoFocus: false, restoreFocus: false }`.
 */
export function useOverlayBehavior(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void, opts: OverlayOptions = {}) {
  const { trap = true, lock = true, autoFocus = true, restoreFocus = true } = opts;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const me = {};
    stack.push(me);
    if (lock) lockScroll();
    const el = ref.current;
    if (autoFocus) {
      // focus vào phần tử đầu tiên (hoặc chính lớp phủ)
      const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? el)?.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el || !trap) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const a = items[0]!, z = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
      if (lock) unlockScroll();
      if (restoreFocus) prev?.focus?.({ preventScroll: true });
    };
  }, [active, ref, trap, lock, autoFocus, restoreFocus]);
}
