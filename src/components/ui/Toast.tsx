"use client";
// Toast xếp chồng: Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070
// Port sang React: CSS gốc ở ../lucian/lucian-070.css; logic xếp chồng/xòe khi hover/vuốt bỏ/đếm ngược viết lại bằng state + ref, dọn rAF/timer khi unmount.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../lucian/lucian-070.css";
import { useIsClient } from "./Modal";

export type ToastKind = "success" | "error" | "info" | "warning" | "loading";
export type ToastOptions = {
  title: string;
  description?: string;
  kind?: ToastKind;
  /** ms trước khi tự tắt (mặc định 4500; lỗi 7000; loading không tự tắt) */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type Item = Required<Pick<ToastOptions, "title" | "kind">> & Pick<ToastOptions, "description" | "action" | "duration"> & { id: string; leaving?: boolean; dir?: 1 | -1 };

type Api = {
  toast: (o: ToastOptions | string) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  /** Toast "đang xử lý" quay vòng, tắt khi `update`/`dismiss` */
  loading: (title: string, description?: string) => string;
  update: (id: string, patch: Partial<ToastOptions>) => void;
  dismiss: (id: string) => void;
  /** Gắn toast với một Promise: đang xử lý → thành công/lỗi */
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }) => Promise<T>;
};

const ToastCtx = createContext<Api | null>(null);

export function useToast(): Api {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast phải nằm trong <ToastProvider>");
  return c;
}

const COLOR: Record<ToastKind, string> = {
  success: "var(--ux-mint)",
  error: "var(--ux-danger)",
  info: "var(--ux-accent)",
  warning: "var(--ux-warn)",
  loading: "var(--ux-warn)",
};
const DEFAULT_MS: Record<ToastKind, number> = { success: 4500, error: 7000, info: 4500, warning: 6000, loading: Infinity };

function Icon({ kind }: { kind: ToastKind }) {
  if (kind === "loading") return <i />;
  const d = kind === "success" ? "M4 9.4l3.2 3.2L14 5.6" : kind === "info" ? "M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z" : "M9 5v5M9 13h.01";
  return (
    <svg viewBox="0 0 18 18">
      <path d={d} />
    </svg>
  );
}

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const client = useIsClient();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const els = useRef(new Map<string, HTMLDivElement>());
  const left = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const live = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const openRef = useRef(open);
  openRef.current = open;

  const remove = useCallback((id: string, dir?: 1 | -1) => {
    setItems((l) => l.map((t) => (t.id === id ? { ...t, leaving: true, dir } : t)));
    const t = setTimeout(() => {
      timers.current.delete(t);
      left.current.delete(id);
      setItems((l) => l.filter((x) => x.id !== id));
    }, 450);
    timers.current.add(t);
  }, []);

  const push = useCallback((o: ToastOptions | string) => {
    const opt: ToastOptions = typeof o === "string" ? { title: o } : o;
    const kind = opt.kind ?? "info";
    const id = `t${++seq}`;
    left.current.set(id, opt.duration ?? DEFAULT_MS[kind]);
    setItems((l) => [{ id, kind, title: opt.title, description: opt.description, action: opt.action, duration: opt.duration }, ...l].slice(0, 6));
    return id;
  }, []);

  const update = useCallback((id: string, patch: Partial<ToastOptions>) => {
    setItems((l) =>
      l.map((t) => {
        if (t.id !== id) return t;
        const kind = patch.kind ?? t.kind;
        left.current.set(id, patch.duration ?? DEFAULT_MS[kind]);
        return { ...t, ...patch, kind };
      }),
    );
  }, []);

  const api = useMemo<Api>(() => {
    const mk = (kind: ToastKind) => (title: string, description?: string) => push({ kind, title, description });
    return {
      toast: push,
      success: mk("success"),
      error: mk("error"),
      info: mk("info"),
      warning: mk("warning"),
      loading: mk("loading"),
      update,
      dismiss: (id) => remove(id),
      promise: async (p, m) => {
        const id = push({ kind: "loading", title: m.loading });
        try {
          const v = await p;
          update(id, { kind: "success", title: typeof m.success === "function" ? m.success(v) : m.success });
          return v;
        } catch (e) {
          update(id, { kind: "error", title: typeof m.error === "function" ? m.error(e) : m.error });
          throw e;
        }
      },
    };
  }, [push, update, remove]);

  // Xếp chồng: toast mới ở trước, cũ lùi + thu nhỏ; xòe thành danh sách khi hover/focus
  useLayoutEffect(() => {
    let acc = 0;
    const visible = items.filter((t) => !t.leaving);
    items.forEach((t) => {
      const el = els.current.get(t.id);
      if (!el) return;
      if (el.classList.contains("enter")) {
        void el.offsetWidth; // ép tính bố cục để hoạt ảnh vào chạy
        el.classList.remove("enter");
      }
      el.style.setProperty("--c", COLOR[t.kind]);
      const i = visible.indexOf(t);
      if (i < 0) return; // đang rời: giữ nguyên vị trí cuối
      if (open) {
        el.style.setProperty("--y", `${-acc}px`);
        el.style.setProperty("--s", "1");
        el.style.setProperty("--o", "1");
        acc += el.offsetHeight + 8;
      } else {
        el.style.setProperty("--y", `${-(i * 14)}px`);
        el.style.setProperty("--s", (1 - i * 0.06).toFixed(2));
        el.style.setProperty("--o", i > 2 ? "0" : "1");
      }
      el.style.zIndex = String(50 - i);
      el.inert = !open && i > 0;
    });
  }, [items, open]);

  // Đếm ngược tự tắt cho toast ở trước (dừng khi xòe)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (!openRef.current) {
        const front = itemsRef.current.find((t) => !t.leaving);
        if (front) {
          const cur = left.current.get(front.id) ?? Infinity;
          if (cur !== Infinity) {
            const nxt = cur - dt;
            left.current.set(front.id, nxt);
            const total = front.duration ?? DEFAULT_MS[front.kind];
            els.current.get(front.id)?.style.setProperty("--left", Math.max(0, nxt / total).toFixed(3));
            if (nxt <= 0) remove(front.id);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [remove]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const front = items.find((t) => !t.leaving);
    if (live.current) live.current.textContent = front ? front.title : "";
  }, [items]);

  // Thu lại khi hết toast
  useEffect(() => {
    if (items.length === 0) setOpen(false);
  }, [items.length]);

  const swipe = useRef<{ id: string; x: number; dx: number } | null>(null);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {client &&
        createPortal(
          <div
            ref={zone}
            className="ux u070-zone"
            role="region"
            aria-label="Thông báo"
            tabIndex={-1}
            onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && !zone.current?.contains(document.activeElement) && setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={(e) => {
              if (!zone.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
            }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("button") && items.length > 1) setOpen((o) => !o);
            }}
          >
            <div className="u070-live" aria-live="polite" ref={live} />
            {items.map((t) => (
              <div
                key={t.id}
                ref={(el) => {
                  if (el) {
                    if (!seen.current.has(t.id)) {
                      seen.current.add(t.id);
                      el.classList.add("enter");
                    }
                    els.current.set(t.id, el);
                  } else els.current.delete(t.id);
                }}
                className={["u070-t", t.leaving ? "leave" : "", t.leaving && t.dir ? "side" : "", !open && items.filter((x) => !x.leaving).indexOf(t) > 0 ? "back" : ""].filter(Boolean).join(" ")}
                style={t.dir ? ({ "--dir": t.dir } as CSSProperties) : undefined}
                role={t.kind === "error" ? "alert" : "status"}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  swipe.current = { id: t.id, x: e.clientX, dx: 0 };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  e.currentTarget.classList.add("drag");
                }}
                onPointerMove={(e) => {
                  const s = swipe.current;
                  if (!s || s.id !== t.id) return;
                  s.dx = e.clientX - s.x;
                  e.currentTarget.style.setProperty("--dx", `${s.dx}px`);
                  e.currentTarget.style.setProperty("--o", String(Math.max(0.2, 1 - Math.abs(s.dx) / 260)));
                }}
                onPointerUp={(e) => {
                  const s = swipe.current;
                  if (!s || s.id !== t.id) return;
                  swipe.current = null;
                  e.currentTarget.classList.remove("drag");
                  if (Math.abs(s.dx) > 90) remove(t.id, s.dx > 0 ? 1 : -1);
                  else {
                    e.currentTarget.style.setProperty("--dx", "0px");
                    e.currentTarget.style.setProperty("--o", "1");
                  }
                }}
                onPointerCancel={(e) => {
                  swipe.current = null;
                  e.currentTarget.classList.remove("drag");
                  e.currentTarget.style.setProperty("--dx", "0px");
                }}
              >
                <span className="u070-ic" aria-hidden="true">
                  <Icon kind={t.kind} />
                </span>
                <span className="u070-tx">
                  <b>{t.title}</b>
                  {t.description && <small>{t.description}</small>}
                </span>
                {t.action && (
                  <button
                    className="u070-act"
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      remove(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button className="u070-x" type="button" aria-label="Đóng thông báo" onClick={() => remove(t.id)}>
                  <svg viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
                  </svg>
                </button>
                <span className="u070-bar" aria-hidden="true" />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
