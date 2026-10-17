"use client";
import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionSheet } from "../ui/ActionSheet";
import { cx } from "../ui/cx";
import { NavBadge, Badge, useBadgeRest } from "./badges";
import { MenuSheet, type ShellUser } from "./MenuSheet";
import { isActive, quickActions, resolveDock, type CanFn, type NavItem } from "./nav";

type Props = {
  pathname: string;
  can: CanFn;
  user: ShellUser;
  onLogout: () => void;
  className?: string;
};

/** Dock nổi (mobile < 1000px): 2 mục · nút "+" nhô lên · 1 mục · Menu. Mục theo QUYỀN (§4.3). */
export function Dock({ pathname, can, user, onLogout, className }: Props) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const layout = useMemo(() => resolveDock(can), [can]);
  const actions = useMemo(() => quickActions(can), [can]);

  const link = (n: NavItem) => {
    const on = isActive(n, pathname);
    const Icon = n.icon;
    return (
      <Link key={n.id} href={n.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
        <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
        <span>{n.short ?? n.label}</span>
        <NavBadge navId={n.id} />
      </Link>
    );
  };

  // Việc của các mục chỉ có trong Menu (không nằm trên dock) gom vào nút Menu
  const menuBadge = useBadgeRest([...layout.left, ...layout.right].map((n) => n.id));
  const isCtv = layout.profile === "ctv";
  // Đang ở trang chỉ có trong Menu (Sửa chữa, Báo cáo…) ⇒ sáng nút Menu để biết mình đang ở đâu
  const menuOn = menuOpen || (layout.last === "menu" && ![...layout.left, ...layout.right].some((n) => isActive(n, pathname)));
  return (
    <>
      <nav className={cx("wf-dock g", className)} aria-label="Điều hướng chính">
        {layout.left.map(link)}
        <button
          type="button"
          className="plus wf-dk"
          onClick={() => setPlusOpen(true)}
          aria-haspopup="dialog"
          aria-label={isCtv ? "Tạo đơn và hành động nhanh" : "Hành động nhanh"}
          disabled={actions.length === 0}
        >
          <i>
            <Plus size={28} strokeWidth={2.2} aria-hidden="true" />
          </i>
        </button>
        {layout.right.map(link)}
        {layout.last === "menu" ? (
          <button type="button" className={cx("wf-dk", menuOn && "on")} aria-current={menuOn && !menuOpen ? "page" : undefined} onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
            <Menu size={23} strokeWidth={1.8} aria-hidden="true" />
            <span>Menu</span>
            <Badge info={menuBadge} />
          </button>
        ) : (
          link(layout.last)
        )}
      </nav>
      <ActionSheet
        open={plusOpen}
        onClose={() => setPlusOpen(false)}
        actions={actions.map((a) => {
          const Icon = a.icon;
          return { id: a.id, label: a.label, href: a.href, tone: a.tone, icon: <Icon size={20} aria-hidden="true" /> };
        })}
      />
      {layout.last === "menu" && <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} can={can} user={user} onLogout={onLogout} />}
    </>
  );
}
