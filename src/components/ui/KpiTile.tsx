import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";

type Props = {
  label: string;
  /** Giá trị đã định dạng (số do máy chủ trả; component KHÔNG tính tiền) */
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: Tone;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
};

/** Thẻ số liệu `.g-kpi`: nhãn nhỏ + số 800 + chú thích. Lưới 3 cột (mobile) / 4 cột (desktop) — bọc trong `.wf-kpis`. */
export function KpiTile({ label, value, hint, hintTone, icon, tone, className }: Props) {
  return (
    <div className={cx("wf-kpi g", className)} data-tone={tone}>
      <span className="l">
        {icon && <i aria-hidden="true">{icon}</i>}
        {label}
      </span>
      <b>{value}</b>
      {hint && <em data-tone={hintTone}>{hint}</em>}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("wf-kpis", className)}>{children}</div>;
}
