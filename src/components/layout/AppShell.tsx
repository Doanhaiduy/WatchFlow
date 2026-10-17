"use client";
import { Lock } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { EmptyState } from "../ui/EmptyState";
import { OfflineBanner } from "../ui/OfflineBanner";
import { ShellMetaProvider, useShellMeta } from "../ui/shell-meta";
import { Skeleton, SkeletonGroup, SkeletonKpis, SkeletonList } from "../ui/Skeleton";
import { BadgesProvider } from "./badges";
import { CommandPalette } from "./CommandPalette";
import { Dock } from "./Dock";
import type { ShellUser } from "./MenuSheet";
import { canFromPerms, quickActions, type CanFn } from "./nav";
import { OpsBanner } from "./OpsBanner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export type DemoUser = { fullName: string; roles?: string[]; email?: string; perms: readonly string[] };

type Props = {
  children: ReactNode;
  /** Có chấm đỏ ở chuông thông báo */
  unread?: boolean;
  /** Chỉ cho trang mẫu/test: dùng người dùng giả, KHÔNG gọi useSession */
  demoUser?: DemoUser;
  /** Ghi đè đường dẫn hiện tại (trang mẫu) */
  pathnameOverride?: string;
};

function Frame({ children, pathname, can, user, onLogout, unread, live = true }: { children: ReactNode; pathname: string; can: CanFn; user: ShellUser; onLogout: () => void; unread: boolean; live?: boolean }) {
  const primary = useMemo(() => quickActions(can)[0], [can]);
  return (
    <ShellMetaProvider unread={unread} search={can("catalog.view")}>
     <BadgesProvider enabled={live}>
      <a href="#main" className="wf-skip">
        Bỏ qua điều hướng
      </a>
      <OfflineBanner />
      <div className="wf-shell">
        <Sidebar className="hidden desk:flex" pathname={pathname} can={can} user={user} onLogout={onLogout} />
        <div style={{ minWidth: 0 }}>
          <TopBarWithMeta className="hidden desk:flex" pathname={pathname} unread={unread} primary={primary} search={can("catalog.view")} />
          {live && <OpsBanner can={can} />}
          <main id="main" className="wf-pg">
            <div key={pathname} className="wf-route">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Dock className="desk:hidden" pathname={pathname} can={can} user={user} onLogout={onLogout} />
      {live && <CommandPalette can={can} />}
     </BadgesProvider>
    </ShellMetaProvider>
  );
}

function TopBarWithMeta(p: React.ComponentProps<typeof TopBar>) {
  const meta = useShellMeta()?.meta;
  return <TopBar {...p} title={meta?.title} description={meta?.description} />;
}

/** Khung tải: giữ bố cục để không nhảy khi phiên tải xong */
function ShellSkeleton() {
  return (
    <div className="wf-pg" style={{ minHeight: "100vh" }} role="status" aria-busy="true" aria-label="Đang tải phiên đăng nhập">
      <div className="wf-lt" style={{ display: "grid", gap: 12 }}>
        <Skeleton w={120} h={12} />
        <Skeleton w={220} h={34} radius={12} />
      </div>
      <SkeletonGroup className="wf-stack">
        <SkeletonKpis />
        <SkeletonList rows={4} />
      </SkeletonGroup>
    </div>
  );
}

function SessionShell({ children, unread }: { children: ReactNode; unread: boolean }) {
  const pathname = usePathname();
  const { user, loading, can, logout } = useSession();
  const shellUser = useMemo<ShellUser | null>(() => (user ? { fullName: user.fullName, email: user.email, roles: user.roles } : null), [user]);
  if (loading) return <ShellSkeleton />;
  if (!user || !shellUser) {
    return (
      <div className="wf-pg" style={{ paddingTop: 80 }}>
        <EmptyState
          title="Phiên đăng nhập đã hết"
          description="Đăng nhập lại để tiếp tục làm việc."
          icon={<Lock size={24} aria-hidden="true" />}
          action={{ label: "Đăng nhập", href: "/dang-nhap" }}
        />
      </div>
    );
  }
  return (
    <Frame pathname={pathname} can={can} user={shellUser} onLogout={() => void logout()} unread={unread}>
      {children}
    </Frame>
  );
}

function DemoShell({ children, unread, demoUser, pathnameOverride }: { children: ReactNode; unread: boolean; demoUser: DemoUser; pathnameOverride?: string }) {
  const real = usePathname();
  const can = useMemo(() => canFromPerms(demoUser.perms), [demoUser.perms]);
  return (
    <Frame pathname={pathnameOverride ?? real} can={can} user={demoUser} onLogout={() => {}} unread={unread} live={false}>
      {children}
    </Frame>
  );
}

/**
 * Khung ứng dụng: Sidebar + TopBar (≥ 1000px) hoặc Dock (< 1000px), theo quyền của phiên.
 * Dùng trong layout của nhóm route có đăng nhập. `loading` ⇒ Skeleton; chưa đăng nhập ⇒ gợi ý đăng nhập.
 * `demoUser` (trang /dev/design) thay `useSession()` bằng người dùng giả.
 */
export function AppShell({ children, unread = false, demoUser, pathnameOverride }: Props) {
  if (demoUser) return <DemoShell unread={unread} demoUser={demoUser} pathnameOverride={pathnameOverride}>{children}</DemoShell>;
  return <SessionShell unread={unread}>{children}</SessionShell>;
}
