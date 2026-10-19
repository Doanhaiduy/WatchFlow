"use client";
import { Inbox, PackageCheck, Plus, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { repairTotal, type RepairListItem } from "@/components/repairs/types";
import { useDebounced } from "@/components/trade/useDebounced";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusInfo } from "@/components/ui/status";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

const STATUSES = ["received", "inspecting", "repairing", "waiting_parts", "completed", "delivered", "cancelled"] as const;

// Sửa chữa (chỉ chủ): máy khách mang đến sửa — nhận máy, theo dõi tiến độ, giao máy, tiền sửa (CF-16).
export default function RepairsPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [st, setSt] = useState<string[]>(["open"]);
  const [size, setSize] = useState(30);
  useEffect(() => setSize(30), [dq, st]);
  const p = new URLSearchParams({ pageSize: String(size) });
  if (dq) p.set("q", dq);
  const s0 = st[0] ?? "open";
  p.set("status", s0 === "open" ? "received,inspecting,repairing,waiting_parts,completed" : s0);
  const { data, error, isLoading, mutate } = useSWR<{ items: RepairListItem[]; counts: Record<string, number> }>(can("repair.view") ? `/api/v1/repairs?${p}` : null, swrFetcher, { keepPreviousData: true });
  const counts = data?.counts ?? {};
  const open = ["received", "inspecting", "repairing", "waiting_parts", "completed"].reduce((a, k) => a + (counts[k] ?? 0), 0);

  return (
    <>
      <PageHeader title="Sửa chữa" description="Nhận máy của khách, theo dõi tiến độ, giao máy" actions={can("repair.create") ? <Button sm variant="primary" href="/sua-chua/moi" icon={<Plus size={16} aria-hidden="true" />}>Nhận máy</Button> : undefined} />
      <RequirePerm perm="repair.view">
        {data && (
          <StatStrip
            items={[
              { label: "Mới nhận", value: counts.received ?? 0, icon: <Inbox size={16} />, tone: "info", hint: "chưa kiểm tra", onClick: () => setSt(["received"]), active: s0 === "received" },
              { label: "Đang sửa", value: (counts.repairing ?? 0) + (counts.inspecting ?? 0) + (counts.waiting_parts ?? 0), icon: <Wrench size={16} />, tone: "repair", hint: "kiểm tra, sửa, chờ linh kiện", onClick: () => setSt(["repairing,inspecting,waiting_parts"]), active: s0 === "repairing,inspecting,waiting_parts" },
              { label: "Chờ giao", value: counts.completed ?? 0, icon: <PackageCheck size={16} />, tone: "ok", hint: "sửa xong, khách chưa lấy", onClick: () => setSt(["completed"]), active: s0 === "completed" },
            ]}
          />
        )}
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã phiếu, khách, SĐT, serial…" />
        <FilterChips ariaLabel="Lọc trạng thái" value={st} onChange={(v) => setSt(v.length ? v : ["open"])} options={[{ value: "open", label: "Đang xử lý", count: open }, ...STATUSES.map((s) => ({ value: s, label: statusInfo("repair", s).label, count: counts[s] ?? 0 }))]} />
        {isLoading ? <SkeletonList rows={5} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant={dq ? "search" : "plain"} icon={<Wrench size={24} />} title={dq ? "Không có phiếu khớp" : "Chưa có phiếu sửa nào"} description={dq ? "Thử mã phiếu, serial hoặc số điện thoại khác." : "Khi khách mang đồng hồ đến sửa, bấm “Nhận máy” để lưu thông tin."} action={!dq && can("repair.create") ? { label: "Nhận máy", href: "/sua-chua/moi" } : undefined} /></div>
        ) : (
          <>
            <InsetList label="Danh sách phiếu sửa">
              {data?.items.map((r) => (
                <InsetRow
                  key={r.id}
                  href={`/sua-chua/${r.id}`}
                  thumb={<ProgressRing value={r.progress} size={44} stroke={5} tone={r.status === "cancelled" ? "bad" : r.status === "waiting_parts" ? "hold" : r.progress >= 90 ? "ok" : "repair"} />}
                  title={`${r.watchLabel ?? "Đồng hồ"}${r.serialNo ? ` · ${r.serialNo}` : ""}`}
                  subtitle={`${r.code} · ${r.customerName ?? "Khách"}${r.expectedDate ? ` · hẹn ${formatDateVn(r.expectedDate)}` : ""}`}
                  end={repairTotal(r) ? formatVnd(repairTotal(r)) : undefined}
                  endSub={<StatusChip kind="repair" status={r.status} />}
                />
              ))}
            </InsetList>
            {data && data.items.length >= size && <div style={{ textAlign: "center", marginTop: 14 }}><Button onClick={() => setSize((n) => n + 30)}>Xem thêm</Button></div>}
          </>
        )}
      </RequirePerm>
    </>
  );
}
