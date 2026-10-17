"use client";
// Lucian UX/UI Prompt #305 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#305
// Ngăn kéo lọc có đếm kết quả sống: nút Lọc + huy hiệu, chip bộ lọc đang áp dụng, nút "Xem N kết quả" với số lăn.
// Ngăn kéo dùng Modal Glass (trượt từ đáy trên mobile, hộp giữa trên desktop).
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Modal } from "../ui/Modal";
import "./lucian-305.css";

export function FilterButton({ count, onClick, expanded }: { count: number; onClick: () => void; expanded: boolean }) {
  return (
    <span className="ux" style={{ display: "inline-flex" }}>
      <button type="button" className="u305-fb" aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick}>
        <SlidersHorizontal size={14} aria-hidden="true" />
        Lọc
        <i className={count > 0 ? "is-on" : ""} aria-label={count > 0 ? `${count} bộ lọc đang bật` : undefined}>
          {count > 0 ? count : ""}
        </i>
      </button>
    </span>
  );
}

export function ActiveFilterChips({ chips }: { chips: Array<{ id: string; label: string; onRemove: () => void }> }) {
  if (chips.length === 0) return null;
  return (
    <div className="ux u305-ac" role="group" aria-label="Bộ lọc đang áp dụng" style={{ marginBottom: 10 }}>
      {chips.map((c) => (
        <button key={c.id} type="button" aria-label={`${c.label} — bỏ bộ lọc`} onClick={c.onRemove}>
          {c.label}
          <X size={11} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ux" style={{ marginBottom: 6 }}>
      <h3 className="u305-h5">{title}</h3>
      {children}
    </section>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  /** Số kết quả nếu áp dụng bộ lọc nháp (null = đang tính) */
  resultCount: number | null;
  title?: string;
  children: ReactNode;
};

export function FilterDrawer({ open, onClose, onReset, onApply, resultCount, title = "Bộ lọc", children }: Props) {
  const last = useRef<number | null>(null);
  const roll = resultCount !== null && last.current !== null && last.current !== resultCount;
  useEffect(() => {
    if (resultCount !== null) last.current = resultCount;
  }, [resultCount]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="ux" style={{ display: "flex", gap: 10, width: "100%" }}>
          <button type="button" className="u305-rs" onClick={onReset}>
            Đặt lại
          </button>
          <button type="button" className="wf-btn wf-btn-pri" style={{ flex: 1 }} disabled={resultCount === 0} onClick={onApply}>
            {resultCount === null ? (
              "Đang đếm…"
            ) : resultCount === 0 ? (
              "Không có kết quả"
            ) : (
              <span className="u305-ap" style={{ all: "unset" }}>
                Xem{" "}
                <b key={resultCount} className={roll ? "is-roll" : ""} style={{ display: "inline-block", margin: "0 3px", fontVariantNumeric: "tabular-nums" }}>
                  {resultCount}
                </b>{" "}
                kết quả
              </span>
            )}
          </button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
