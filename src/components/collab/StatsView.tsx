"use client";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { errMsg } from "../auth/helpers";
import { BarChart } from "../charts/BarChart";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { KpiGrid, KpiTile } from "../ui/KpiTile";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Skeleton } from "../ui/Skeleton";
import { Select } from "../ui/TextInput";
import { swrFetcher } from "@/lib/api-client";
import { formatVnd, formatVndShort } from "@/lib/money";
import { n, type CollabRow, type Stats } from "./types";

/** "Tháng 10/2026" · "Quý 4/2026" · "Năm 2026" từ ngày đầu kỳ (yyyy-mm-dd) */
function periodLabel(period: "month" | "quarter" | "year", start: string): string {
  const y = start.slice(0, 4);
  const m = Number(start.slice(5, 7));
  if (period === "year") return `Năm ${y}`;
  if (period === "quarter") return `Quý ${Math.floor((m - 1) / 3) + 1}/${y}`;
  return `Tháng ${String(m).padStart(2, "0")}/${y}`;
}

/** Thống kê CTV theo tháng/quý/năm (R9). `endpoint`: /reports/collaborators (chủ, có chọn CTV) hoặc /collab/me/stats (CTV). */
export function StatsView({ endpoint, pickCollab }: { endpoint: string; pickCollab?: boolean }) {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [ctv, setCtv] = useState("");
  const list = useSWR<{ items: CollabRow[] }>(pickCollab ? "/api/v1/collaborators" : null, swrFetcher);
  const q = new URLSearchParams({ period });
  if (ctv) q.set("collaborator", ctv);
  const { data, error, isLoading, mutate } = useSWR<Stats>(`${endpoint}?${q}`, swrFetcher);

  // Gộp các dòng cùng kỳ (nhiều CTV) để vẽ cột theo kỳ
  const byPeriod = new Map<string, number>();
  for (const r of data?.rows ?? []) byPeriod.set(r.periodStart, (byPeriod.get(r.periodStart) ?? 0) + n(r.salesTotal));
  const bars = [...byPeriod.entries()].sort().map(([k, v]) => ({ label: k.slice(0, 7), value: v }));

  return (
    <div className="wf-stack">
      <SegmentedControl ariaLabel="Kỳ thống kê" value={period} onChange={setPeriod} options={[{ value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]} />
      {pickCollab && <Select aria-label="Chọn CTV" placeholder="Tất cả CTV" value={ctv} onChange={(e) => setCtv(e.target.value)} options={(list.data?.items ?? []).map((c) => ({ value: c.id, label: c.fullName }))} />}
      {isLoading ? <Skeleton h={160} radius={26} /> : error || !data ? (
        <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
      ) : data.rows.length === 0 ? (
        <div className="g wf-pad"><EmptyState icon={<BarChart3 size={24} />} title="Chưa có đơn bán trong kỳ" description={`Từ ${data.from} đến ${data.to}`} /></div>
      ) : (
        <>
          <KpiGrid>
            <KpiTile label="Số chiếc bán" value={data.totals.unitsSold} />
            <KpiTile label="Bán ra" value={formatVndShort(data.totals.salesTotal)} />
            <KpiTile label="Phải nộp" value={formatVndShort(data.totals.baseTotal)} />
            <KpiTile label="CTV hưởng" value={formatVndShort(data.totals.collabEarn)} />
            <KpiTile label="Đã nộp" value={formatVndShort(data.totals.settled)} hintTone="ok" />
            <KpiTile label="Chưa nộp" value={formatVndShort(data.totals.unsettled)} hintTone="hold" />
          </KpiGrid>
          {bars.length > 1 && <section className="g wf-pad"><h3 style={{ fontSize: 15, fontWeight: 700 }}>Doanh số bán ra theo kỳ</h3><BarChart data={bars} format={formatVndShort} ariaLabel="Doanh số bán ra theo kỳ" /></section>}
          <ul className="wf-rcards" aria-label="Chi tiết theo kỳ">
            {data.rows.map((r, i) => (
              <li key={i} className="wf-rcard">
                <b className="wf-rcard-h">{periodLabel(period, r.periodStart)}{pickCollab ? ` · ${r.collaboratorName}` : ""}</b>
                <dl className="wf-kv">
                  <div><dt>Số chiếc bán</dt><dd className="wf-num">{n(r.unitsSold)}</dd></div>
                  <div><dt>Bán ra</dt><dd className="wf-num">{formatVnd(n(r.salesTotal))}</dd></div>
                  <div><dt>Phải nộp</dt><dd className="wf-num">{formatVnd(n(r.baseTotal))}</dd></div>
                  <div><dt>CTV hưởng</dt><dd className="wf-num">{formatVnd(n(r.collabEarn))}</dd></div>
                  <div><dt>Đã nộp</dt><dd className="wf-num">{formatVnd(n(r.settled))}</dd></div>
                  <div><dt>Chưa nộp</dt><dd className="wf-num">{formatVnd(n(r.unsettled))}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
