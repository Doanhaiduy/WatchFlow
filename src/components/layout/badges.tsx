"use client";
// Huy hiệu số việc trên điều hướng (FR-NAV-02). Port ý tưởng InboxBadge + syncAppBadge của dự án mẫu (ref-sources/domus-francis):
// đỏ khi có việc quá hạn, vàng khi chỉ đang chờ; rê chuột/đọc màn hình thấy từng loại việc; tổng số lên biểu tượng ứng dụng (PWA).
// Dữ liệu: GET /api/v1/me/badges (đếm theo QUYỀN, 60 giây một lần + khi quay lại tab). Chỉ UX — máy chủ vẫn kiểm quyền từng màn.
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { cx } from "../ui/cx";
import "./shell-extras.css";

export type BadgeItem = { key: string; navId: string; label: string; count: number; overdue: number };
type Payload = { items: BadgeItem[]; total: number; overdue: number };
export type NavBadgeInfo = { count: number; overdue: number; items: BadgeItem[] };

type Ctx = { items: BadgeItem[]; total: number; overdue: number };
const BadgesCtx = createContext<Ctx | null>(null);

export const BADGES_KEY = "/api/v1/me/badges";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
let lastApp = -1;
/** Số trên biểu tượng ứng dụng đã cài (PWA); trình duyệt không hỗ trợ/chưa cho phép ⇒ bỏ qua êm */
export function syncAppBadge(count: number) {
  try {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;
    const n = Math.max(0, Math.min(Math.floor(count), 999));
    if (n === lastApp) return;
    lastApp = n;
    const p = n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge ? nav.clearAppBadge() : nav.setAppBadge(0);
    void p?.catch?.(() => {});
  } catch {
    /* NotAllowedError… — bỏ qua */
  }
}

/** Tải số việc khi `enabled` (đã có phiên hợp lệ); làm mới 60 giây + khi quay lại tab */
export function BadgesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { data } = useSWR<Payload>(enabled ? BADGES_KEY : null, swrFetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    focusThrottleInterval: 15_000,
    shouldRetryOnError: false,
  });
  const value = useMemo<Ctx>(() => ({ items: data?.items ?? [], total: data?.total ?? 0, overdue: data?.overdue ?? 0 }), [data]);
  useEffect(() => {
    if (enabled) syncAppBadge(value.total);
  }, [enabled, value.total]);
  return <BadgesCtx.Provider value={value}>{children}</BadgesCtx.Provider>;
}

/** Số việc của MỘT mục điều hướng (`null` khi không có việc hoặc ngoài khung ứng dụng) */
export function useNavBadge(navId: string): NavBadgeInfo | null {
  const c = useContext(BadgesCtx);
  return useMemo(() => {
    if (!c) return null;
    const items = c.items.filter((i) => i.navId === navId);
    const count = items.reduce((s, i) => s + i.count, 0);
    return count > 0 ? { count, overdue: items.reduce((s, i) => s + i.overdue, 0), items } : null;
  }, [c, navId]);
}

/** Tra số việc theo id mục (dùng khi cần quyết định có vẽ ô hay không, vd. cột phải của InsetRow) */
export function useBadgeLookup(): (navId: string) => NavBadgeInfo | null {
  const c = useContext(BadgesCtx);
  return useCallback(
    (navId: string) => {
      if (!c) return null;
      const items = c.items.filter((i) => i.navId === navId);
      const count = items.reduce((s, i) => s + i.count, 0);
      return count > 0 ? { count, overdue: items.reduce((s, i) => s + i.overdue, 0), items } : null;
    },
    [c],
  );
}

/** Tổng số việc của các mục KHÔNG nằm trong `excludeIds` (vd. mục chỉ có trong Menu của dock) */
export function useBadgeRest(excludeIds: readonly string[]): NavBadgeInfo | null {
  const c = useContext(BadgesCtx);
  const key = excludeIds.join("|");
  return useMemo(() => {
    if (!c) return null;
    const ex = new Set(key.split("|"));
    const items = c.items.filter((i) => !ex.has(i.navId));
    const count = items.reduce((s, i) => s + i.count, 0);
    return count > 0 ? { count, overdue: items.reduce((s, i) => s + i.overdue, 0), items } : null;
  }, [c, key]);
}

const summarize = (b: NavBadgeInfo) => b.items.map((i) => `${i.label}: ${i.count}${i.overdue ? ` (${i.overdue} quá hạn)` : ""}`).join("\n");

/** Viên số: đỏ nếu có việc quá hạn, vàng nếu chỉ chờ. `inline` = nằm trong hàng (sidebar/menu); mặc định = nằm góc biểu tượng (dock). */
export function Badge({ info, inline, className }: { info: NavBadgeInfo | null; inline?: boolean; className?: string }) {
  if (!info) return null;
  const urgent = info.overdue > 0;
  return (
    <span className={cx("wf-nb", urgent ? "bad" : "warn", inline && "inline", className)} title={summarize(info)}>
      <span aria-hidden="true">{info.count > 99 ? "99+" : info.count}</span>
      <span className="wf-sr">
        {" "}
        {info.count} việc cần xử lý{urgent ? `, ${info.overdue} quá hạn` : ""}
      </span>
    </span>
  );
}

/** Huy hiệu của một mục điều hướng theo id */
export function NavBadge({ navId, inline, className }: { navId: string; inline?: boolean; className?: string }) {
  return <Badge info={useNavBadge(navId)} inline={inline} className={className} />;
}
