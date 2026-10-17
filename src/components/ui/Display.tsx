import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** `.kv` — hàng nhãn xám / giá trị đậm (thông tin chiếc, phiếu) */
export function KeyValue({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cx("wf-kv", className)}>
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `.tl` — chấm tím + đường nối (lịch sử trạng thái/giá). Mới nhất ở trên. */
export function Timeline({ items, className }: { items: Array<{ title: ReactNode; meta?: ReactNode }>; className?: string }) {
  return (
    <ol className={cx("wf-tl", className)}>
      {items.map((it, i) => (
        <li key={i}>
          <b>{it.title}</b>
          {it.meta && <span>{it.meta}</span>}
        </li>
      ))}
    </ol>
  );
}

/** `.lock` — dải vàng nhạt gắn cạnh mọi khối giá vốn/lãi/giá thu. Bọc nội dung thật bằng `<CanSee permission="cost.view">`. */
export function LockNote({ children = "Chỉ người có quyền xem giá vốn mới thấy mục này", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cx("wf-lock", className)} role="note">
      <Lock size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

type StepperProps = {
  steps: string[];
  /** Chỉ số bước hiện tại (từ 0) */
  current: number;
  /** Có ⇒ cho bấm quay lại các bước đã qua */
  onStep?: (i: number) => void;
  className?: string;
};

/** `.stp` — các viên thuốc bước (nhận máy, form dài) */
export function Stepper({ steps, current, onStep, className }: StepperProps) {
  return (
    <ol className={cx("wf-stp", className)} aria-label="Các bước">
      {steps.map((s, i) => {
        const done = i < current;
        const props = { "aria-current": i === current ? ("step" as const) : undefined, "data-done": done ? "true" : undefined };
        return (
          <li key={s}>
            {onStep && done ? (
              <button type="button" onClick={() => onStep(i)} {...props}>
                {i + 1}. {s}
              </button>
            ) : (
              <span {...props}>
                {i + 1}. {s}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
