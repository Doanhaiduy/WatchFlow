"use client";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { useFieldProps } from "./Field";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Biểu tượng bên trái */
  icon?: ReactNode;
  /** Chữ cố định bên phải (vd. đơn vị) */
  suffix?: ReactNode;
  invalid?: boolean;
};

/** Ô nhập chữ (≥ 16px chống iOS tự phóng). Dùng trong `Field` để có nhãn/lỗi. */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon, suffix, className, invalid, id, disabled, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  const inv = invalid || f["aria-invalid"];
  if (!icon && !suffix) {
    return <input ref={ref} className={cx("wf-in", className)} disabled={disabled} {...f} aria-invalid={inv || undefined} {...rest} />;
  }
  return (
    <div className="wf-in-wrap" data-invalid={inv ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
      {icon && (
        <span className="wf-in-ico" aria-hidden="true">
          {icon}
        </span>
      )}
      <input ref={ref} className={cx("wf-in", className)} disabled={disabled} {...f} aria-invalid={inv || undefined} {...rest} />
      {suffix && <span className="wf-in-suffix">{suffix}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, id, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  return <textarea ref={ref} className={cx("wf-in", className)} {...f} aria-invalid={invalid || f["aria-invalid"] || undefined} {...rest} />;
});

export { Select, type SelectOption } from "./Select";
