import type { ReactNode } from "react";

export type DonutSegment = { label: string; value: number; color?: string };

const PALETTE = ["var(--wf-accent)", "var(--wf-ok)", "var(--wf-repair)", "var(--wf-check)", "var(--wf-info)", "var(--wf-hold)", "var(--wf-neutral)"];

type Props = {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  /** Chữ giữa: tiêu đề lớn + chú thích nhỏ */
  center?: { title: ReactNode; caption?: ReactNode };
  /** Định dạng số ở chú giải */
  format?: (n: number) => string;
  ariaLabel: string;
};

/** Donut tỷ trọng (vd. theo thương hiệu) + chú giải. Giá trị là số máy chủ trả; component chỉ chia tỷ lệ để vẽ. */
export function Donut({ segments, size = 150, stroke = 22, center, format = (n) => String(n), ariaLabel }: Props) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const r = (size - stroke) / 2;
  let acc = 0;
  return (
    <div className="wf-donut">
      <div className="wf-donut-c" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--wf-line)" strokeWidth={stroke} />
          {total > 0 &&
            segments.map((s, i) => {
              const pct = (Math.max(0, s.value) / total) * 100;
              const gap = segments.length > 1 && pct > 1.5 ? 1 : 0;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} pathLength={100}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeDasharray={`${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += pct;
              return el;
            })}
        </svg>
        {center && (
          <div className="ctr">
            <b>{center.title}</b>
            {center.caption && <span>{center.caption}</span>}
          </div>
        )}
      </div>
      <ul className="wf-legend" style={{ flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0, flex: 1, minWidth: 140 }}>
        {segments.map((s, i) => (
          <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <i style={{ background: s.color ?? PALETTE[i % PALETTE.length], flex: "none", marginRight: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <b className="wf-num" style={{ color: "var(--wf-ink)", fontWeight: 700 }}>
              {format(s.value)}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}
