import type { CSSProperties } from "react";
import type { Tone } from "../ui/cx";

type Props = {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone | "accent";
  /** Nhãn giữa vòng (mặc định "NN%") */
  label?: string;
  ariaLabel?: string;
};

const COLOR: Record<string, string> = {
  accent: "var(--wf-accent)", ok: "var(--wf-ok)", bad: "var(--wf-bad)", hold: "var(--wf-hold)",
  info: "var(--wf-info)", check: "var(--wf-check)", repair: "var(--wf-repair)", neutral: "var(--wf-neutral)",
};

/** Vòng % + số giữa (`chart.ring`) — tiến độ sửa chữa. SVG thuần, không phụ thuộc client. */
export function Ring({ value, size = 56, stroke = 6, tone = "accent", label, ariaLabel }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const style: CSSProperties = { width: size, height: size };
  return (
    <span className="wf-ring" style={style} role="img" aria-label={ariaLabel ?? `Tiến độ ${Math.round(v)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--wf-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLOR[tone]} strokeWidth={stroke} strokeLinecap="round"
          pathLength={100} strokeDasharray={`${v} 100`} style={{ transition: "stroke-dasharray .6s var(--wf-ease)" }}
        />
      </svg>
      <b>{label ?? `${Math.round(v)}%`}</b>
    </span>
  );
}
