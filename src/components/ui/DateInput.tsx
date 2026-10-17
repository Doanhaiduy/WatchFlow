"use client";
// Chọn ngày tự dựng (thay <input type="date">): giá trị chuỗi "YYYY-MM-DD" (hoặc "" = chưa chọn), hiển thị dd/mm/yyyy, gõ tay được,
// lịch tháng tiếng Việt (Lucian #030, ../lucian/CalendarPanel.tsx) trong Popover (desktop) hoặc tờ trượt (điện thoại < 1000px).
// Không dùng new Date("YYYY-MM-DD") để cộng trừ ngày: mọi phép tính ngày đi qua src/lib/dates.ts.
import { CalendarDays } from "lucide-react";
import { forwardRef, useId, useImperativeHandle, useRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { formatDateVn, isIsoDate, todayVn, type IsoDate } from "@/lib/dates";
import { CalendarPanel } from "../lucian/CalendarPanel";
import { useIsDesktop } from "../trade/useIsDesktop";
import { cx } from "./cx";
import { useFieldLabel, useFieldProps } from "./Field";
import { Modal } from "./Modal";
import { Popover } from "./Popover";

/** "dd/mm/yyyy" đầy đủ → ISO (hoặc null nếu sai/không có thật như 31/02) */
function parseVn(s: string): IsoDate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const v = `${m[3]}-${m[2]}-${m[1]}`;
  return isIsoDate(v) ? v : null;
}

/** Tự chèn dấu "/" khi gõ số: 1710 → 17/10, 17102026 → 17/10/2026 */
function maskVn(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max" | "defaultValue"> & {
  value: IsoDate | "";
  onChange: (value: IsoDate | "") => void;
  min?: IsoDate;
  max?: IsoDate;
  /** Cho phép để trống / có nút "Xóa" (mặc định true) */
  clearable?: boolean;
  invalid?: boolean;
  /** Tiêu đề tờ trượt trên điện thoại (mặc định: nhãn Field / aria-label) */
  label?: string;
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, min, max, clearable = true, invalid, label, className, id, disabled, placeholder = "dd/mm/yyyy", onBlur, onKeyDown, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  const fieldLabel = useFieldLabel();
  const desktop = useIsDesktop();
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // đang gõ dở; null = hiển thị theo `value`
  const today = todayVn();
  const title = label ?? rest["aria-label"] ?? fieldLabel ?? "Chọn ngày";
  const shown = draft ?? (value ? formatDateVn(value) : "");
  const inv = invalid || f["aria-invalid"] || (draft !== null && draft.length === 10 && parseVn(draft) === null);

  const inRange = (d: IsoDate) => !(min && d < min) && !(max && d > max);

  const commit = (d: IsoDate | "") => {
    setDraft(null);
    if (d !== value) onChange(d);
  };

  const onType = (e: ChangeEvent<HTMLInputElement>) => {
    const m = maskVn(e.target.value);
    setDraft(m);
    const p = parseVn(m);
    if (p && inRange(p)) commit(p);
    else if (m === "" && clearable) commit("");
  };

  const onBlurInput = (e: FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
    if (draft === null) return;
    const p = parseVn(draft);
    if (p && inRange(p)) commit(p);
    else if (draft === "" && clearable) commit("");
    else setDraft(null); // sai/ngoài khoảng: trả về giá trị đang giữ
  };

  const keyInput = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    if ((e.key === "ArrowDown" && e.altKey) || (e.key === "ArrowDown" && !open)) {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Enter" && draft !== null) {
      const p = parseVn(draft);
      if (p && inRange(p)) {
        e.preventDefault();
        commit(p);
      }
    }
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus({ preventScroll: true });
  };

  const panel = (
    <CalendarPanel
      mode="single"
      value={value}
      min={min}
      max={max}
      today={today}
      autoFocus
      onSelect={(d) => {
        commit(d);
        close(true);
      }}
      onClear={clearable ? () => {
        commit("");
        close(true);
      } : undefined}
    />
  );

  return (
    <div className="wf-date-wrap">
      <div ref={wrap} className={cx("wf-in-wrap wf-date", className)} data-invalid={inv ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
        <input
          ref={input}
          className="wf-in"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={10}
          disabled={disabled}
          {...f}
          aria-invalid={inv || undefined}
          {...rest}
          value={shown}
          onChange={onType}
          onBlur={onBlurInput}
          onKeyDown={keyInput}
        />
        <button
          ref={btn}
          type="button"
          className="wf-date-btn"
          aria-label={`Mở lịch: ${title}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${uid}-cal` : undefined}
          disabled={disabled}
          onClick={() => (open ? close(false) : setOpen(true))}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </div>
      {desktop ? (
        <Popover open={open} onClose={() => close(true)} anchorRef={wrap} width={320} height={430} id={`${uid}-cal`} role="dialog" aria-label={title} className="wf-pop-cal">
          {panel}
        </Popover>
      ) : (
        <Modal open={open} onClose={() => close(true)} title={title}>
          {panel}
        </Modal>
      )}
    </div>
  );
});

type RangeProps = {
  from: IsoDate | "";
  to: IsoDate | "";
  onChange: (range: { from: IsoDate; to: IsoDate }) => void;
  min?: IsoDate;
  max?: IsoDate;
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

/** Chọn khoảng ngày: một nút hiển thị "dd/mm/yyyy – dd/mm/yyyy", mở lịch chọn đầu–cuối rồi bấm "Áp dụng". */
export function DateRange({ from, to, onChange, min, max, label, invalid, disabled, className, id, ...aria }: RangeProps) {
  const f = useFieldProps(id);
  const fieldLabel = useFieldLabel();
  const desktop = useIsDesktop();
  const uid = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const today = todayVn();
  const title = label ?? aria["aria-label"] ?? fieldLabel ?? "Chọn khoảng ngày";
  const has = !!from && !!to;
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus({ preventScroll: true });
  };
  const panel = (
    <CalendarPanel
      mode="range"
      from={from}
      to={to}
      min={min}
      max={max}
      today={today}
      autoFocus
      onApply={(a, b) => {
        onChange({ from: a, to: b });
        close(true);
      }}
    />
  );
  return (
    <div className="wf-date-wrap">
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cx("wf-in wf-select-btn", className)}
        data-open={open || undefined}
        data-empty={!has || undefined}
        disabled={disabled}
        {...f}
        aria-invalid={invalid || f["aria-invalid"] || undefined}
        aria-label={aria["aria-label"]}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className="wf-select-v">{has ? `${formatDateVn(from)} – ${formatDateVn(to)}` : "Chọn khoảng ngày"}</span>
        <CalendarDays size={18} aria-hidden="true" style={{ color: "var(--wf-mute)", flex: "none" }} />
      </button>
      {desktop ? (
        <Popover open={open} onClose={() => close(true)} anchorRef={btn} width={340} height={500} id={`${uid}-cal`} role="dialog" aria-label={title} className="wf-pop-cal">
          {panel}
        </Popover>
      ) : (
        <Modal open={open} onClose={() => close(true)} title={title}>
          {panel}
        </Modal>
      )}
    </div>
  );
}
