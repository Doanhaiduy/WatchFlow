"use client";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type AreaDatum = { label: string; value: number };

type Props = {
  data: AreaDatum[];
  /** Biến CSS màu đường (mặc định tím = doanh thu; dùng var(--wf-ok) cho lãi gộp) */
  color?: string;
  /** Đường thứ hai cùng trục (vd. lãi gộp chồng lên doanh thu); cùng số điểm và cùng nhãn với `data` */
  data2?: AreaDatum[];
  color2?: string;
  /** Tên hai đường để hiện chú giải, vd. ["Doanh thu", "Lãi gộp"] */
  legend?: [string, string];
  format?: (n: number) => string;
  ariaLabel: string;
  /** Số nhãn trục ngang tối đa (mặc định 6, trải đều) */
  maxTicks?: number;
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

/** Biểu đồ vùng có tooltip kéo (scrub) bằng chuột/ngón tay/phím mũi tên; tối đa hai đường. Tooltip đọc được bằng aria-live. */
export function AreaChart({ data, color = "var(--wf-accent)", data2, color2 = "var(--wf-ok)", legend, format = (n) => String(n), ariaLabel, maxTicks = 6 }: Props) {
  const gid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const second = data2 && data2.length === n ? data2 : undefined;
  const all = [...data.map((d) => d.value), ...(second ?? []).map((d) => d.value)];
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const toPts = (arr: AreaDatum[]): Array<[number, number]> => arr.map((d, i) => [n > 1 ? (i * W) / (n - 1) : W / 2, H - PAD - ((d.value - min) / (max - min || 1)) * (H - PAD * 2)]);
  const pts = toPts(data);
  const pts2 = second ? toPts(second) : undefined;
  const line = smooth(pts);
  const line2 = pts2 ? smooth(pts2) : "";
  const cur = active ?? n - 1;
  const p = pts[cur];
  const d = data[cur];
  const d2 = second?.[cur];

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
  // Nhãn trục ngang: trải đều tối đa `maxTicks` nhãn (luôn có điểm đầu và điểm cuối)
  const tickIdx = n <= maxTicks ? data.map((_, i) => i) : Array.from({ length: maxTicks }, (_, i) => Math.round((i * (n - 1)) / (maxTicks - 1)));
  return (
    <div>
      {legend && second && (
        <div className="wf-legend" style={{ marginBottom: 2 }}>
          <span><i style={{ background: color }} />{legend[0]}</span>
          <span><i style={{ background: color2 }} />{legend[1]}</span>
        </div>
      )}
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
            <linearGradient id={`${gid}b`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: color2, stopOpacity: 0.24 }} />
              <stop offset="1" style={{ stopColor: color2, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--wf-line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
          {pts2 && <path d={`${line2}L${W},${H}L0,${H}Z`} fill={`url(#${gid}b)`} />}
          <path d={line} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {pts2 && <path d={line2} fill="none" stroke={color2} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {p && d && (
          <>
            <span className="wf-tline" style={{ left: `${(p[0] / W) * 100}%` }} />
            <span className="wf-tdot" style={{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%`, borderColor: color }} />
            {pts2 && pts2[cur] && <span className="wf-tdot" style={{ left: `${(p[0] / W) * 100}%`, top: `${(pts2[cur]![1] / H) * 100}%`, borderColor: color2 }} />}
            <span
              className="wf-tip"
              aria-live="polite"
              style={{ left: `${Math.min(88, Math.max(12, (p[0] / W) * 100))}%`, top: `${(p[1] / H) * 100}%` }}
            >
              {d.label}: {format(d.value)}
              {d2 && ` · ${format(d2.value)}`}
            </span>
          </>
        )}
      </div>
      <div className="wf-xl" aria-hidden="true">
        {tickIdx.map((i) => (
          <span key={i}>{data[i]!.label}</span>
        ))}
      </div>
    </div>
  );
}
