"use client";
import { useState } from "react";

/** `value2` (tùy chọn) = cột thứ hai cạnh cột chính của cùng một kỳ (vd. lãi gộp cạnh doanh thu) */
export type BarDatum = { label: string; value: number; value2?: number };

type Props = {
  data: BarDatum[];
  /** Tô gradient cột cuối (kỳ hiện tại) */
  highlightLast?: boolean;
  format?: (n: number) => string;
  ariaLabel: string;
  /** Tên hai loại cột để hiện chú giải, vd. ["Doanh thu", "Lãi gộp"] — chỉ khi có `value2` */
  legend?: [string, string];
  /** Chiều cao vùng cột (px) */
  height?: number;
};

/** Biểu đồ cột (SVG/CSS nhẹ), một hoặc hai cột mỗi kỳ. Chạm/hover/focus một cột để đọc giá trị. Giá trị do máy chủ tính sẵn. */
export function BarChart({ data, highlightLast = true, format = (n) => String(n), ariaLabel, legend, height }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.value2 ?? 0]));
  const cur = sel ?? (data.length ? data.length - 1 : -1);
  const d = data[cur];
  const two = data.some((x) => x.value2 !== undefined);
  return (
    <figure style={{ margin: 0 }} aria-label={ariaLabel}>
      {legend && two && (
        <div className="wf-legend" style={{ marginBottom: 6 }}>
          <span><i style={{ background: "var(--wf-accent)" }} />{legend[0]}</span>
          <span><i style={{ background: "var(--wf-ok)" }} />{legend[1]}</span>
        </div>
      )}
      <p className="wf-num" aria-live="polite" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, minHeight: 20 }}>
        {d ? (
          <>
            <span className="wf-mute" style={{ fontWeight: 500 }}>{d.label}: </span>
            {format(d.value)}
            {d.value2 !== undefined && <span className="wf-mute" style={{ fontWeight: 500 }}> · {format(d.value2)}</span>}
          </>
        ) : (
          "Chưa có dữ liệu"
        )}
      </p>
      <div className="wf-bars" role="group" data-two={two ? "true" : undefined} style={height ? { height } : undefined}>
        {data.map((x, i) => (
          <button
            key={x.label}
            type="button"
            data-hl={highlightLast && i === data.length - 1 ? "true" : undefined}
            data-sel={sel === i ? "true" : undefined}
            aria-label={`${x.label}: ${format(x.value)}${x.value2 !== undefined ? `, ${format(x.value2)}` : ""}`}
            onMouseEnter={() => setSel(i)}
            onMouseLeave={() => setSel(null)}
            onFocus={() => setSel(i)}
            onBlur={() => setSel(null)}
            onClick={() => setSel(i)}
          >
            <span className="b">
              <i style={{ height: `${Math.max(3, (x.value / max) * 100)}%` }} />
              {x.value2 !== undefined && <i className="b2" style={{ height: `${Math.max(3, (x.value2 / max) * 100)}%` }} />}
            </span>
            <em>{x.label}</em>
          </button>
        ))}
      </div>
    </figure>
  );
}
