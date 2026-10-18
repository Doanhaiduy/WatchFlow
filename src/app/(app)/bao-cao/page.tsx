"use client";
import { BarChart3, Banknote, Boxes, ClipboardCheck, Clock, FileClock, Handshake, Receipt, ShieldCheck, TrendingUp, Truck, Wrench, type LucideIcon } from "lucide-react";
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
  series: { revenue?: Array<{ period: string; revenue: number; salesRevenue: number; repairRevenue: number }>; profit?: Array<{ period: string; grossProfit: number }> };
  kpis: Record<string, number | undefined>;
  stockByBrand?: Array<{ name: string; count: number }>;
};

/** Mỗi báo cáo một biểu tượng + màu riêng để nhận ra nhanh */
const LOOK: Record<string, { icon: LucideIcon; tone: Tone }> = {
  revenue: { icon: BarChart3, tone: "info" }, profit: { icon: TrendingUp, tone: "ok" }, moves: { icon: Truck, tone: "hold" }, stock: { icon: Boxes, tone: "check" },
  aging: { icon: Clock, tone: "repair" }, "open-balances": { icon: Receipt, tone: "bad" }, repairs: { icon: Wrench, tone: "repair" }, collections: { icon: Banknote, tone: "ok" },
  shrinkage: { icon: ClipboardCheck, tone: "bad" }, warranty: { icon: ShieldCheck, tone: "hold" },
};

const axis = (p: string, monthly: boolean) => (monthly ? `T${Number(p.slice(5, 7))}` : `${p.slice(8, 10)}/${p.slice(5, 7)}`);
const PAL = ["var(--wf-accent)", "var(--wf-ok)", "var(--wf-repair)", "var(--wf-info)", "var(--wf-check)", "var(--wf-hold)", "var(--wf-neutral)", "var(--wf-bad)"];

export default function ReportsIndex() {
  const { can } = useSession();
  const list = REPORTS.filter((r) => can(r.perm));
  const [period, setPeriod] = useState<Period>("month");
  const canChart = can(["report.sales", "profit.view"]);
  const main = useSWR<Series>(canChart ? `/api/v1/reports/dashboard?period=${period}` : null, swrFetcher, { keepPreviousData: true, revalidateOnFocus: false });
  const year = useSWR<Series>(canChart ? "/api/v1/reports/dashboard?period=year" : null, swrFetcher, { revalidateOnFocus: false });
  const brands = (year.data?.stockByBrand ?? main.data?.stockByBrand ?? []).map((b) => ({ label: b.name, value: b.count }));

  const rev = main.data?.series.revenue;
  const prof = main.data?.series.profit;
  const monthly = period === "year" || period === "quarter";
  const a = (rev ?? prof ?? []).map((r) => ({ label: axis(r.period, monthly), value: Number(rev ? (r as { revenue: number }).revenue : (r as { grossProfit: number }).grossProfit) }));
  const b = rev && prof ? prof.map((r) => ({ label: axis(r.period, monthly), value: Number(r.grossProfit) })) : undefined;
  const hasA = a.length > 1 && a.some((d) => d.value !== 0);
  const span = (rev ?? prof ?? []) as Array<{ period: string }>;

  const yr = year.data?.series.revenue;
  const yp = year.data?.series.profit;
  const bars = (yr ?? []).map((r, i) => ({ label: axis(r.period, true), value: Number(r.revenue), value2: yp?.[i] ? Number(yp[i]!.grossProfit) : undefined }));
  const barsOk = bars.length > 0 && bars.some((d) => d.value > 0);

  return (
    <>
      <PageHeader title="Báo cáo" description="Số liệu do máy chủ tính; chọn báo cáo để xem, xuất Excel hoặc in" />
      <RequirePerm perm={["report.sales", "report.inventory", "profit.view", "debt.view", "collab.view", "audit.view", "warranty.view"]}>
        <div className="wf-rep">
          <div className="wf-stack" style={{ minWidth: 0 }}>
            {canChart && (
              <>
                <SegmentedControl ariaLabel="Kỳ xem biểu đồ" value={period} onChange={setPeriod} options={[{ value: "7d", label: "7 ngày" }, { value: "month", label: "Tháng này" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]} />
                <section className="g wf-pad" aria-label="Doanh thu và lãi gộp">
                  <div className="wf-ch">
                    <h3>
                      {b ? "Doanh thu & lãi gộp" : rev ? "Doanh thu" : "Lãi gộp"}
                      {span.length > 1 && <span className="sub">{formatDateVn(span[0]!.period)} – {formatDateVn(span[span.length - 1]!.period)}</span>}
                    </h3>
                  </div>
                  {hasA ? (
                    <AreaChart data={a} data2={b} legend={b ? ["Doanh thu", "Lãi gộp"] : undefined} color={rev ? "var(--wf-accent)" : "var(--wf-ok)"} format={formatVndShort} ariaLabel="Doanh thu và lãi gộp theo kỳ" />
                  ) : (
                    <p className="wf-mute" style={{ padding: "18px 4px 6px" }}>{main.isLoading ? "Đang tải biểu đồ…" : "Chưa có số liệu trong kỳ này."}</p>
                  )}
                </section>
                {barsOk && (
                  <section className="g wf-pad" aria-label="Doanh thu theo tháng">
                    <div className="wf-ch"><h3>Theo tháng<span className="sub">năm nay</span></h3></div>
                    <div style={{ marginTop: 10 }}>
                      <BarChart data={bars} format={formatVndShort} legend={yp ? ["Doanh thu", "Lãi gộp"] : undefined} ariaLabel="Doanh thu và lãi gộp theo tháng" height={150} />
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
          <div className="wf-stack" style={{ minWidth: 0 }}>
            {brands.length > 0 && (
              <section className="g wf-pad" aria-label="Tồn kho theo hãng">
                <div className="wf-ch"><h3>Tồn kho theo hãng</h3></div>
                <div style={{ marginTop: 12 }}>
                  <Donut segments={brands.map((x, i) => ({ ...x, color: PAL[i % PAL.length] }))} size={124} stroke={19} center={{ title: brands.reduce((s, x) => s + x.value, 0), caption: "chiếc" }} ariaLabel="Số chiếc tồn kho theo hãng" />
                </div>
              </section>
            )}
            <InsetList label="Danh sách báo cáo">
              {list.map((r) => {
                const look = LOOK[r.code] ?? { icon: BarChart3, tone: "info" as Tone };
                return <InsetRow key={r.code} href={`/bao-cao/${r.code}`} icon={<look.icon size={20} aria-hidden="true" />} tone={look.tone} title={`${r.no} · ${r.title}`} subtitle={r.desc} />;
              })}
              {can("collab.view") && <InsetRow href="/cong-tac-vien/thong-ke" icon={<Handshake size={20} aria-hidden="true" />} tone="check" title="R9 · Thống kê cộng tác viên" subtitle="Theo tháng, quý, năm; đã/chưa nộp" />}
              {can("audit.view") && <InsetRow href="/quan-tri/nhat-ky" icon={<FileClock size={20} aria-hidden="true" />} tone="neutral" title="R12 · Nhật ký hoạt động" subtitle="Ai đã làm gì, khi nào" />}
            </InsetList>
          </div>
        </div>
      </RequirePerm>
    </>
  );
}
