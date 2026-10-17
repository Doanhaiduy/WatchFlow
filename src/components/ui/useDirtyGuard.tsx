"use client";
// Bảo vệ TRANG/biểu mẫu dài khi còn thay đổi chưa lưu (khác `dirty` của Modal — lớp phủ):
//   1. đóng tab / tải lại ⇒ trình duyệt hỏi (beforeunload);
//   2. bấm liên kết nội bộ (menu, dock, <Link>, nút "Quay lại" của ứng dụng qua `guardedNavigate`) ⇒ hộp "Bỏ thay đổi chưa lưu?" (Ở lại / Bỏ thay đổi).
// Giới hạn đã biết (App Router không có router.events): `router.push()` gọi trong mã và nút Back/vuốt Back của trình duyệt KHÔNG chặn được;
// chỉ beforeunload còn tác dụng với tải lại. Vì vậy biểu mẫu quan trọng nên tự lưu nháp (POS, phiếu nhập đã làm).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DiscardConfirm, useBeforeUnload } from "./CloseGuard";

type Guard = { ask: (go: () => void) => void };
const active = new Set<Guard>();

/** Dùng cho điều hướng bằng nút (không phải <a>): nếu có biểu mẫu đang sửa dở thì hỏi trước, không thì đi luôn */
export function guardedNavigate(go: () => void): void {
  const g = [...active].pop();
  if (g) g.ask(go);
  else go();
}

/** Thuộc tính `data-allow-leave` trên liên kết ⇒ không chặn (vd. liên kết "Xem phiếu" sau khi đã lưu) */
export function useDirtyGuard(dirty: boolean): { dialog: ReactNode; release: () => void } {
  const router = useRouter();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const released = useRef(false);
  useBeforeUnload(dirty, released);

  useEffect(() => {
    if (!dirty) {
      setPending(null);
      return;
    }
    released.current = false;
    const me: Guard = { ask: (go) => setPending(() => go) };
    active.add(me);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || a.hasAttribute("data-allow-leave")) return;
      if (a.target && a.target !== "_self") return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // cùng trang / chỉ đổi #
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener("click", onClick, true);
    return () => {
      active.delete(me);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, router]);

  const dialog = (
    <DiscardConfirm
      open={pending !== null}
      onStay={() => setPending(null)}
      onDiscard={() => {
        const go = pending;
        setPending(null);
        released.current = true; // đi tiếp: không bắt beforeunload lần nữa (vd. go() là điều hướng cứng)
        go?.();
      }}
    />
  );
  return {
    dialog,
    /** Gọi ngay trước khi tự điều hướng cứng (window.location.assign) sau khi đã lưu xong */
    release: () => {
      released.current = true;
    },
  };
}
