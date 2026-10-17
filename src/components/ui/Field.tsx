"use client";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cx } from "./cx";

type Ctx = { id: string; describedBy?: string; invalid: boolean; required?: boolean; label?: string };
const FieldCtx = createContext<Ctx | null>(null);

/** Cho TextInput/Select/… lấy id, aria-describedby, trạng thái lỗi từ `Field` bao quanh */
export function useFieldProps(ownId?: string) {
  const f = useContext(FieldCtx);
  return {
    id: ownId ?? f?.id,
    "aria-describedby": f?.describedBy,
    "aria-invalid": f?.invalid ? (true as const) : undefined,
    "aria-required": f?.required ? (true as const) : undefined,
  };
}

/** Nhãn của `Field` bao quanh (dùng làm tiêu đề tờ trượt của Select/DateInput) */
export function useFieldLabel(): string | undefined {
  return useContext(FieldCtx)?.label;
}

type Props = {
  label: string;
  hint?: ReactNode;
  /** Câu lỗi tiếng Việt, nêu cách sửa */
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** `.fld` — nhãn nhỏ phía trên, ô bo 20 bên trong (children là TextInput/MoneyInput/PhoneInput/Select/Textarea). */
export function Field({ label, hint, error, required, className, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-h` : undefined;
  const errId = error ? `${id}-e` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldCtx.Provider value={{ id, describedBy, invalid: !!error, required, label }}>
      <div className={cx("wf-fld", className)}>
        <label className="wf-fld-label" htmlFor={id}>
          {label}
          {required && <em aria-hidden="true">*</em>}
        </label>
        {children}
        {error && (
          <span className="wf-fld-err" id={errId} role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span className="wf-fld-hint" id={hintId}>
            {hint}
          </span>
        )}
      </div>
    </FieldCtx.Provider>
  );
}
