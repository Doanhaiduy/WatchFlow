"use client";
import { Check } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
};

/** Ô chọn (vùng chạm 44px) */
export function Checkbox({ checked, onChange, label, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label className={cx("wf-check wf-check-wrap", className)}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} {...rest} />
      <span className="wf-check-box" aria-hidden="true">
        <Check size={16} strokeWidth={3} />
      </span>
      <span>{label}</span>
    </label>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

/** Công tắc cài đặt (role="switch") */
export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cx("wf-switch-row", className)}>
      <span id={id}>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} disabled={disabled} className="wf-switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

export type RadioOption<T extends string = string> = { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean };

type RadioGroupProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<RadioOption<T>>;
  /** Nhãn đọc màn hình cho cả nhóm */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

/** Nhóm chọn một (radio tự dựng theo Glass; vẫn là <input type="radio"> ẩn để có mũi tên/Tab chuẩn, vùng chạm 44px) */
export function RadioGroup<T extends string>({ value, onChange, options, ariaLabel, disabled, className }: RadioGroupProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("wf-radios", className)}>
      {options.map((o) => (
        <label key={o.value} className="wf-check wf-check-wrap wf-radio">
          <input type="radio" name={name} value={o.value} checked={o.value === value} disabled={disabled || o.disabled} onChange={() => onChange(o.value)} />
          <span className="wf-radio-dot" aria-hidden="true" />
          <span className="wf-radio-tx">
            {o.label}
            {o.description && <small>{o.description}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}
