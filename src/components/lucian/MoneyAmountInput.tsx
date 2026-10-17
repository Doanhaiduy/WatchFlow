"use client";
// Lucian UX/UI Prompt #035 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#035
// Nhập số tiền cỡ lớn: chỉ chữ số đổi mới nảy lên, dấu chấm nghìn tự chèn, chip cộng nhanh, vượt hạn mức thì số đỏ + rung.
// Dùng cho "Khách đưa", thanh toán, cọc, giá thu giao CTV. Số chỉ là gợi ý nhập; máy chủ tính tiền thật.
import { useEffect, useId, useRef, useState } from "react";
import { formatVnd } from "@/lib/money";
import "./lucian-035.css";

type Props = {
  /** Số tiền nguyên VND (0 = trống) */
  value: number;
  onChange: (v: number) => void;
  /** Hạn mức: vượt ⇒ số đỏ + rung + `overText` (vd. số tiền còn nợ khi KHÔNG cho trả dư thì đặt max; để trống nếu không giới hạn) */
  max?: number;
  /** Chip cộng nhanh (VND) */
  quickAdds?: number[];
  /** Nút "Đủ" đặt giá trị = số này (vd. tổng phải trả) */
  fullAmount?: number;
  /** Dòng phụ dưới số tiền (vd. "Tiền thừa: 100.000 ₫") */
  subText?: (v: number, over: boolean) => string;
  ariaLabel?: string;
  disabled?: boolean;
};

const MAX = 9_999_999_999;

export function MoneyAmountInput({ value, onChange, max, quickAdds = [10000, 50000, 100000], fullAmount, subText, ariaLabel = "Số tiền", disabled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false);
  const [shake, setShake] = useState(false);
  const id = useId();
  const over = max !== undefined && value > max;
  const wasOver = useRef(over);

  useEffect(() => {
    if (over && !wasOver.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 450);
      wasOver.current = over;
      return () => clearTimeout(t);
    }
    wasOver.current = over;
  }, [over]);

  const text = value ? formatVnd(value, { symbol: false }) : "0";
  const chars = Array.from(text);
  const sub = subText ? subText(value, over) : over && max !== undefined ? `Vượt ${formatVnd(value - max)}` : "";
  const add = (a: number) => onChange(Math.min(MAX, value + a));

  return (
    <div ref={rootRef} className={`ux u035${focus ? " is-focus" : ""}${over ? " is-over" : ""}${shake ? " is-shake" : ""}`}>
      <div className="u035-amt">
        <span className="u035-num" aria-hidden="true">
          {chars.map((ch, i) => {
            const sep = ch === ".";
            return (
              <span key={`${chars.length - i}-${ch}`} className={`${sep ? "c" : "new"}${!value ? " ph" : ""}`}>
                {ch}
              </span>
            );
          })}
          <span className="u035-caret" />
        </span>
        <span className="u035-num" aria-hidden="true" style={{ marginLeft: 6, fontSize: 28 }}>
          <span className="c">₫</span>
        </span>
        <input
          id={id}
          className="u035-real"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={over || undefined}
          disabled={disabled}
          value={value ? String(value) : ""}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
            onChange(digits ? Math.min(MAX, parseInt(digits, 10)) : 0);
          }}
        />
      </div>
      <p className="u035-sub" aria-live="polite">
        {sub}
      </p>
      <div className="u035-chips">
        {quickAdds.map((a) => (
          <button key={a} type="button" className="u035-chip" disabled={disabled} onClick={() => add(a)} aria-label={`Cộng thêm ${formatVnd(a)}`}>
            +{a >= 1_000_000 ? `${a / 1_000_000}tr` : `${a / 1000}k`}
          </button>
        ))}
        {fullAmount !== undefined && (
          <button type="button" className="u035-chip" disabled={disabled} onClick={() => onChange(fullAmount)}>
            Đủ
          </button>
        )}
        {value > 0 && (
          <button type="button" className="u035-chip" disabled={disabled} onClick={() => onChange(0)} aria-label="Xóa số tiền">
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}
