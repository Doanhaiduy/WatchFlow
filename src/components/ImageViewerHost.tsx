"use client";
// Trình xem ảnh toàn màn hình (port từ Lưu Xá ImageViewerHost): lăn chuột / chụm hai ngón phóng to quanh điểm chạm, kéo để di chuyển khi đã phóng,
// bấm đúp phóng/thu, vuốt ngang sang ảnh khác (khi chưa phóng), vuốt xuống để đóng; phím Esc, ← →, + − 0. Style: components/image-viewer.css (token Glass).
import { ChevronLeft, ChevronRight, Download, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { IMAGE_VIEWER_EVENT, type ViewerImage } from "@/lib/image-viewer";
import "./image-viewer.css";

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface View {
  scale: number;
  x: number;
  y: number;
  rot: number;
}
const HOME: View = { scale: 1, x: 0, y: 0, rot: 0 };

function Viewer({ images, start, onClose }: { images: ViewerImage[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [view, setView] = useState<View>(HOME);
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: "none" | "pan" | "pinch"; v0: View; p0: { x: number; y: number }; dist0: number; t0: number; moved: boolean }>({
    mode: "none",
    v0: HOME,
    p0: { x: 0, y: 0 },
    dist0: 1,
    t0: 0,
    moved: false,
  });
  const img: ViewerImage = images[index] ?? images[0] ?? { src: "" };
  const many = images.length > 1;

  const go = useCallback(
    (d: number) => {
      setIndex((i) => {
        const n = i + d;
        return n < 0 || n >= images.length ? i : n;
      });
      setView(HOME);
      setFailed(false);
    },
    [images.length],
  );

  // Ảnh nét hơn (nếu có): nạp ngầm rồi thay vào
  useEffect(() => {
    setFull(null);
    if (!img.fullSrc || img.fullSrc === img.src) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => !cancelled && setFull(img.fullSrc!);
    probe.src = img.fullSrc;
    return () => {
      cancelled = true;
    };
  }, [img.src, img.fullSrc]);

  /** Phóng/thu quanh một điểm màn hình (mặc định: tâm khung). */
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = (px ?? r.left + r.width / 2) - (r.left + r.width / 2);
    const cy = (py ?? r.top + r.height / 2) - (r.top + r.height / 2);
    setView((v) => {
      const s = clamp(v.scale * factor, MIN, MAX);
      if (s === MIN) return { ...v, scale: MIN, x: 0, y: 0 };
      const k = s / v.scale;
      return { ...v, scale: s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);
  const zoomBy = useCallback((f: number) => zoomAt(f), [zoomAt]);

  // Khóa cuộn nền, nhận focus, trả focus khi đóng; bàn phím bắt ở pha capture để hộp thoại phía sau không đóng theo phím Esc
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" && root.current) {
        const items = [...root.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
        if (!items.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const a = document.activeElement;
        if (e.shiftKey && (a === first || !root.current.contains(a))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (a === last || !root.current.contains(a))) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (!["Escape", "ArrowLeft", "ArrowRight", "+", "=", "-", "_", "0"].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.4);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.4);
      else setView((v) => ({ ...HOME, rot: v.rot }));
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      prevFocus?.focus?.();
    };
  }, [onClose, go, zoomBy]);

  // lăn chuột (listener không-passive để chặn cuộn trang)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-viewer-ui]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.v0 = view;
    g.t0 = Date.now();
    g.moved = false;
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      g.mode = "pinch";
      g.dist0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.p0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else {
      g.mode = "pan";
      g.p0 = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clamp(g.v0.scale * (dist / g.dist0), MIN, MAX);
      // điểm ảnh nằm dưới ngón tay lúc bắt đầu phải ở dưới điểm giữa hiện tại
      const cx0 = g.p0.x - (r.left + r.width / 2);
      const cy0 = g.p0.y - (r.top + r.height / 2);
      const qx = (cx0 - g.v0.x) / g.v0.scale;
      const qy = (cy0 - g.v0.y) / g.v0.scale;
      const cx = mid.x - (r.left + r.width / 2);
      const cy = mid.y - (r.top + r.height / 2);
      g.moved = true;
      setView({ ...g.v0, scale: s, x: s === MIN ? 0 : cx - qx * s, y: s === MIN ? 0 : cy - qy * s });
    } else if (g.mode === "pan") {
      const dx = e.clientX - g.p0.x;
      const dy = e.clientY - g.p0.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) g.moved = true;
      if (g.v0.scale > 1) {
        const lim = Math.max(r.width, r.height) * g.v0.scale;
        setView({ ...g.v0, x: clamp(g.v0.x + dx, -lim, lim), y: clamp(g.v0.y + dy, -lim, lim) });
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    const startP = g.p0;
    const was = g.mode;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // từ chụm còn một ngón ⇒ tiếp tục kéo từ vị trí hiện tại
      const [p] = [...pointers.current.values()] as [{ x: number; y: number }];
      g.mode = "pan";
      g.p0 = { x: p.x, y: p.y };
      g.v0 = view;
      return;
    }
    if (pointers.current.size > 0) return;
    g.mode = "none";
    setDragging(false);
    if (was !== "pan") return;
    const dx = e.clientX - startP.x;
    const dy = e.clientY - startP.y;
    const fast = Date.now() - g.t0 < 600;
    if (view.scale <= 1.02) {
      if (many && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) return go(dx < 0 ? 1 : -1);
      if (dy > 110 && dy > Math.abs(dx) * 1.5 && fast) return onClose();
    }
    // chạm (không kéo) vào vùng nền quanh ảnh ⇒ đóng
    if (!g.moved && (e.target as HTMLElement).dataset.viewerStage !== undefined && view.scale <= 1.02) onClose();
  };

  const onDoubleClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-viewer-ui]")) return;
    if (view.scale > 1.05) setView((v) => ({ ...HOME, rot: v.rot }));
    else zoomAt(2.6 / view.scale, e.clientX, e.clientY);
  };

  const shown = full ?? img.src;
  return (
    <div ref={root} className="wf-iv" role="dialog" aria-modal="true" aria-label={img.alt || "Xem ảnh"}>
      <div data-viewer-ui className="wf-iv-top">
        <div className="wf-iv-title">
          <b>{img.alt || "Ảnh"}</b>
          <small>
            {many ? `${index + 1}/${images.length} · ` : ""}
            {Math.round(view.scale * 100)}%
          </small>
        </div>
        <div className="wf-iv-tools">
          <button type="button" className="wf-iv-btn" onClick={() => zoomBy(1 / 1.4)} disabled={view.scale <= MIN} aria-label="Thu nhỏ" title="Thu nhỏ (−)">
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <button type="button" className="wf-iv-btn" onClick={() => zoomBy(1.4)} disabled={view.scale >= MAX} aria-label="Phóng to" title="Phóng to (+)">
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          <button type="button" className="wf-iv-btn" onClick={() => setView((v) => ({ ...v, rot: (v.rot + 90) % 360 }))} aria-label="Xoay ảnh" title="Xoay 90°">
            <RotateCw size={18} aria-hidden="true" />
          </button>
          <a href={img.downloadUrl ?? img.fullSrc ?? img.src} download={img.downloadName ?? ""} className="wf-iv-btn" aria-label="Tải ảnh về" title="Tải về">
            <Download size={18} aria-hidden="true" />
          </a>
          <button ref={closeBtn} type="button" className="wf-iv-btn" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={stage}
        data-viewer-stage
        className="wf-iv-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ cursor: view.scale > 1 ? "grab" : "zoom-in" }}
      >
        <img
          key={index}
          src={shown}
          alt={img.alt ?? ""}
          draggable={false}
          onError={() => setFailed(true)}
          className={`wf-iv-img${dragging ? " dragging" : ""}`}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${view.rot}deg)` }}
        />
        {failed && <div className="wf-iv-err">Không tải được ảnh.</div>}
        {many && (
          <>
            <button type="button" data-viewer-ui className="wf-iv-btn wf-iv-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Ảnh trước">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" data-viewer-ui className="wf-iv-btn wf-iv-nav next" onClick={() => go(1)} disabled={index === images.length - 1} aria-label="Ảnh sau">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {img.caption && (
        <p data-viewer-ui className="wf-iv-cap">
          {img.caption}
        </p>
      )}
    </div>
  );
}

export function ImageViewerHost() {
  const [state, setState] = useState<{ images: ViewerImage[]; index: number } | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ images: ViewerImage[]; index: number }>).detail;
      if (d?.images?.length) setState({ images: d.images, index: d.index ?? 0 });
    };
    window.addEventListener(IMAGE_VIEWER_EVENT, onOpen);
    return () => window.removeEventListener(IMAGE_VIEWER_EVENT, onOpen);
  }, []);
  const close = useCallback(() => setState(null), []);
  if (!state || typeof document === "undefined") return null;
  return createPortal(<Viewer images={state.images} start={state.index} onClose={close} />, document.body);
}
