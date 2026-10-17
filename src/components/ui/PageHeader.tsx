"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Search } from "lucide-react";
import { NotificationBell } from "../lucian/NotificationBell";
import { useEffect, type ReactNode } from "react";
import { BackButton } from "../layout/BackButton";
import { openCommandPalette } from "../layout/palette-bus";
import { useShellMeta } from "./shell-meta";

type Props = {
  title: string;
  /** Dòng nhỏ phía trên tiêu đề (ngày/ngữ cảnh) */
  context?: string;
  /** Mô tả ngắn (hiện ở thanh trên desktop và dưới tiêu đề mobile) */
  description?: string;
  /** Nút hành động của trang (desktop: hàng phải trên nội dung; mobile: cạnh chuông) */
  actions?: ReactNode;
  /** Có ⇒ hiện nút quét QR cạnh chuông (mobile) */
  onScan?: () => void;
};

/**
 * Mobile: tiêu đề lớn `.lt` (hàng nhỏ ngữ cảnh + quét QR + chuông, rồi tiêu đề 34px).
 * Desktop: tiêu đề do `TopBar` hiển thị (PageHeader chỉ báo tiêu đề lên khung), còn `actions` nằm hàng phải.
 */
export function PageHeader({ title, context, description, actions, onScan }: Props) {
  const shell = useShellMeta();
  const setMeta = shell?.setMeta;
  const pathname = usePathname();
  // Điện thoại: nút tìm nhanh (mở bảng lệnh Ctrl+K) ở mọi trang trong khung ứng dụng; nút quét QR theo quyền catalog.view (trừ danh sách đồng hồ — đã có ô tìm/quét riêng)
  const inShell = !!shell;
  const quick = !!shell?.search && pathname !== "/dong-ho";
  useEffect(() => {
    setMeta?.({ title, description });
    return () => setMeta?.({});
  }, [setMeta, title, description]);

  return (
    <>
      <header className="wf-lt desk:hidden">
        <div className="row">
          <BackButton />
          <small>{context ?? ""}</small>
          {inShell && (
            <button type="button" className="wf-cb g g-flat" onClick={() => openCommandPalette()} aria-haspopup="dialog" aria-label="Tìm nhanh (đồng hồ, khách, phiếu, trang)">
              <Search size={20} />
            </button>
          )}
          {onScan ? (
            <button type="button" className="wf-cb g g-flat" onClick={onScan} aria-label="Quét mã QR">
              <ScanLine size={20} />
            </button>
          ) : quick && (
            <Link href="/dong-ho?quet=1" className="wf-cb g g-flat" aria-label="Quét mã QR">
              <ScanLine size={20} />
            </Link>
          )}
          <NotificationBell />
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {actions && <div className="wf-dev-row" style={{ marginTop: 10 }}>{actions}</div>}
      </header>
      {actions && <div className="wf-ph-d">{actions}</div>}
    </>
  );
}
