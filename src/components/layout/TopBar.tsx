"use client";
import Link from "next/link";
import { ScanLine, Search } from "lucide-react";
import { NotificationBell } from "../lucian/NotificationBell";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { matchNav, type QuickAction } from "./nav";
import { openCommandPalette, useShortcutHint } from "./palette-bus";
import "./shell-extras.css";

type Props = {
  pathname: string;
  /** Ghi đè tiêu đề/mô tả (mặc định lấy từ PageHeader hoặc nhãn mục nav) */
  title?: string;
  description?: string;
  unread?: boolean;
  /** Hành động chính (nút gradient) — thường là phần tử đầu của "+" */
  primary?: QuickAction;
  /** false = ẩn nút quét QR (người không có quyền xem kho đồng hồ, vd. CTV). Nút tìm nhanh (Ctrl+K) luôn có. Mặc định true. */
  search?: boolean;
  className?: string;
};

/** Thanh trên dạng viên thuốc kính (desktop): tiêu đề + mô tả, ô tìm 300px, quét QR, chuông, nút hành động chính (§4.2). */
export function TopBar({ pathname, title, description, unread, primary, search = true, className }: Props) {
  const nav = matchNav(pathname);
  const hint = useShortcutHint();
  const PIcon = primary?.icon;
  return (
    <header className={cx("wf-tb g", className)}>
      <div className="ttl">
        <h1>{title ?? nav?.label ?? "WatchFlow"}</h1>
        {description && <small>{description}</small>}
      </div>
      <button type="button" className="s wf-cp-trigger" onClick={() => openCommandPalette()} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
        <Search size={18} aria-hidden="true" />
        <span>Tìm mã, serial, khách, phiếu…</span>
        <kbd aria-hidden="true">{hint}</kbd>
      </button>
      {search && (
        <Link href="/dong-ho?quet=1" className="wf-cb" aria-label="Quét mã QR">
          <ScanLine size={20} />
        </Link>
      )}
      <NotificationBell />
      {primary && PIcon && (
        <Button variant="primary" href={primary.href} icon={<PIcon size={18} aria-hidden="true" />}>
          {primary.label}
        </Button>
      )}
    </header>
  );
}
