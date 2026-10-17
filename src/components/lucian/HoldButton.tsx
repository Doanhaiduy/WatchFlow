"use client";
// Lucian UX/UI Prompt #003 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#003
// Nút giữ-để-xác-nhận: màu đỏ đổ đầy khi giữ (chuột, cảm ứng, phím cách/Enter), thả sớm thì lùi về. Dùng cho thao tác nguy hiểm.
import { Trash2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import "./lucian-003.css";

type Props = { label: string; onConfirm: () => void; disabled?: boolean; holdMs?: number; icon?: ReactNode };

export function HoldButton({ label, onConfirm, disabled, holdMs = 1200, icon }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const st = useRef({ p: 0, raf: 0, last: 0, holding: false, done: false });
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;
  const rm = useRef(false);

  useEffect(() => {
    rm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = st.current;
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const set = (v: number) => {
    st.current.p = v;
    btn.current?.style.setProperty("--p", v.toFixed(4));
  };
  const tick = (now: number) => {
    const s = st.current;
    const dt = now - (s.last || now);
    s.last = now;
    set(s.holding ? Math.min(1, s.p + dt / holdMs) : Math.max(0, s.p - dt / (holdMs / 2.4)));
    btn.current?.style.setProperty("--shake", s.holding && s.p > 0.55 && !rm.current ? "running" : "paused");
    if (s.p >= 1 && s.holding) {
      s.holding = false;
      s.done = true;
      s.raf = 0;
      btn.current?.classList.remove("is-holding");
      confirmRef.current();
      setTimeout(() => {
        s.done = false;
        set(0);
      }, 600);
      return;
    }
    if (s.holding || s.p > 0) s.raf = requestAnimationFrame(tick);
    else {
      s.raf = 0;
      s.last = 0;
    }
  };
  const start = () => {
    const s = st.current;
    if (s.done || disabled) return;
    s.holding = true;
    btn.current?.classList.add("is-holding");
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(tick);
    }
  };
  const stop = () => {
    const s = st.current;
    s.holding = false;
    btn.current?.classList.remove("is-holding");
    if (!s.raf && s.p > 0) s.raf = requestAnimationFrame(tick);
  };

  const ic = icon ?? <Trash2 size={20} aria-hidden="true" />;
  const text = `Giữ để ${label.toLowerCase()}`;
  return (
    <div className="ux u003-row">
      <button
        ref={btn}
        className="u003-btn"
        type="button"
        disabled={disabled}
        aria-label={text}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) start();
          }
        }}
        onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
        onBlur={stop}
        onClick={(e) => e.preventDefault()}
      >
        <span className="u003-lab">
          {ic}
          {text}
        </span>
        <span className="u003-lab u003-fill" aria-hidden="true">
          {ic}
          {text}
        </span>
      </button>
    </div>
  );
}
