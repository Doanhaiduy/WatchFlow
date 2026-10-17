"use client";
import { ClipboardList, Plus } from "lucide-react";
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
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

const PAGE = 25;
type Res = { items: SaleListItem[]; total: number; dueTotal: number };

export default function SalesPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [f, setF] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, f]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (f[0] === "due") p.set("due", "true");
  else if (f[0] === "ctv") p.set("status", "draft");
  else if (f[0]) p.set("status", f[0]);
  if (!can("sale.view")) p.set("mine", "1");
  const { data, error, isLoading, mutate } = useSWR<Res>(can(["sale.view", "sale.view_own"]) ? `/api/v1/sales?${p}` : null, swrFetcher, { keepPreviousData: true });

  return (
    <>
      <PageHeader title="Bán hàng" description="Phiếu bán, công nợ và thu thêm" actions={can("sale.create_draft") ? <Button sm variant="primary" href="/ban-hang/moi" icon={<Plus size={16} aria-hidden="true" />}>Bán hàng</Button> : undefined} />
      <RequirePerm perm={["sale.view", "sale.view_own"]}>
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã phiếu, tên hoặc SĐT khách…" />
        <FilterChips ariaLabel="Lọc phiếu bán" value={f} onChange={setF} options={[{ value: "confirmed", label: "Đã xác nhận" }, { value: "draft", label: "Nháp" }, { value: "voided", label: "Đã hủy" }, { value: "due", label: "Còn nợ" }, { value: "ctv", label: "Đơn CTV chờ xác nhận" }]} />
        {f[0] === "due" && data && <div className="g wf-pad" style={{ marginBottom: 12 }}><p className="wf-mute">Tổng còn nợ (theo bộ lọc)</p><div className="wf-uprice" style={{ color: "var(--wf-hold-text)" }}>{formatVnd(data.dueTotal)}</div></div>}
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant={dq || f.length ? "search" : "plain"} icon={<ClipboardList size={24} />} title={dq || f.length ? "Không có phiếu khớp" : "Bạn chưa có phiếu bán"} description={dq || f.length ? "Thử bỏ bộ lọc." : "Bắt đầu bằng việc bán chiếc đầu tiên."} action={!dq && !f.length && can("sale.create_draft") ? { label: "Bán hàng", href: "/ban-hang/moi" } : undefined} /></div>
        ) : (
          <>
            <InsetList label="Danh sách phiếu bán">
              {data?.items.filter((s) => f[0] !== "ctv" || s.collaboratorId).map((s) => (
                <InsetRow
                  key={s.id}
                  href={s.status === "draft" && !s.collaboratorId ? `/ban-hang/moi?sale=${s.id}` : `/ban-hang/${s.id}`}
                  icon={<ClipboardList size={20} aria-hidden="true" />}
                  tone={s.status === "confirmed" ? ((s.due ?? 0) > 0 ? "hold" : "ok") : s.status === "voided" ? "bad" : "neutral"}
                  title={s.code ?? (s.collaboratorId ? "Đơn CTV chờ xác nhận" : "Phiếu nháp")}
                  subtitle={[s.customerName ?? "Khách lẻ", formatDateVn(s.docDate), s.items].filter(Boolean).join(" · ")}
                  end={formatVnd(s.grandTotal)}
                  endSub={(s.due ?? 0) > 0 ? <StatusChip kind="doc" status="debt" label={`Nợ ${formatVnd(s.due ?? 0)}`} /> : <StatusChip kind="doc" status={s.status} />}
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
