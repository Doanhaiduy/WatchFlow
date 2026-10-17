"use client";
import { Download, PackagePlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { useDebounced } from "@/components/trade/useDebounced";
import type { PurchaseListItem } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { DateRange } from "@/components/ui/DateInput";
import { Select, TextInput } from "@/components/ui/TextInput";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { KIND_LABELS } from "@/lib/types/purchases";

const PAGE = 25;

export default function PurchasesPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [status, setStatus] = useState<string[]>([]);
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, status, kind, from, to]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (status[0]) p.set("status", status[0]);
  if (kind) p.set("kind", kind);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const { data, error, isLoading, mutate } = useSWR<{ items: PurchaseListItem[]; total: number }>(can("purchase.view") ? `/api/v1/purchases?${p}` : null, swrFetcher, { keepPreviousData: true });
  const filtered = !!(dq || status.length || kind || from || to);
  const exportQs = new URLSearchParams();
  if (status[0]) exportQs.set("status", status[0]);
  if (from) exportQs.set("from", from);
  if (to) exportQs.set("to", to);

  return (
    <>
      <PageHeader
        title="Nhập hàng"
        description="Phiếu nhập đồng hồ và linh kiện"
        actions={(<>{can("report.export") && <Button sm icon={<Download size={16} aria-hidden="true" />} onClick={() => (window.location.href = `/api/v1/purchases/export?${exportQs}`)}>Xuất Excel</Button>}{can("purchase.create") && <Button sm variant="primary" href="/nhap-hang/moi" icon={<Plus size={16} aria-hidden="true" />}>Lập phiếu</Button>}</>)}
      />
      <RequirePerm perm="purchase.view">
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã phiếu, nguồn hàng, người bán…" />
        <FilterChips ariaLabel="Lọc theo trạng thái" value={status} onChange={setStatus} options={[{ value: "draft", label: "Nháp" }, { value: "confirmed", label: "Đã xác nhận" }, { value: "voided", label: "Đã hủy" }]} />
        <div className="g wf-pad" style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <Field label="Loại phiếu"><Select placeholder="Mọi loại" value={kind} onChange={(e) => setKind(e.target.value)} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Khoảng ngày chứng từ">
            <div className="wf-dev-row" style={{ flexWrap: "nowrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}><DateRange from={from} to={to} onChange={(r) => { setFrom(r.from); setTo(r.to); }} /></div>
              {from && to && <Button sm onClick={() => { setFrom(""); setTo(""); }}>Xóa</Button>}
            </div>
          </Field>
        </div>
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={filtered ? "search" : "plain"} icon={<PackagePlus size={24} />} title={filtered ? "Không có phiếu nhập khớp" : "Bạn chưa có phiếu nhập"} description={filtered ? "Thử bỏ bớt bộ lọc." : "Bắt đầu bằng việc lập phiếu nhập đầu tiên."} action={!filtered && can("purchase.create") ? { label: "Lập phiếu nhập", href: "/nhap-hang/moi" } : undefined} />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách phiếu nhập">
              {data?.items.map((r) => (
                <InsetRow
                  key={r.id}
                  href={`/nhap-hang/${r.id}`}
                  icon={<PackagePlus size={20} aria-hidden="true" />}
                  tone={r.status === "confirmed" ? "ok" : r.status === "voided" ? "bad" : "neutral"}
                  title={r.code ?? "Phiếu nháp"}
                  subtitle={[r.sellerName ?? r.sourceName, formatDateVn(r.docDate), KIND_LABELS[r.kind] ?? r.kind, `${r.lineCount} dòng`].filter(Boolean).join(" · ")}
                  end={formatVnd(r.grandTotal)}
                  endSub={<StatusChip kind="doc" status={r.status} />}
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
