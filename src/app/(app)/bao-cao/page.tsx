"use client";
import { BarChart3, FileClock, Handshake, Watch, type LucideIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { Donut } from "@/components/charts/Donut";
import { REPORTS } from "@/components/reports/meta";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Tone } from "@/components/ui/cx";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVndShort } from "@/lib/money";
import { useSession } from "@/lib/session";

type Period = "7d" | "month" | "quarter" | "year";
type Series = {
  series: { revenue?: Array<{ period: string; revenue: number; shopRevenue: number; collabRevenue: number; repairRevenue: number; unitsSold: number }> };
  stockByBrand?: Array<{ name: string; count: number }>;
};

/** Mỗi báo cáo một biểu tượng + màu riêng để nhận ra nhanh */
const LOOK: Record<string, { icon: LucideIcon; tone: Tone }> = { revenue: { icon: BarChart3, tone: "info" }, units: { icon: Watch, tone: "check" }, collab: { icon: Handshake, tone: "ok" } };

const axis = (p: string, monthly: boolean) => (monthly ? `T${Number(p.slice(5, 7))}` : `${p.slice(8, 10)}/${p.slice(5, 7)}`);
const PAL = ["var(--wf-accent)", "var(--wf-ok)", "var(--wf-repair)", "var(--wf-info)", "var(--wf-check)", "var(--wf-hold)", "var(--wf-neutral)", "var(--wf-bad)"];

// Báo cáo (CF-17): doanh thu, số lượng đồng hồ, cộng tác viên — theo ngày/tháng/quý/năm.
export default function ReportsIndex() {
  const { can } = useSession();
  const list = REPORTS.filter((r) => can(r.perm));
  const [period, setPeriod] = useState<Period>("month");
  const canChart = can("report.sales");
  const main = useSWR<Series>(canChart ? `/api/v1/reports/dashboard?period=${period}` : null, swrFetcher, { keepPreviousData: true, revalidateOnFocus: false });
  const brands = (main.data?.stockByBrand ?? []).map((b) => ({ label: b.name, value: b.count }));

  const rev = main.data?.series.revenue ?? [];
  const monthly = period === "year" || period === "quarter";
  const a = rev.map((r) => ({ label: axis(r.period, monthly), value: Number(r.revenue) }));
  const units = rev.map((r) => ({ label: axis(r.period, monthly), value: Number(r.unitsSold) }));
  const hasA = a.length > 1 && a.some((d) => d.value !== 0);
  const hasU = units.length > 0 && units.some((d) => d.value > 0);

  return (
    <>
      <PageHeader title="Báo cáo" description="Doanh thu, số lượng đồng hồ và cộng tác viên — chọn báo cáo để xem, xuất Excel hoặc in" />
      <RequirePerm perm={["report.sales", "report.inventory", "collab.view"]}>
        <div className="wf-rep">
          <div className="wf-stack" style={{ minWidth: 0 }}>
            {canChart && (
              <>
                <SegmentedControl ariaLabel="Kỳ xem biểu đồ" value={period} onChange={setPeriod} options={[{ value: "7d", label: "7 ngày" }, { value: "month", label: "Tháng này" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]} />
                <section className="g wf-pad" aria-label="Doanh thu">
                  <div className="wf-ch">
                    <h3>
                      Doanh thu
                      {rev.length > 1 && <span className="sub">{formatDateVn(rev[0]!.period)} – {formatDateVn(rev[rev.length - 1]!.period)}</span>}
                    </h3>
                  </div>
                  {hasA ? (
                    <AreaChart data={a} color="var(--wf-accent)" format={formatVndShort} ariaLabel="Doanh thu theo kỳ" />
                  ) : (
                    <p className="wf-mute" style={{ padding: "18px 4px 6px" }}>{main.isLoading ? "Đang tải biểu đồ…" : "Chưa có doanh thu trong kỳ này."}</p>
                  )}
                </section>
                {hasU && (
                  <section className="g wf-pad" aria-label="Số chiếc bán">
                    <div className="wf-ch"><h3>Số chiếc bán<span className="sub">cửa hàng + CTV</span></h3></div>
                    <div style={{ marginTop: 10 }}>
                      <BarChart data={units} ariaLabel="Số chiếc bán theo kỳ" height={150} />
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
          <div className="wf-stack" style={{ minWidth: 0 }}>
            {brands.length > 0 && (
              <section className="g wf-pad" aria-label="Tồn kho theo hãng">
                <div className="wf-ch"><h3>Đang có trong kho theo hãng</h3></div>
                <div style={{ marginTop: 12 }}>
                  <Donut segments={brands.map((x, i) => ({ ...x, color: PAL[i % PAL.length] }))} size={124} stroke={19} center={{ title: brands.reduce((s, x) => s + x.value, 0), caption: "chiếc" }} ariaLabel="Số chiếc trong kho theo hãng" />
                </div>
              </section>
            )}
            <InsetList label="Danh sách báo cáo">
              {list.map((r) => {
                const look = LOOK[r.code] ?? { icon: BarChart3, tone: "info" as Tone };
                return <InsetRow key={r.code} href={`/bao-cao/${r.slug}`} icon={<look.icon size={20} aria-hidden="true" />} tone={look.tone} title={r.title} subtitle={r.desc} />;
              })}
              {can("audit.view") && <InsetRow href="/quan-tri/nhat-ky" icon={<FileClock size={20} aria-hidden="true" />} tone="neutral" title="Nhật ký hoạt động" subtitle="Ai đã làm gì, khi nào" />}
            </InsetList>
          </div>
        </div>
      </RequirePerm>
    </>
  );
}
