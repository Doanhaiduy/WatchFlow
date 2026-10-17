"use client";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { formatVnd, parseVnd } from "@/lib/money";
import { Button } from "./Button";
import { cx } from "./cx";
import { useFieldProps } from "./Field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  /** Số tiền nguyên VND; null = để trống */
  value: number | null;
  onChange: (v: number | null) => void;
  /** Chặn trên (mặc định 9.999.999.999) */
  max?: number;
  /** Nút cộng nhanh, vd. [10000, 50000, 100000] */
  quickAdds?: number[];
  invalid?: boolean;
};

const fmt = (v: number | null) => (v === null ? "" : formatVnd(v, { symbol: false }));

/**
 * Ô nhập tiền VND: chỉ nhận chữ số, tự chèn dấu chấm nghìn (8.200.000), hậu tố ₫, chữ ≥ 16px.
 * Là ô gợi ý nhập — máy chủ mới là nơi tính tiền (conventions §2).
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, max = 9_999_999_999, quickAdds, invalid, className, id, disabled, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  const [text, setText] = useState(fmt(value));
  // Đồng bộ khi cha đổi giá trị từ bên ngoài (không ghi đè lúc người dùng đang gõ cùng một số)
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (parseVnd(text) !== value) setText(fmt(value));
  }

  const inv = invalid || f["aria-invalid"];
  const commit = (v: number | null) => {
    setText(fmt(v));
    setPrev(v);
    onChange(v);
  };

  return (
    <div>
      <div className="wf-in-wrap" data-invalid={inv ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
        <input
          ref={ref}
          className={cx("wf-in wf-money", className)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={text}
          disabled={disabled}
          {...f}
          aria-invalid={inv || undefined}
          onChange={(e) => {
            const n = parseVnd(e.target.value.replace(/[^\d.\s]/g, ""));
            if (n === null) return commit(null);
            if (Number.isNaN(n)) return;
            commit(Math.min(n, max));
          }}
          {...rest}
        />
        <span className="wf-in-suffix" aria-hidden="true">
          ₫
        </span>
      </div>
      {quickAdds && quickAdds.length > 0 && (
        <div className="wf-quick">
          {quickAdds.map((a) => (
            <Button key={a} sm disabled={disabled} onClick={() => commit(Math.min((value ?? 0) + a, max))} aria-label={`Cộng thêm ${formatVnd(a)}`}>
              +{a >= 1_000_000 ? `${a / 1_000_000}tr` : `${a / 1000}k`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});
