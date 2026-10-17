"use client";
import { LogOut } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "../ui/Button";
import { InsetList, InsetRow } from "../ui/InsetList";
import { Modal } from "../ui/Modal";
import { ThemeSwitch } from "../ui/ThemeSwitch";
import { Badge, useBadgeLookup } from "./badges";
import { isActive, menuGroups, roleLabel, type CanFn } from "./nav";

export type ShellUser = { fullName: string; email?: string; roles?: string[] };

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p.length > 1 ? p[p.length - 1]![0]! : p[0]?.[0]) ?? "?").toUpperCase();
}

type Props = {
  open: boolean;
  onClose: () => void;
  pathname: string;
  can: CanFn;
  user: ShellUser;
  onLogout: () => void;
};

/** Menu (mục cuối của dock): sheet toàn màn hình, các nhóm danh sách inset có biểu tượng màu theo tone (§4.1) */
export function MenuSheet({ open, onClose, pathname, can, user, onLogout }: Props) {
  const groups = useMemo(() => menuGroups(can), [can]);
  const badgeOf = useBadgeLookup();
  const first = useRef(pathname);
  // Đổi trang thì đóng menu
  useEffect(() => {
    if (first.current !== pathname) {
      first.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <Modal open={open} onClose={onClose} variant="full" title="Menu">
      {groups.map((g) => (
        <section key={g.id} className="wf-menu-grp" aria-label={g.label}>
          <h3 className="wf-menu-h">{g.label}</h3>
          <InsetList>
            {g.items.map((n) => {
              const Icon = n.icon;
              const badge = badgeOf(n.id);
              return (
                <InsetRow
                  key={n.id}
                  href={n.href}
                  title={n.label}
                  icon={<Icon size={20} aria-hidden="true" />}
                  tone={n.tone}
                  end={badge ? <Badge info={badge} inline /> : undefined}
                  className={isActive(n, pathname) ? "on" : undefined}
                />
              );
            })}
          </InsetList>
        </section>
      ))}
      <section className="wf-menu-grp g g-flat" style={{ padding: 14 }}>
        <div className="wf-me" style={{ marginBottom: 10 }}>
          <span className="av" aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className="tx">
            <b>{user.fullName}</b>
            <small>{user.roles?.[0] ? roleLabel(user.roles[0]) : (user.email ?? "")}</small>
          </span>
        </div>
        <p className="wf-menu-h" style={{ margin: "0 4px 8px" }} id="menu-theme-h">
          Giao diện
        </p>
        <ThemeSwitch className="wf-theme-sw" />
        <Button block style={{ marginTop: 12 }} icon={<LogOut size={18} aria-hidden="true" />} onClick={onLogout}>
          Đăng xuất
        </Button>
      </section>
    </Modal>
  );
}
