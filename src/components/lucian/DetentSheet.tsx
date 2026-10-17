"use client";
// Lucian UX/UI Prompt #336 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#336
// Tờ trượt từ đáy 3 nấc (đóng · nửa · đầy) kéo bằng ngón tay, thả có quán tính + lò xo. Dùng cho giỏ phiếu bán (mobile).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BusyVeil, useBusyFocus, useCloseGuard } from "../ui/CloseGuard";
import { useOverlayBehavior } from "../ui/overlay";
import "./lucian-336.css";

export type Detent = 0 | 1 | 2; // 0 đóng, 1 nửa, 2 đầy

type Props = {
  detent: Detent;
  onDetent: (d: Detent) => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Có thay đổi chưa lưu: thu tờ về mức đóng (bấm nền/Esc/vuốt xuống) hỏi "Bỏ thay đổi chưa lưu?"; vuốt xuống thì tờ bật về mức cũ */
  dirty?: boolean;
  /** Đang xử lý: chặn thu tờ + thao tác bên trong, phủ lớp "Đang xử lý…" */
  busy?: boolean;
};

const pos = (vh: number) => [vh + 8, Math.round(vh * 0.46), Math.round(vh * 0.07)] as const; // translateY của từng nấc

export function DetentSheet({ detent, onDetent, title, subtitle, children, footer, dirty, busy }: Props) {
  const sh = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(800);
  const s = useRef({ y: 0, vy: 0, target: 0, raf: 0, last: 0, on: false, sy: 0, y0: 0, moved: false, hist: [] as Array<[number, number]>, dragEnd: 0, vh: 800 });
  const rm = useRef(false);
  // Bảo vệ: thu về 0 khi dirty/busy phải qua cổng đóng (hỏi / chặn); đổi giữa nửa ↔ đầy không cần hỏi
  const guard = useCloseGuard({ dirty, busy, open: detent > 0, onClose: () => onDetent(0) });
  const guardRef = useRef({ on: false, request: guard.request });
  guardRef.current = { on: !!dirty || !!busy, request: guard.request };
  const detRef = useRef(detent);
  detRef.current = detent;
  const setDetent = (d: Detent) => {
    if (d === 0 && detRef.current !== 0 && guardRef.current.on) guardRef.current.request();
    else onDetent(d);
  };
  const cb = useRef(setDetent);
  cb.current = setDetent;
  // Cùng hành vi với mọi lớp phủ: Esc thu tờ lại, bẫy focus, khóa cuộn nền, trả focus khi đóng
  useOverlayBehavior(sh, detent > 0, () => setDetent(0));
  useBusyFocus(busy, sh);

  const paint = () => {
    const el = sh.current;
    if (!el) return;
    const P = pos(s.current.vh);
    el.style.transform = `translateY(${s.current.y.toFixed(1)}px)`;
    const hid = Math.max(0, s.current.y - P[2]);
    body.current?.style.setProperty("padding-bottom", `${hid + 16 + (foot.current?.offsetHeight ?? 0)}px`);
    // Chân (nút chính) luôn nằm trong phần nhìn thấy dù tấm đang ở mức nửa
    if (foot.current) foot.current.style.transform = hid ? `translateY(${(-hid).toFixed(1)}px)` : "";
  };
  const step = (now: number) => {
    const c = s.current;
    c.raf = 0;
    const dt = Math.min(0.032, Math.max(0, (now - c.last) / 1000));
    c.last = now;
    c.vy += (-320 * (c.y - c.target) - 25 * c.vy) * dt;
    c.y += c.vy * dt;
    if (Math.abs(c.y - c.target) < 0.3 && Math.abs(c.vy) < 6) {
      c.y = c.target;
      c.vy = 0;
      paint();
      return;
    }
    paint();
    c.raf = requestAnimationFrame(step);
  };
  const run = () => {
    const c = s.current;
    if (rm.current) {
      c.y = c.target;
      c.vy = 0;
      paint();
      return;
    }
    if (!c.raf) {
      c.last = performance.now();
      c.raf = requestAnimationFrame(step);
    }
  };

  useEffect(() => {
    rm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const on = () => {
      s.current.vh = window.innerHeight;
      setVh(window.innerHeight);
    };
    on();
    s.current.y = pos(window.innerHeight)[0];
    paint();
    window.addEventListener("resize", on);
    const c = s.current;
    return () => {
      window.removeEventListener("resize", on);
      cancelAnimationFrame(c.raf);
      c.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    s.current.target = pos(vh)[detent];
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, vh]);

  const band = (v: number) => {
    const P = pos(s.current.vh);
    return v < P[2] ? P[2] - (P[2] - v) * 0.25 : v;
  };
  const up = () => {
    const c = s.current;
    if (!c.on) return;
    c.on = false;
    if (!c.moved) return;
    c.dragEnd = performance.now();
    const a = c.hist[0]!, b = c.hist[c.hist.length - 1]!;
    const dt = (b[0] - a[0]) / 1000;
    c.vy = dt > 0.001 ? (b[1] - a[1]) / dt : 0;
    const proj = c.y + c.vy * 0.2;
    const P = pos(c.vh);
    let best: Detent = 0;
    ([0, 1, 2] as const).forEach((i) => {
      if (Math.abs(P[i] - proj) < Math.abs(P[best] - proj)) best = i;
    });
    // dirty/busy: vuốt xuống tới mức đóng thì bật về mức cũ (và hỏi nếu dirty)
    if (best === 0 && guardRef.current.on && detRef.current > 0) {
      guardRef.current.request();
      best = detRef.current as Detent;
    }
    c.target = P[best];
    run();
    cb.current(best);
  };

  const P = pos(vh);
  return (
    <>
      <div className="wf-sheet-dim" style={{ opacity: detent === 0 ? 0 : detent === 1 ? 0.25 : 0.4, pointerEvents: detent === 0 ? "none" : "auto" }} onClick={() => setDetent(0)} aria-hidden="true" />
      <section
        ref={sh}
        className="ux wf-detent g"
        role="dialog"
        aria-label={title}
        aria-hidden={detent === 0}
        aria-busy={busy || undefined}
        {...(detent === 0 ? ({ inert: true } as object) : {})}
        style={{ height: vh - P[2], transform: `translateY(${P[0]}px)` }}
      >
        <div
          className="u336-hd"
          style={{ touchAction: "none" }}
          inert={busy || undefined}
          onPointerDown={(e) => {
            const c = s.current;
            c.on = true;
            c.moved = false;
            c.sy = e.clientY;
            c.y0 = c.y;
            c.vy = 0;
            c.hist = [[performance.now(), c.y]];
            cancelAnimationFrame(c.raf);
            c.raf = 0;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => {
            const c = s.current;
            if (!c.on) return;
            const raw = c.y0 + (e.clientY - c.sy);
            if (Math.abs(raw - c.y0) > 4) c.moved = true;
            c.y = band(raw);
            paint();
            c.hist.push([performance.now(), c.y]);
            if (c.hist.length > 6) c.hist.shift();
          }}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <button
            className="u336-gr"
            type="button"
            aria-label={`Đổi độ cao tờ, hiện ${["đóng", "nửa màn hình", "toàn màn hình"][detent]}`}
            onClick={() => {
              if (performance.now() - s.current.dragEnd >= 350) setDetent(detent === 2 ? 1 : 2);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setDetent(Math.min(2, detent + 1) as Detent);
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setDetent(Math.max(0, detent - 1) as Detent);
              }
            }}
          />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingTop: 14 }}>
            <b style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.03em" }}>{title}</b>
            <span className="wf-mute" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {subtitle}
            </span>
          </div>
        </div>
        <div ref={body} className="wf-detent-body" inert={busy || undefined}>
          {children}
        </div>
        {footer && <div className="wf-detent-foot" ref={foot} inert={busy || undefined}>{footer}</div>}
        {busy && <BusyVeil inline />}
      </section>
      {guard.dialog}
    </>
  );
}
