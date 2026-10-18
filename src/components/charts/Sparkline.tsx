import { useId } from "react";

type Props = {
  values: number[];
  /** Biến CSS màu đường (mặc định tím) */
  color?: string;
  height?: number;
  /** Nhãn đọc màn hình (mặc định mô tả xu hướng) */
  ariaLabel?: string;
};

const W = 100;

function smooth(p: Array<[number, number]>): string {
  if (p.length < 2) return "";
  let d = `M${p[0]![0]},${p[0]![1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!, b = p[i]!, c = p[i + 1]!, e = p[i + 2] ?? c;
    d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}

/** Đường xu hướng nhỏ (không trục, không tooltip) cho thẻ số liệu. Giá trị là số máy chủ trả; chỉ chia tỷ lệ để vẽ. */
export function Sparkline({ values, color = "var(--wf-accent)", height = 30, ariaLabel }: Props) {
  const gid = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const H = 32, pad = 3;
  const pts: Array<[number, number]> = values.map((v, i) => [(i * W) / (values.length - 1), H - pad - ((v - min) / span) * (H - pad * 2)]);
  const line = smooth(pts);
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg className="wf-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label={ariaLabel ?? (up ? "Xu hướng tăng" : "Xu hướng giảm")}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
