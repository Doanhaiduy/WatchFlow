"use client";
// Hoạt ảnh núm giãn khi trượt: Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047
// (phần công tắc phân đoạn; lấy CSS gốc từ ../lucian/lucian-047.css, mặc áo Glass bằng .wf-seg). Xem sổ ui-design-system §9.
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import "../lucian/lucian-047.css";
import { cx } from "./cx";

export type SegmentOption<T extends string = string> = { value: T; label: string; disabled?: boolean };

type Props<T extends string> = {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (v: T) => void;
  /** Nhãn đọc màn hình, vd. "Kỳ báo cáo" */
  ariaLabel: string;
  /** "radio" (mặc định: chọn một giá trị) hoặc "tabs" (đổi tab — nhớ gắn aria-controls ở nơi dùng) */
  mode?: "radio" | "tabs";
  className?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, mode = "radio", className }: Props<T>) {
  const segRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const optRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const prevIdx = useRef(-1);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const place = () => {
    const seg = segRef.current, knob = knobRef.current, o = optRefs.current[idx];
    if (!seg || !knob || !o) return;
    knob.style.setProperty("--l", `${o.offsetLeft}px`);
    knob.style.setProperty("--r", `${seg.clientWidth - o.offsetLeft - o.offsetWidth}px`);
  };

  useLayoutEffect(() => {
    const seg = segRef.current;
    if (seg) {
      const dir = prevIdx.current < 0 ? 0 : idx > prevIdx.current ? 1 : idx < prevIdx.current ? -1 : 0;
      seg.classList.toggle("go-r", dir > 0);
      seg.classList.toggle("go-l", dir < 0);
    }
    prevIdx.current = idx;
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, options.length]);

  useEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const ro = new ResizeObserver(place);
    ro.observe(seg);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = options.length;
    for (let k = 1; k <= n; k++) {
      const j = (i + d * k + n * k) % n;
      const o = options[j];
      if (o && !o.disabled) {
        onChange(o.value);
        optRefs.current[j]?.focus();
        return;
      }
    }
  };

  const tabs = mode === "tabs";
  return (
    <div
      ref={segRef}
      className={cx("u047-seg wf-seg ux", className)}
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
    >
      <span ref={knobRef} className="u047-knob" aria-hidden="true" />
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              optRefs.current[i] = el;
            }}
            type="button"
            className="u047-opt"
            role={tabs ? "tab" : "radio"}
            {...(tabs ? { "aria-selected": on } : { "aria-checked": on })}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
