import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkline } from "../charts/Sparkline";
import { cx, type Tone } from "./cx";

type Props = {
  label: string;
  /** Giá trị đã định dạng (số do máy chủ trả; component KHÔNG tính tiền) */
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: Tone;
  /** Biểu tượng trong ô màu theo `tone` */
  icon?: ReactNode;
  tone?: Tone;
  /** % thay đổi so với kỳ trước (máy chủ tính): ▲ xanh khi tăng, ▼ đỏ khi giảm; null/undefined = không hiện */
  delta?: number | null;
  /** Ngược nghĩa: giảm là tốt (vd. công nợ) ⇒ ▼ xanh */
  deltaInverse?: boolean;
  /** Chuỗi điểm cho đường xu hướng nhỏ ở góc dưới phải */
  spark?: number[];
  /** Có ⇒ cả thẻ là liên kết (vd. mở báo cáo chi tiết) */
  href?: string;
  /** Có ⇒ cả thẻ là nút (vd. lọc danh sách theo con số này); `active` đánh dấu thẻ đang được chọn */
  onClick?: () => void;
  active?: boolean;
  className?: string;
};

const PCT = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const TONE_COLOR: Record<string, string> = {
  ok: "var(--wf-ok)", bad: "var(--wf-bad)", hold: "var(--wf-hold)", info: "var(--wf-info)", check: "var(--wf-check)", repair: "var(--wf-repair)", neutral: "var(--wf-neutral)",
};

/** Thẻ số liệu `.wf-kpi`: ô biểu tượng màu + nhãn nhỏ + số 800 + (▲▼ so kỳ trước) + chú thích + đường xu hướng. Lưới 2 cột (điện thoại) / 4 cột (máy tính) — bọc trong `KpiGrid`. */
export function KpiTile({ label, value, hint, hintTone, icon, tone, delta, deltaInverse, spark, href, onClick, active, className }: Props) {
  const has = delta !== null && delta !== undefined;
  const good = has ? (deltaInverse ? delta! <= 0 : delta! >= 0) : true;
  const inner = (
    <>
      <span className="l">
        {icon && <i aria-hidden="true">{icon}</i>}
        {label}
      </span>
      <b>{value}</b>
      <span className="f">
        {has && (
          <em data-tone={good ? "ok" : "bad"}>
            <span aria-hidden="true">{delta! >= 0 ? "▲" : "▼"} </span>
            {PCT.format(Math.abs(delta!))}%
            <span className="wf-sr"> {delta! >= 0 ? "tăng" : "giảm"} so với kỳ trước</span>
          </em>
        )}
        {hint && <em data-tone={hintTone}>{hint}</em>}
      </span>
      {spark && spark.length > 1 && (
        <span className="sp" aria-hidden="true">
          <Sparkline values={spark} color={TONE_COLOR[tone ?? ""] ?? "var(--wf-accent)"} height={28} ariaLabel="" />
        </span>
      )}
    </>
  );
  const cls = cx("wf-kpi g", onClick && "wf-kpi-btn", className);
  if (onClick) {
    return (
      <button type="button" className={cls} data-tone={tone} aria-pressed={active ?? false} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return href ? (
    <Link href={href} className={cls} data-tone={tone}>
      {inner}
    </Link>
  ) : (
    <div className={cls} data-tone={tone}>
      {inner}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("wf-kpis", className)}>{children}</div>;
}
