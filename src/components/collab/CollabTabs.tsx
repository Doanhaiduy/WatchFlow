"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";

const TABS = [
  { href: "/cong-tac-vien", label: "Cộng tác viên", exact: true },
  { href: "/cong-tac-vien/hang", label: "Hàng đang giao" },
  { href: "/cong-tac-vien/bao-ban", label: "Báo bán", badge: true },
];

/** Thanh chuyển giữa 3 màn của chủ: danh sách CTV · hàng đang giao · báo bán chờ xác nhận (kèm số chờ) */
export function CollabTabs() {
  const pathname = usePathname();
  const { can } = useSession();
  const { data } = useSWR<{ total: number }>(can(["sale.confirm", "collab.view"]) ? "/api/v1/collab/claims?status=pending&pageSize=1" : null, swrFetcher, { refreshInterval: 60_000 });
  return (
    <nav className="wf-tabs-l" aria-label="Mục cộng tác viên">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={(t.exact ? pathname === t.href : pathname.startsWith(t.href)) ? "page" : undefined}>
          {t.label}
          {t.badge && (data?.total ?? 0) > 0 ? ` (${data!.total})` : ""}
        </Link>
      ))}
    </nav>
  );
}
