"use client";
// Lucian UX/UI Prompt #018 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#018
// Bộ chỉnh số lượng: số lăn như đồng hồ km; ngoài khoảng cho phép thì rung. Bản WatchFlow hỗ trợ số âm (điều chỉnh giảm tồn).
import { useRef, useState, type KeyboardEvent } from "react";
import "./lucian-018.css";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Nhãn đọc màn hình, vd. "Số lượng điều chỉnh" */
  ariaLabel: string;
  /** Có ⇒ hiện dấu +/− trước số (dùng cho độ lệch) */
  signed?: boolean;
};

const H = 34;
const digits = Array.from({ length: 10 }, (_, d) => d);

export function QuantityStepper({ value, onChange, min = 0, max = 99, ariaLabel, signed }: Props) {
  const [shake, setShake] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const abs = Math.min(99, Math.abs(value));
  const tens = Math.floor(abs / 10);
  const ones = abs % 10;

  const bump = (d: number) => {
    const n = value + d;
    if (n < min || n > max) {
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      return;
    }
    onChange(n);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") (e.preventDefault(), bump(1));
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") (e.preventDefault(), bump(-1));
  };

  return (
    <div className="ux u018">
      <div ref={ref} className={`u018-step${shake ? " is-shake" : ""}`} role="group" aria-label={ariaLabel} onKeyDown={key} onAnimationEnd={() => setShake(false)}>
        <button className="u018-b mi" type="button" aria-label="Giảm một" aria-disabled={value <= min} onClick={() => bump(-1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 10h10" />
          </svg>
        </button>
        <span className="u018-num" aria-live="polite" aria-atomic="true">
          <span className="u018-sr">{`${signed && value > 0 ? "+" : ""}${value}`}</span>
          {signed && (
            <span aria-hidden="true" style={{ width: 16, textAlign: "center", opacity: value === 0 ? 0.4 : 1 }}>
              {value < 0 ? "−" : value > 0 ? "+" : ""}
            </span>
          )}
          <span className={`u018-col${tens === 0 ? " is-hide" : ""}`} aria-hidden="true" style={{ width: 17, transform: `translateY(${-tens * H}px)` }}>
            {digits.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
          <span className="u018-col" aria-hidden="true" style={{ width: 17, transform: `translateY(${-ones * H}px)` }}>
            {digits.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
        <button className="u018-b pl" type="button" aria-label="Tăng một" aria-disabled={value >= max} onClick={() => bump(1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 5v10M5 10h10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
