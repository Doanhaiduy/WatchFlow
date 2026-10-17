import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  label: ReactNode;
  /** Số lớn đã định dạng, vd. "148.600.000" */
  value: string;
  /** Đơn vị nhỏ cạnh số, vd. "₫" */
  unit?: string;
  /** 0–100; bỏ trống = không hiện thanh */
  progress?: number;
  progressLabels?: [ReactNode, ReactNode];
  stats?: Array<{ label: string; value: ReactNode }>;
  /** Nút phụ tối ở góc phải trên */
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
};

/** `.wallet` — thẻ gradient lớn: nhãn, số 34/48px, thanh tiến độ, 3 ô số nhỏ. KHÔNG có ngữ nghĩa "ví/quỹ". */
export function HeroCard({ label, value, unit, progress, progressLabels, stats, action, className }: Props) {
  const p = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  return (
    <section className={cx("wf-hero", className)}>
      <div className="l">{label}</div>
      <div className="n">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {p !== undefined && (
        <>
          <div className="pb" role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
            <i style={{ width: `${p}%` }} />
          </div>
          {progressLabels && (
            <div className="pr">
              <span>{progressLabels[0]}</span>
              <span>{progressLabels[1]}</span>
            </div>
          )}
        </>
      )}
      {stats && (
        <div className="tri">
          {stats.map((s) => (
            <div key={s.label}>
              <span>{s.label}</span>
              <b>{s.value}</b>
            </div>
          ))}
        </div>
      )}
      {action &&
        (action.href ? (
          <Link href={action.href} className="wbtn">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="wbtn" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </section>
  );
}
