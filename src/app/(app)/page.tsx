"use client";
import { AlertTriangle, ClipboardCheck, Clock, Handshake, LayoutDashboard, Package, ShieldCheck, Wrench, Boxes, Bookmark, Banknote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { AreaChart } from "@/components/charts/AreaChart";
import { detectProfile } from "@/components/layout/nav";
import { joinTitle } from "@/components/catalog/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { HeroCard } from "@/components/ui/HeroCard";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { KpiGrid, KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonGroup, SkeletonKpis } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd, formatVndShort } from "@/lib/money";
import { useSession } from "@/lib/session";

type Period = "today" | "7d" | "month" | "quarter" | "year";
type K = Record<string, number | undefined>;
type Dash = {
  from: string; to: string; period: Period; kpis: K;
  series: { revenue?: Array<{ period: string; revenue: number }>; profit?: Array<{ period: string; grossProfit: number }> };
  recentSales?: Array<{ id: string; code: string; docDate: string; grandTotal: number; customerName: string | null; isCollab: boolean }>;
  openRepairs?: Array<{ id: string; code: string; status: string; customerName: string | null; expectedDate: string | null }>;
};
const PERIOD_LABEL: Record<Period, string> = { today: "hôm nay", "7d": "7 ngày", month: "tháng này", quarter: "quý này", year: "năm nay" };

const TODOS: Array<{ key: string; label: string; href: string; icon: ReactNode; tone: "bad" | "hold" | "info" | "ok" | "check" | "repair" }> = [
  { key: "reservationsOverdue", label: "Giữ hàng quá hạn", href: "/giu-hang", icon: <Bookmark size={18} />, tone: "bad" },
  { key: "dueTodayCount", label: "Phiếu nợ đến hạn", href: "/ban-hang", icon: <Banknote size={18} />, tone: "hold" },
  { key: "repairsReady", label: "Máy sửa xong chưa giao", href: "/sua-chua", icon: <Wrench size={18} />, tone: "ok" },
  { key: "collabPendingOrders", label: "Đơn CTV chờ xác nhận", href: "/ban-hang", icon: <Handshake size={18} />, tone: "check" },
  { key: "partsLow", label: "Linh kiện sắp hết", href: "/linh-kien", icon: <Boxes size={18} />, tone: "repair" },
  { key: "agingUnits", label: "Chiếc tồn lâu", href: "/dong-ho", icon: <Clock size={18} />, tone: "hold" },
  { key: "warrantiesExpiring", label: "Bảo hành sắp hết hạn", href: "/bao-hanh", icon: <ShieldCheck size={18} />, tone: "info" },
  { key: "stocktakesOpen", label: "Đợt kiểm kê đang mở", href: "/kiem-ke", icon: <ClipboardCheck size={18} />, tone: "info" },
];

export default function HomePage() {
  const { user, can } = useSession();
  const router = useRouter();
  const isCtv = detectProfile(can) === "ctv";
  const [period, setPeriod] = useState<Period>("today");
  const [tab, setTab] = useState<"revenue" | "profit">("revenue");
  useEffect(() => {
    if (isCtv) router.replace("/ctv");
  }, [isCtv, router]);
  const { data, error, isLoading, mutate } = useSWR<Dash>(isCtv ? null : `/api/v1/reports/dashboard?period=${period}`, swrFetcher, { keepPreviousData: true, refreshInterval: 120_000 });

  const first = user?.fullName.trim().split(/\s+/).slice(-1)[0] ?? "";
  const k = data?.kpis ?? {};
  const has = (key: string) => typeof k[key] === "number";
  const todos = useMemo(() => TODOS.filter((t) => has(t.key)), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const todoOpen = todos.filter((t) => (k[t.key] ?? 0) > 0);
  const rev = data?.series.revenue;
  const prof = data?.series.profit;
  const showTab = tab === "profit" && prof ? "profit" : rev ? "revenue" : prof ? "profit" : null;
  const chartData = showTab === "profit" ? (prof ?? []).map((r) => ({ label: r.period.slice(5), value: Number(r.grossProfit) })) : (rev ?? []).map((r) => ({ label: r.period.slice(5), value: Number(r.revenue) }));
  const anyKpi = Object.keys(k).length > 0;

  if (isCtv) return null;
  return (
    <>
      <PageHeader title="Tổng quan" context={`Xin chào, ${first}`} description="Số liệu hoạt động của cửa hàng" />
      <div className="wf-stack" style={{ marginTop: 8 }}>
        <SegmentedControl ariaLabel="Kỳ xem số liệu" value={period} onChange={setPeriod} options={[{ value: "today", label: "Hôm nay" }, { value: "7d", label: "7 ngày" }, { value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]} />
        {isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={190} radius={30} /><SkeletonKpis /></SkeletonGroup>
        ) : error || !data ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : !anyKpi && !data.recentSales && !data.openRepairs ? (
          <div className="g wf-pad"><EmptyState icon={<LayoutDashboard size={24} />} title={`Chào ${first}`} description="Tài khoản của bạn chưa có số liệu tổng quan nào để xem. Dùng menu để bắt đầu làm việc." action={{ label: "Hướng dẫn sử dụng", href: "/huong-dan" }} /></div>
        ) : (
          <div className="wf-dash">
            <div className="wf-stack" style={{ minWidth: 0 }}>
              {has("revenue") && (
                <HeroCard
                  label={`Doanh thu ${PERIOD_LABEL[period]}`}
                  value={formatVnd(k.revenue!, { symbol: false })}
                  unit="₫"
                  stats={[
                    ...(has("salesRevenue") ? [{ label: "Bán hàng", value: formatVndShort(k.salesRevenue!) }] : []),
                    ...(has("repairRevenue") ? [{ label: "Sửa chữa", value: formatVndShort(k.repairRevenue!) }] : []),
                    ...(has("invoiceCount") ? [{ label: "Số phiếu", value: String(k.invoiceCount) }] : []),
                  ].slice(0, 3)}
                  action={can("report.sales") ? { label: "Báo cáo", href: "/bao-cao/revenue" } : undefined}
                />
              )}
              <KpiGrid>
                {has("grossProfit") && <KpiTile label="Lãi gộp" value={formatVndShort(k.grossProfit!)} hint={PERIOD_LABEL[period]} />}
                {has("collections") && <KpiTile label="Thực thu" value={formatVndShort(k.collections!)} hint={has("cash") ? `Mặt ${formatVndShort(k.cash!)}` : undefined} />}
                {has("unitsInStock") && <KpiTile label="Tồn kho" value={String(k.unitsInStock)} hint={has("unitsWithCollab") ? `${k.unitsWithCollab} ở CTV` : undefined} />}
                {has("stockValueUnits") && <KpiTile label="Giá trị tồn" value={formatVndShort(k.stockValueUnits!)} hint={has("stockValueParts") ? `LK ${formatVndShort(k.stockValueParts!)}` : undefined} />}
                {has("unitsSold") && <KpiTile label="Đã bán" value={String(k.unitsSold)} hint={PERIOD_LABEL[period]} />}
                {has("unitsSellable") && !has("unitsInStock") && <KpiTile label="Sẵn sàng bán" value={String(k.unitsSellable)} />}
                {has("customerDue") && <KpiTile label="Khách còn nợ" value={formatVndShort(k.customerDue!)} />}
                {has("depositsHeld") && <KpiTile label="Cọc đang giữ" value={formatVndShort(k.depositsHeld!)} />}
                {has("collabUnsettled") && <KpiTile label="CTV chưa nộp" value={formatVndShort(k.collabUnsettled!)} />}
              </KpiGrid>
              {showTab && chartData.length > 1 && (
                <section className="g wf-pad" aria-label="Biểu đồ">
                  {rev && prof && <SegmentedControl mode="tabs" ariaLabel="Chỉ số biểu đồ" value={showTab} onChange={setTab} options={[{ value: "revenue", label: "Doanh thu" }, { value: "profit", label: "Lãi gộp" }]} />}
                  <AreaChart data={chartData} color={showTab === "profit" ? "var(--wf-ok)" : "var(--wf-accent)"} format={formatVndShort} ariaLabel={showTab === "profit" ? "Lãi gộp theo kỳ" : "Doanh thu theo kỳ"} />
                </section>
              )}
              {data.recentSales && data.recentSales.length > 0 && (
                <section aria-label="Phiếu bán gần đây"><div className="wf-sec"><h3>Bán gần đây</h3><Link href="/ban-hang">Xem tất cả</Link></div>
                  <InsetList>{data.recentSales.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<Package size={18} />} tone="ok" title={s.code} subtitle={`${s.customerName ?? "Khách lẻ"} · ${formatDateVn(s.docDate)}${s.isCollab ? " · qua CTV" : ""}`} end={formatVnd(s.grandTotal)} />)}</InsetList>
                </section>
              )}
            </div>
            <div className="wf-stack" style={{ minWidth: 0 }}>
              {todos.length > 0 && (
                <section className="g" aria-label="Việc cần xử lý" style={{ overflow: "hidden" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, padding: "14px 16px 4px" }}>Việc cần xử lý</h2>
                  {todoOpen.length === 0 ? <p className="wf-mute" style={{ padding: "6px 16px 16px" }}>Mọi việc đã xử lý xong.</p> : (
                    todoOpen.map((t) => (
                      <Link key={t.key} href={t.href} className="wf-todo">
                        <span className="wf-ib" data-tone={t.tone} style={{ width: 36, height: 36, borderRadius: 12 }} aria-hidden="true">{t.icon}</span>
                        <span style={{ flex: 1 }}>{t.label}</span>
                        <StatusChip tone={t.tone}>{k[t.key]}</StatusChip>
                      </Link>
                    ))
                  )}
                </section>
              )}
              {data.openRepairs && data.openRepairs.length > 0 && (
                <section aria-label="Máy đang sửa"><div className="wf-sec"><h3>Đang sửa</h3><Link href="/sua-chua">Xem tất cả</Link></div>
                  <InsetList>{data.openRepairs.map((r) => <InsetRow key={r.id} href={`/sua-chua/${r.id}`} icon={<Wrench size={18} />} tone="repair" title={r.code} subtitle={`${r.customerName ?? "Máy cửa hàng"}${r.expectedDate ? ` · hẹn ${formatDateVn(r.expectedDate)}` : ""}`} end={<StatusChip kind="repair" status={r.status} />} />)}</InsetList>
                </section>
              )}
              {!todos.length && !data.openRepairs?.length && <div className="g wf-pad"><p className="wf-mute"><AlertTriangle size={14} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />Chưa có việc cần xử lý để hiển thị.</p></div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
