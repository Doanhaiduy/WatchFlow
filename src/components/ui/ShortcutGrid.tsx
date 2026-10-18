import Link from "next/link";
import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";

export type Shortcut = { href: string; label: string; icon: ReactNode; tone?: Tone; /** Số nhỏ ở góc (vd. việc cần xử lý) */ badge?: number; /** Dòng mô tả nhỏ dưới nhãn */ sub?: string };

/** Lưới lối tắt: ô biểu tượng màu + nhãn. Dùng ở Tổng quan để vào nhanh các việc hay làm (đã lọc theo quyền ở nơi gọi). */
export function ShortcutGrid({ items, className, ariaLabel, cols }: { items: Shortcut[]; className?: string; ariaLabel: string; /** Số cột từ 700px trở lên (mặc định 2) */ cols?: 2 | 3 }) {
  return (
    <nav className={cx("wf-sc", className)} data-cols={cols} aria-label={ariaLabel}>
      {items.map((s) => (
        <Link key={s.href + s.label} href={s.href} className="wf-sc-i g g-flat">
          <span className="wf-ib" data-tone={s.tone} aria-hidden="true">{s.icon}</span>
          <b>{s.label}</b>
          {s.sub && <small>{s.sub}</small>}
          {s.badge !== undefined && s.badge > 0 && <em className="wf-nb warn" aria-label={`${s.badge} việc`}>{s.badge > 99 ? "99+" : s.badge}</em>}
        </Link>
      ))}
    </nav>
  );
}
