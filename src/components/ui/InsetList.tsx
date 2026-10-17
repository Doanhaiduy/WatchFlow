"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";

/** Danh sách kính liền khối `.ig`: không blur để cuộn dài vẫn mượt (§7.2). */
export function InsetList({ children, className, noInset, label }: { children: ReactNode; className?: string; noInset?: boolean; label?: string }) {
  return (
    <div className={cx("wf-ig g g-flat", noInset && "wf-ig-nol", className)} role="list" aria-label={label}>
      {children}
    </div>
  );
}

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ô biểu tượng 44px theo tone */
  icon?: ReactNode;
  tone?: Tone;
  /** Ảnh chiếc 48px (thay cho icon) */
  thumb?: ReactNode;
  /** Cột phải: số tiền/chip */
  end?: ReactNode;
  endSub?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Mũi tên ở cuối (mặc định bật khi có href/onClick) */
  chevron?: boolean;
  className?: string;
};

export function InsetRow({ title, subtitle, icon, tone, thumb, end, endSub, href, onClick, chevron, className }: RowProps) {
  const inner = (
    <>
      {thumb ? <span className="wf-th">{thumb}</span> : icon ? (
        <span className="wf-ib" data-tone={tone} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="wf-irm">
        <b>{title}</b>
        {subtitle && <span>{subtitle}</span>}
      </span>
      {(end || endSub) && (
        <span className="wf-ire">
          {end && <b>{end}</b>}
          {endSub && <small>{endSub}</small>}
        </span>
      )}
      {(chevron ?? !!(href || onClick)) && <ChevronRight size={18} className="wf-cv" aria-hidden="true" />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cx("wf-ir", className)} role="listitem">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cx("wf-ir", className)} role="listitem" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cx("wf-ir", className)} role="listitem">
      {inner}
    </div>
  );
}
