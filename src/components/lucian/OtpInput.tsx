"use client";
// Lucian UX/UI Prompt #026 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#026
// Ô mã 6 số (TOTP): từng chữ số nảy lên, sóng khi kiểm tra, xanh khi đúng, rung + xóa khi sai. Bản gốc xem sổ ui-design-system §9.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./lucian-026.css";

type Status = "idle" | "check" | "ok" | "bad";

type Props = {
  /** Gọi khi đủ số ký tự. Trả `true` = đúng. Ném lỗi/trả `false` = sai (ô rung, xóa, nhập lại) */
  onComplete: (code: string) => Promise<boolean> | boolean;
  length?: number;
  /** Dòng gợi ý khi chờ nhập */
  hint?: string;
  /** Câu báo sai (mặc định "Mã không đúng. Thử lại") */
  errorText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function OtpInput({
  onComplete,
  length = 6,
  hint = "Nhập mã 6 số trong ứng dụng xác thực",
  errorText = "Mã không đúng. Thử lại",
  disabled,
  autoFocus,
  ariaLabel = "Mã xác thực 6 số",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const alive = useRef(true);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const id = useId();
  const rm = useRef(false);

  useEffect(() => {
    alive.current = true;
    rm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoFocus) inputRef.current?.focus();
    const t = timers.current;
    return () => {
      alive.current = false;
      t.forEach(clearTimeout);
    };
  }, [autoFocus]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(() => alive.current && fn(), ms));
  };

  const verify = useCallback(
    async (code: string) => {
      setStatus("check");
      let ok = false;
      try {
        ok = (await onComplete(code)) === true;
      } catch {
        ok = false;
      }
      if (!alive.current) return;
      // giữ nhịp sóng ~640ms như bản gốc để người dùng kịp thấy
      later(() => {
        if (ok) {
          setStatus("ok");
          inputRef.current?.blur();
        } else {
          setStatus("bad");
          later(() => {
            setStatus("idle");
            setValue("");
            requestAnimationFrame(() => inputRef.current?.focus());
          }, rm.current ? 600 : 900);
        }
      }, rm.current ? 60 : 640);
    },
    [onComplete],
  );

  const msg =
    status === "check" ? "Đang kiểm tra…" : status === "ok" ? "Đã xác minh" : status === "bad" ? errorText : hint;
  const cells = Array.from({ length });
  const sep = Math.floor(length / 2);
  return (
    <div className={`ux u026 is-${status === "idle" ? "idle" : status} ${className ?? ""}`.trim()}>
      <div className="u026-row" role="group" aria-label={ariaLabel}>
        {cells.map((_, i) => {
          const ch = value[i] ?? "";
          return (
            <span key={i} className="contents">
              {i === sep && <i className="sep" aria-hidden="true" />}
              <span
                className={`u026-c${focused && i === Math.min(value.length, length - 1) ? " cur" : ""}${ch ? " has" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                aria-hidden="true"
              >
                {ch && <span key={`${i}-${ch}`}>{ch}</span>}
              </span>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          className="u026-real"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled || status === "check" || status === "bad"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, length);
            setValue(v);
            if (status === "ok") setStatus("idle");
            if (v.length === length) void verify(v);
          }}
        />
      </div>
      <p className="u026-msg" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
