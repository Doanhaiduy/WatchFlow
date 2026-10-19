"use client";
import { BarChart3, ClipboardList, Handshake, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { useDebounced } from "@/components/trade/useDebounced";
import type { SaleListItem } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd, formatVndShort } from "@/lib/money";
import { deltaPct } from "@/lib/series";
import { useSession } from "@/lib/session";
import { hasKpi, useDashKpis } from "@/lib/use-dashboard";

const PAGE = 25;
type Res = { items: SaleListItem[]; total: number; revenueTotal: number };

// Đơn bán đã ghi: khách mua chiếc nào, giá bao nhiêu, ngày nào — để tra cứu lại (CF-13). Không có công nợ/thanh toán.
export default function SalesPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [f, setF] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, f]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (f[0] === "voided") p.set("status", "voided");
  else if (f[0] === "shop" || f[0] === "collab") p.set("channel", f[0]);
  const { data, error, isLoading, mutate } = useSWR<Res>(can("sale.view") ? `/api/v1/sales?${p}` : null, swrFetcher, { keepPreviousData: true });
  const { kpis, prev } = useDashKpis(can("sale.view"));

  return (
    <>
      <PageHeader title="Bán hàng" description="Các đơn khách đã mua — tra cứu lại khi cần" actions={can("sale.confirm") ? <Button sm variant="primary" href="/ban-hang/moi" icon={<Plus size={16} aria-hidden="true" />}>Ghi đơn bán</Button> : undefined} />
      <RequirePerm perm="sale.view">
        <StatStrip
          items={[
            hasKpi(kpis, "revenue") && { label: "Doanh thu hôm nay", value: formatVndShort(kpis.revenue!), icon: <BarChart3 size={16} />, tone: "ok", delta: deltaPct(kpis.revenue, prev.revenue), hint: "so với hôm qua" },
            hasKpi(kpis, "invoiceCount") && { label: "Đơn hôm nay", value: kpis.invoiceCount!, icon: <ShoppingBag size={16} />, tone: "info", hint: hasKpi(kpis, "unitsSold") ? `${kpis.unitsSold} chiếc đã bán` : undefined },
            hasKpi(kpis, "collabPendingClaims") && (kpis.collabPendingClaims ?? 0) > 0 && { label: "CTV báo bán", value: kpis.collabPendingClaims!, icon: <Handshake size={16} />, tone: "hold", hint: "chờ xác nhận", href: "/cong-tac-vien/bao-ban" },
          ]}
        />
        <SearchBar value={q} onChange={setQ} placeholder="Tìm tên/SĐT khách, mã đơn, serial…" />
        <FilterChips ariaLabel="Lọc đơn bán" value={f} onChange={setF} options={[{ value: "shop", label: "Bán tại cửa hàng" }, { value: "collab", label: "CTV bán" }, { value: "voided", label: "Đã hủy" }]} />
        {data && f[0] !== "voided" && data.total > 0 && can("report.sales") && (
          <p className="wf-mute" style={{ padding: "0 4px 8px" }}>{data.total} đơn · tổng {formatVnd(data.revenueTotal)}</p>
        )}
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant={dq || f.length ? "search" : "plain"} icon={<ClipboardList size={24} />} title={dq || f.length ? "Không có đơn khớp" : "Chưa có đơn bán nào"} description={dq || f.length ? "Thử bỏ bộ lọc hoặc đổi từ khóa." : "Khi khách mua đồng hồ, bấm “Ghi đơn bán” để lưu lại."} action={!dq && !f.length && can("sale.confirm") ? { label: "Ghi đơn bán", href: "/ban-hang/moi" } : undefined} /></div>
        ) : (
          <>
            <InsetList label="Danh sách đơn bán">
              {data?.items.map((s) => (
                <InsetRow
                  key={s.id}
                  href={`/ban-hang/${s.id}`}
                  icon={s.collaboratorId ? <Handshake size={20} aria-hidden="true" /> : <ClipboardList size={20} aria-hidden="true" />}
                  tone={s.status === "voided" ? "bad" : s.collaboratorId ? "check" : "ok"}
                  title={s.customerName ?? "Khách lẻ"}
                  subtitle={[s.items, formatDateVn(s.docDate), s.collaboratorName ? `CTV ${s.collaboratorName}` : null].filter(Boolean).join(" · ")}
                  end={formatVnd(s.grandTotal)}
                  endSub={s.status === "voided" ? <StatusChip kind="doc" status="voided" /> : s.code}
                />
              ))}
            </InsetList>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </RequirePerm>
    </>
  );
}
