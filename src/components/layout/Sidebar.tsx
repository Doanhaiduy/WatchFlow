"use client";
import Link from "next/link";
import { LogOut, Watch } from "lucide-react";
import { useMemo } from "react";
import { cx } from "../ui/cx";
import { NavBadge } from "./badges";
import { ThemeSwitch } from "../ui/ThemeSwitch";
import { initials, type ShellUser } from "./MenuSheet";
import { ADMIN_TABS, allowed, isActive, menuGroups, roleLabel, type CanFn } from "./nav";

type Props = {
  pathname: string;
  can: CanFn;
  user: ShellUser;
  onLogout: () => void;
  className?: string;
};

/** Sidebar đảo nổi bằng kính (máy tính ≥ 1000px): logo, nhóm mục có nhãn in hoa nhỏ, thẻ người dùng dưới đáy (§4.2). */
export function Sidebar({ pathname, can, user, onLogout, className }: Props) {
  const groups = useMemo(() => menuGroups(can), [can]);
  return (
    <aside className={cx("wf-isl g", className)}>
      <div className="wf-brand">
        <i aria-hidden="true">
          <Watch size={22} />
        </i>
        <span>
          WatchFlow
          <small>Quản lý cửa hàng đồng hồ</small>
        </span>
      </div>
      <nav aria-label="Menu chính" className="wf-isl-nav">
        {groups.map((g) => (
          <div key={g.id}>
            <h6>{g.label}</h6>
            {g.items.map((n) => {
              const Icon = n.icon;
              const on = isActive(n, pathname);
              return (
                <div key={n.id}>
                  <Link href={n.href} className="wf-nl" aria-current={on ? "page" : undefined}>
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    {n.label}
                    <NavBadge navId={n.id} inline />
                  </Link>
                  {n.id === "admin" &&
                    pathname.startsWith("/quan-tri") &&
                    ADMIN_TABS.filter((t) => allowed(t, can)).map((t) => (
                      <Link key={t.href} href={t.href} className="wf-nl sub" aria-current={pathname.startsWith(t.href) ? "page" : undefined}>
                        {t.label}
                      </Link>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ margin: "12px 2px 10px" }}>
        <ThemeSwitch compact />
      </div>
      <div className="wf-me" style={{ marginTop: 0 }}>
        <span className="av" aria-hidden="true">
          {initials(user.fullName)}
        </span>
        <span className="tx">
          <b>{user.fullName}</b>
          <small>{user.roles?.[0] ? roleLabel(user.roles[0]) : (user.email ?? "")}</small>
        </span>
        <button type="button" className="wf-cb" onClick={onLogout} aria-label="Đăng xuất">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
