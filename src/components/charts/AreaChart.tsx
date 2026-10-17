"use client";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type AreaDatum = { label: string; value: number };

type Props = {
  data: AreaDatum[];
  /** Biến CSS màu đường (mặc định tím = doanh thu; dùng var(--wf-ok) cho lãi gộp) */
  color?: string;
  format?: (n: number) => string;
  ariaLabel: string;
};

const W = 300;
const H = 100;
const PAD = 8;

function smooth(p: Array<[number, number]>): string {
  if (p.length === 0) return "";
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!, b = p[i]!, c = p[i + 1]!, e = p[i + 2] ?? c;
    d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}

/** Biểu đồ vùng có tooltip kéo (scrub) bằng chuột/ngón tay/phím mũi tên. Tooltip đọc được bằng aria-live. */
export function AreaChart({ data, color = "var(--wf-accent)", format = (n) => String(n), ariaLabel }: Props) {
  const gid = useId();
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const pts: Array<[number, number]> = data.map((d, i) => [n > 1 ? (i * W) / (n - 1) : W / 2, H - PAD - ((d.value - min) / (max - min || 1)) * (H - PAD * 2)]);
  const line = smooth(pts);
  const cur = active ?? n - 1;
  const p = pts[cur];
  const d = data[cur];

  const at = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || n < 2) return;
    setActive(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setActive(Math.max(0, cur - 1));
    else if (e.key === "ArrowRight") setActive(Math.min(n - 1, cur + 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else return;
    e.preventDefault();
  };

  if (n === 0) return <div className="wf-cw" role="img" aria-label={`${ariaLabel}: chưa có dữ liệu`} />;
  const first = data[0]!, last = data[n - 1]!;
  return (
    <div>
      <div
        ref={box}
        className="wf-cw"
        role="group"
        tabIndex={0}
        aria-label={`${ariaLabel}. Dùng mũi tên trái/phải để xem từng điểm.`}
        onPointerMove={at}
        onPointerDown={at}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: color, stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {[0.33, 0.66].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--wf-line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {p && d && (
          <>
            <span className="wf-tline" style={{ left: `${(p[0] / W) * 100}%` }} />
            <span className="wf-tdot" style={{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%`, borderColor: color }} />
            <span
              className="wf-tip"
              aria-live="polite"
              style={{ left: `${Math.min(88, Math.max(12, (p[0] / W) * 100))}%`, top: `${(p[1] / H) * 100}%` }}
            >
              {d.label}: {format(d.value)}
            </span>
          </>
        )}
      </div>
      <div className="wf-xl" aria-hidden="true">
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
