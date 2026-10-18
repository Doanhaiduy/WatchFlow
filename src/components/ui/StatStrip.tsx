import type { ReactNode } from "react";
import { KpiGrid, KpiTile } from "./KpiTile";
import { cx, type Tone } from "./cx";

export type Stat = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  hintTone?: Tone;
  delta?: number | null;
  deltaInverse?: boolean;
  href?: string;
  /** Bấm để lọc danh sách; `active` = đang lọc theo thẻ này */
  onClick?: () => void;
  active?: boolean;
};

/** Dải 2–4 thẻ số liệu ở đầu trang danh sách (icon màu + số lớn). Số do máy chủ trả, KHÔNG tự tính tiền ở đây. Rỗng ⇒ không vẽ gì. */
export function StatStrip({ items, className }: { items: Array<Stat | false | null | undefined>; className?: string }) {
  const list = items.filter(Boolean) as Stat[];
  if (list.length === 0) return null;
  return (
    <div className={cx("wf-strip", className)} data-n={list.length}>
      <KpiGrid>
        {list.map((s) => (
          <KpiTile key={s.label} {...s} />
        ))}
      </KpiGrid>
    </div>
  );
}
