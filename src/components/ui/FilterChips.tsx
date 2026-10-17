"use client";
import { useEffect, useRef } from "react";
import { cx } from "./cx";

export type ChipOption = { value: string; label: string; count?: number };

type Props = {
  options: ReadonlyArray<ChipOption>;
  /** Các giá trị đang chọn */
  value: string[];
  onChange: (v: string[]) => void;
  /** Cho chọn nhiều chip cùng lúc (mặc định chỉ một; bấm lại chip đang chọn để bỏ chọn) */
  multiple?: boolean;
  ariaLabel: string;
  className?: string;
};

/** `.g-chips` — hàng chip cuộn ngang, chip chọn nền tím. Dùng lọc trạng thái. */
export function FilterChips({ options, value, onChange, multiple, ariaLabel, className }: Props) {
  const toggle = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(value.includes(v) ? [] : [v]);
  };
  // Chip đang chọn nằm ngoài vùng nhìn (hàng cuộn ngang trên điện thoại) ⇒ cuộn tới nó, chỉ trong hàng chip
  const row = useRef<HTMLDivElement>(null);
  const first = value[0];
  useEffect(() => {
    const el = row.current;
    const btn = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !btn) return;
    const l = btn.offsetLeft - el.offsetLeft, r = l + btn.offsetWidth;
    if (l < el.scrollLeft || r > el.scrollLeft + el.clientWidth) {
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: Math.max(0, l - 16), behavior: reduce ? "auto" : "smooth" });
    }
  }, [first]);
  return (
    <div ref={row} className={cx("wf-chips", className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className="wf-chipb" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
          {o.count !== undefined && <small>{o.count}</small>}
        </button>
      ))}
    </div>
  );
}
