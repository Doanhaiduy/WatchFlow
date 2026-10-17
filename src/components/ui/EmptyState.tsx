"use client";
// Ngăn "không có kết quả": Lucian UX/UI Prompt #092 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#092
// (kính lúp quét kệ trống + nút "gỡ bộ lọc → N kết quả"). CSS gốc: ../lucian/lucian-092.css
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import "../lucian/lucian-092.css";
import { Button } from "./Button";
import { cx } from "./cx";

export type EmptySuggestion = {
  /** Bộ lọc sẽ gỡ, vd. "Đang sửa" */
  removed: string;
  /** Số kết quả nếu gỡ bộ lọc đó */
  count: number;
  onClick: () => void;
};

type Props = {
  title: string;
  description?: string;
  /** "search": kính lúp quét kệ (không có kết quả tìm/lọc); "plain": biểu tượng + hướng dẫn bắt đầu */
  variant?: "search" | "plain";
  icon?: ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  /** Chỉ dùng với variant "search": gợi ý gỡ từng bộ lọc kèm số kết quả */
  suggestions?: EmptySuggestion[];
  className?: string;
};

/** Trạng thái rỗng — luôn có câu hướng dẫn + hành động tiếp theo ("Bạn chưa có … — Bắt đầu bằng …"). */
export function EmptyState({ title, description, variant = "plain", icon, action, suggestions, className }: Props) {
  const search = variant === "search";
  return (
    <div className={cx("ux u092", className)} role="status">
      <div className="u092-none">
        {search ? (
          <div className="u092-art" aria-hidden="true">
            <svg viewBox="0 0 150 92">
              <path className="u092-shelf" d="M8 30h134M8 56h134M8 82h134" />
              <g className="u092-lens">
                <circle cx="34" cy="38" r="20" />
                <path className="gl" d="M24 30a12 12 0 0 1 8-5" />
                <path d="M48 52l14 14" />
              </g>
            </svg>
          </div>
        ) : (
          icon && (
            <div className="wf-confirm-ic" data-tone="info" aria-hidden="true">
              {icon}
            </div>
          )
        )}
        <p className="u092-nt">{title}</p>
        {description && <p className="u092-ns">{description}</p>}
        {search && suggestions && suggestions.length > 0 && (
          <div className="u092-sgs">
            {suggestions.map((s, i) => (
              <button
                key={s.removed}
                type="button"
                className="u092-sg"
                style={{ "--i": i } as React.CSSProperties}
                onClick={s.onClick}
                aria-label={`Bỏ bộ lọc ${s.removed} để có ${s.count} kết quả`}
              >
                <s>{s.removed}</s>
                <span>
                  <b>{s.count} kết quả</b>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {action && (
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" href={action.href as string} onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
