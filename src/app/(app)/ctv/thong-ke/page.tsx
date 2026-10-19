"use client";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { BarChart } from "@/components/charts/BarChart";
import type { MyStats } from "@/components/collab/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { KpiGrid, KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";

type Period = "day" | "month" | "quarter" | "year";
const PERIODS = [{ value: "day", label: "Ngày" }, { value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }] as const;

/** "Tháng 10/2026" · "Quý 4/2026" · "Năm 2026" · "17/10/2026" từ ngày đầu kỳ (yyyy-mm-dd) */
function periodLabel(period: Period, start: string): string {
  const y = start.slice(0, 4), m = Number(start.slice(5, 7));
  if (period === "year") return `Năm ${y}`;
  if (period === "quarter") return `Quý ${Math.floor((m - 1) / 3) + 1}/${y}`;
  if (period === "day") return `${start.slice(8, 10)}/${start.slice(5, 7)}/${y}`;
  return `Tháng ${String(m).padStart(2, "0")}/${y}`;
}

// Thống kê của tôi: CHỈ số chiếc bán được (BR-COL-17). Không có tiền.
export default function CtvStatsPage() {
  const { can } = useSession();
  const [period, setPeriod] = useState<Period>("month");
  const { data, error, isLoading, mutate } = useSWR<MyStats>(can("collab.view_own") ? `/api/v1/collab/me/stats?period=${period}` : null, swrFetcher);
  const bars = (data?.rows ?? []).map((r) => ({ label: r.periodStart.slice(period === "day" ? 5 : 0, 10 - (period === "day" ? 0 : 3)), value: r.unitsSold }));
  return (
    <>
      <PageHeader title="Thống kê của tôi" description="Số chiếc bạn bán được" />
      <RequirePerm perm="collab.view_own">
        <div className="wf-stack">
          <SegmentedControl ariaLabel="Kỳ thống kê" value={period} onChange={setPeriod} options={[...PERIODS]} />
          {isLoading ? <Skeleton h={160} radius={26} /> : error || !data ? (
            <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
          ) : data.rows.length === 0 ? (
            <div className="g wf-pad"><EmptyState icon={<BarChart3 size={24} />} title="Chưa bán được chiếc nào trong kỳ" description={`Từ ${data.from} đến ${data.to}`} /></div>
          ) : (
            <>
              <KpiGrid><KpiTile label="Tổng số chiếc đã bán" value={data.total} /></KpiGrid>
              {bars.length > 1 && <section className="g wf-pad"><h3 style={{ fontSize: 15, fontWeight: 700 }}>Số chiếc theo kỳ</h3><BarChart data={bars} ariaLabel="Số chiếc bán được theo kỳ" /></section>}
              <ul className="wf-rcards" aria-label="Chi tiết theo kỳ">
                {data.rows.map((r) => (
                  <li key={r.periodStart} className="wf-rcard">
                    <b className="wf-rcard-h">{periodLabel(period, r.periodStart)}</b>
                    <dl className="wf-kv"><div><dt>Số chiếc bán</dt><dd className="wf-num">{r.unitsSold}</dd></div></dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </RequirePerm>
    </>
  );
}
