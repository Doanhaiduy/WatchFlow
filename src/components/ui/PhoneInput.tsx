"use client";
import { Phone } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import { useFieldProps } from "./Field";

/** Chuẩn hóa: bỏ ký tự lạ, "+84…" → "0…", tối đa 10 số (SĐT di động VN) */
export function normalizePhone(raw: string): string {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length > 10) s = "0" + s.slice(2);
  return s.replace(/\D/g, "").slice(0, 10);
}

/** 0901234567 → "0901 234 567" */
export function formatPhone(d: string): string {
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 10)].filter(Boolean).join(" ");
}

export function isValidPhone(d: string): boolean {
  return /^0\d{9}$/.test(d);
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Chỉ chữ số, vd. "0901234567" */
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
};

/** Ô SĐT Việt Nam: bàn phím số, tự nhóm "0901 234 567"; `onChange` nhận chuỗi số thuần. */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, onChange, invalid, className, id, disabled, onBlur, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  const [touched, setTouched] = useState(false);
  const inv = invalid || f["aria-invalid"] || (touched && value.length > 0 && !isValidPhone(value));
  return (
    <div className="wf-in-wrap" data-invalid={inv ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
      <span className="wf-in-ico" aria-hidden="true">
        <Phone size={18} />
      </span>
      <input
        ref={ref}
        className={cx("wf-in wf-num", className)}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0901 234 567"
        value={formatPhone(value)}
        disabled={disabled}
        {...f}
        aria-invalid={inv || undefined}
        onChange={(e) => onChange(normalizePhone(e.target.value))}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        {...rest}
      />
    </div>
  );
});
