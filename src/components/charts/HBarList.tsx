import type { ReactNode } from "react";
import type { Tone } from "../ui/cx";

export type HBarItem = { label: string; value: number; /** Chữ hiển thị bên phải (mặc định chính số) */ display?: ReactNode; hint?: ReactNode; tone?: Tone | "accent" };

const COLOR: Record<string, string> = {
  accent: "var(--wf-accent)", ok: "var(--wf-ok)", bad: "var(--wf-bad)", hold: "var(--wf-hold)",
  info: "var(--wf-info)", check: "var(--wf-check)", repair: "var(--wf-repair)", neutral: "var(--wf-neutral)",
};

/** Danh sách thanh ngang xếp hạng (vd. tồn kho theo hãng, thu theo hình thức). Chỉ chia tỷ lệ số máy chủ trả để vẽ độ dài. */
export function HBarList({ items, ariaLabel }: { items: HBarItem[]; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="wf-hbars" aria-label={ariaLabel}>
      {items.map((it) => (
        <li key={it.label}>
          <div className="t">
            <span>{it.label}</span>
            <b className="wf-num">{it.display ?? it.value}</b>
          </div>
          <div className="tr" aria-hidden="true">
            <i style={{ width: `${Math.max(it.value > 0 ? 3 : 0, (it.value / max) * 100)}%`, background: COLOR[it.tone ?? "accent"] }} />
          </div>
          {it.hint && <small>{it.hint}</small>}
        </li>
      ))}
    </ul>
  );
}
