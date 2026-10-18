"use client";
import {
  Banknote, BarChart3, Bookmark, Boxes, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Coins, Handshake, LayoutDashboard, PackageCheck, Receipt, ShieldCheck, ShoppingBag, TrendingUp, Watch, Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { Donut } from "@/components/charts/Donut";
import { HBarList } from "@/components/charts/HBarList";
import { detectProfile, QUICK_ACTIONS } from "@/components/layout/nav";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { HeroCard } from "@/components/ui/HeroCard";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { KpiGrid, KpiTile } from "@/components/ui/KpiTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ShortcutGrid } from "@/components/ui/ShortcutGrid";
import { Skeleton, SkeletonGroup, SkeletonKpis } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn, todayVn } from "@/lib/dates";
import { formatVnd, formatVndShort } from "@/lib/money";
import { deltaPct } from "@/lib/series";
import { useSession } from "@/lib/session";

type Period = "today" | "7d" | "month" | "quarter" | "year";
type K = Record<string, number | undefined>;
type Dash = {
  from: string; to: string; period: Period; kpis: K; prev?: K;
  series: {
    revenue?: Array<{ period: string; salesRevenue: number; repairRevenue: number; revenue: number; invoiceCount: number }>;
    profit?: Array<{ period: string; grossProfit: number }>;
  };
  recentSales?: Array<{ id: string; code: string; docDate: string; grandTotal: number; customerName: string | null; isCollab: boolean }>;
  openRepairs?: Array<{ id: string; code: string; status: string; customerName: string | null; expectedDate: string | null }>;
  stockByBrand?: Array<{ name: string; count: number }>;
};
const PERIOD_LABEL: Record<Period, string> = { today: "hôm nay", "7d": "7 ngày", month: "tháng này", quarter: "quý này", year: "năm nay" };
const VS_LABEL: Record<Period, string> = { today: "hôm qua", "7d": "7 ngày trước", month: "tháng trước", quarter: "quý trước", year: "năm trước" };
const CHART_TITLE: Record<Period, string> = { today: "Doanh thu 7 ngày gần đây", "7d": "Doanh thu 7 ngày", month: "Doanh thu tháng này", quarter: "Doanh thu quý này", year: "Doanh thu năm nay" };

const TODOS: Array<{ key: string; label: string; sub: string; href: string; icon: ReactNode; tone: "bad" | "hold" | "info" | "ok" | "check" | "repair" }> = [
  { key: "reservationsOverdue", label: "Giữ hàng quá hạn", sub: "Liên hệ khách hoặc hủy giữ", href: "/giu-hang", icon: <Bookmark size={20} />, tone: "bad" },
  { key: "dueTodayCount", label: "Phiếu nợ đến hạn", sub: "Hẹn trả hôm nay hoặc đã quá hạn", href: "/ban-hang", icon: <Banknote size={20} />, tone: "hold" },
  { key: "repairsReady", label: "Máy sửa xong chưa giao", sub: "Báo khách đến lấy máy", href: "/sua-chua", icon: <Wrench size={20} />, tone: "ok" },
  { key: "collabPendingOrders", label: "Đơn CTV chờ xác nhận", sub: "Cần chủ cửa hàng duyệt", href: "/ban-hang", icon: <Handshake size={20} />, tone: "check" },
  { key: "partsLow", label: "Linh kiện sắp hết", sub: "Dưới mức đặt hàng lại", href: "/linh-kien", icon: <Boxes size={20} />, tone: "repair" },
  { key: "agingUnits", label: "Chiếc tồn lâu", sub: "Nằm kho quá ngưỡng", href: "/dong-ho", icon: <Clock size={20} />, tone: "hold" },
  { key: "warrantiesExpiring", label: "Bảo hành sắp hết hạn", sub: "Nhắc khách trước hạn", href: "/bao-hanh", icon: <ShieldCheck size={20} />, tone: "info" },
  { key: "stocktakesOpen", label: "Đợt kiểm kê đang mở", sub: "Chưa chốt số liệu", href: "/kiem-ke", icon: <ClipboardCheck size={20} />, tone: "info" },
];

/** Nhãn trục ngang: ngày "17/10", tháng "T10" */
const axisLabel = (period: string, monthly: boolean) => (monthly ? `T${Number(period.slice(5, 7))}` : `${period.slice(8, 10)}/${period.slice(5, 7)}`);
const weekdayVn = (iso: string) => new Intl.DateTimeFormat("vi-VN", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default function HomePage() {
  const { user, can } = useSession();
  const router = useRouter();
  const isCtv = detectProfile(can) === "ctv";
  const [period, setPeriod] = useState<Period>("today");
  const [tab, setTab] = useState<"revenue" | "profit" | "both">("revenue");
  useEffect(() => {
    if (isCtv) router.replace("/ctv");
  }, [isCtv, router]);
  const { data, error, isLoading, mutate } = useSWR<Dash>(isCtv ? null : `/api/v1/reports/dashboard?period=${period}`, swrFetcher, { keepPreviousData: true, refreshInterval: 120_000 });

  const first = user?.fullName.trim().split(/\s+/).slice(-1)[0] ?? "";
  const k = data?.kpis ?? {};
  const pv = data?.prev ?? {};
  const has = (key: string) => typeof k[key] === "number";
  const todos = useMemo(() => TODOS.filter((t) => has(t.key)), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const todoOpen = todos.filter((t) => (k[t.key] ?? 0) > 0);
  const todoTotal = todoOpen.reduce((a, t) => a + (k[t.key] ?? 0), 0);
  const rev = data?.series.revenue;
  const prof = data?.series.profit;
  const monthly = period === "year" || period === "quarter";
  const showTab = tab === "both" && rev && prof ? "both" : tab === "profit" && prof ? "profit" : rev ? "revenue" : prof ? "profit" : null;
  const revData = (rev ?? []).map((r) => ({ label: axisLabel(r.period, monthly), value: Number(r.revenue) }));
  const profData = (prof ?? []).map((r) => ({ label: axisLabel(r.period, monthly), value: Number(r.grossProfit) }));
  const chartA = showTab === "profit" ? profData : revData;
  const chartB = showTab === "both" ? profData : undefined;
  const chartOk = (chartA.length > 1 && chartA.some((d) => d.value !== 0)) || (chartB?.some((d) => d.value !== 0) ?? false);
  const span = (rev ?? prof ?? []) as Array<{ period: string }>;
  const channelData = (rev ?? []).map((r) => ({ label: axisLabel(r.period, monthly), value: Number(r.salesRevenue), value2: Number(r.repairRevenue) }));
  const channelOk = channelData.length > 1 && channelData.some((d) => d.value > 0 || (d.value2 ?? 0) > 0);
  const anyKpi = Object.keys(k).length > 0;

  // Tồn kho theo trạng thái: "Đã giữ" = phần còn lại của tổng tồn
  const stockSegments = useMemo(() => {
    if (!has("unitsInStock")) return [];
    const sellable = k.unitsSellable ?? 0, collab = k.unitsWithCollab ?? 0, repair = k.unitsInRepair ?? 0, insp = k.unitsInspecting ?? 0;
    const reserved = Math.max(0, (k.unitsInStock ?? 0) - sellable - collab - repair - insp);
    return [
      { label: "Sẵn sàng bán", value: sellable, color: "var(--wf-ok)" },
      { label: "Đã giữ", value: reserved, color: "var(--wf-hold)" },
      { label: "Đang ở CTV", value: collab, color: "var(--wf-info)" },
      { label: "Đang sửa", value: repair, color: "var(--wf-repair)" },
      { label: "Chờ kiểm tra", value: insp, color: "var(--wf-check)" },
    ].filter((s) => s.value > 0);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const brandSegments = (data?.stockByBrand ?? []).map((b) => ({ label: b.name, value: b.count }));
  const payments = has("cash") && has("bankTransfer") && (k.cash ?? 0) + (k.bankTransfer ?? 0) > 0
    ? [{ label: "Tiền mặt", value: Math.max(0, k.cash ?? 0), display: formatVnd(k.cash ?? 0), tone: "ok" as const }, { label: "Chuyển khoản", value: Math.max(0, k.bankTransfer ?? 0), display: formatVnd(k.bankTransfer ?? 0), tone: "info" as const }]
    : [];

  const shortcuts = QUICK_ACTIONS.filter((a) => !a.id.startsWith("ctv-") && a.id !== "print-qr" && a.id !== "ctv-pending" && can(a.permission)).slice(0, 6).map((a) => ({ href: a.href, label: a.label, tone: a.tone, icon: <a.icon size={22} /> }));

  const today = todayVn();
  const dateLine = `${weekdayVn(today).replace(/^./, (c) => c.toUpperCase())}, ${formatDateVn(today)}`;
  const summary = has("invoiceCount") && has("revenue") ? ` · ${PERIOD_LABEL[period]}: ${k.invoiceCount} phiếu, ${formatVndShort(k.revenue!)}` : "";

  const vs = (key: string) => deltaPct(k[key], pv[key]);
  const heroDelta = vs("revenue");

  if (isCtv) return null;
  return (
    <>
      <PageHeader title={`Chào ${first}`} context={dateLine} description={`${dateLine}${summary}`} />
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
            <div className="wf-dcol">
              {has("revenue") && (
                <div style={{ order: 1 }}>
                <HeroCard
                  icon={<BarChart3 size={16} aria-hidden="true" />}
                  label={`Doanh thu ${PERIOD_LABEL[period]}`}
                  value={formatVnd(k.revenue!, { symbol: false })}
                  unit="₫"
                  note={heroDelta !== null ? <span>{heroDelta >= 0 ? "▲" : "▼"} {Math.abs(heroDelta).toLocaleString("vi-VN")}% so với {VS_LABEL[period]}</span> : undefined}
                  stats={[
                    ...(has("salesRevenue") ? [{ label: "Bán hàng", value: formatVndShort(k.salesRevenue!) }] : []),
                    ...(has("repairRevenue") ? [{ label: "Sửa chữa", value: formatVndShort(k.repairRevenue!) }] : []),
                    ...(has("invoiceCount") ? [{ label: "Số phiếu", value: String(k.invoiceCount) }] : []),
                  ].slice(0, 3)}
                  action={can("report.sales") ? { label: "Báo cáo", href: "/bao-cao/revenue" } : undefined}
                />
                </div>
              )}
              <KpiGrid className="wf-o2">
                {has("grossProfit") && <KpiTile tone="ok" icon={<TrendingUp size={16} />} label="Lãi gộp" value={formatVndShort(k.grossProfit!)} delta={vs("grossProfit")} hint={heroDelta === null ? PERIOD_LABEL[period] : undefined} spark={prof && prof.length > 1 ? prof.map((r) => Number(r.grossProfit)) : undefined} href={can("profit.view") ? "/bao-cao/profit" : undefined} />}
                {has("collections") && <KpiTile tone="info" icon={<Banknote size={16} />} label="Thực thu" value={formatVndShort(k.collections!)} delta={vs("collections")} hint={has("cash") ? `Mặt ${formatVndShort(k.cash!)}` : undefined} href={can("report.sales") ? "/bao-cao/collections" : undefined} />}
                {has("unitsInStock") && <KpiTile tone="check" icon={<Watch size={16} />} label="Tồn kho" value={`${k.unitsInStock} chiếc`} hint={has("unitsWithCollab") ? `${k.unitsWithCollab} ở CTV` : undefined} href={can("catalog.view") ? "/dong-ho" : undefined} />}
                {has("stockValueUnits") && <KpiTile tone="repair" icon={<Coins size={16} />} label="Giá trị tồn" value={formatVndShort(k.stockValueUnits!)} hint={has("stockValueParts") ? `Vốn · LK ${formatVndShort(k.stockValueParts!)}` : "Theo giá vốn"} href={can(["report.inventory", "cost.view"]) ? "/bao-cao/stock" : undefined} />}
                {has("unitsSold") && <KpiTile tone="ok" icon={<ShoppingBag size={16} />} label="Đã bán" value={`${k.unitsSold} chiếc`} delta={vs("unitsSold")} hint={heroDelta === null ? PERIOD_LABEL[period] : undefined} />}
                {has("unitsSellable") && !has("unitsInStock") && <KpiTile tone="ok" icon={<PackageCheck size={16} />} label="Sẵn sàng bán" value={`${k.unitsSellable} chiếc`} />}
                {has("customerDue") && <KpiTile tone="hold" icon={<Receipt size={16} />} label="Khách còn nợ" value={formatVndShort(k.customerDue!)} href={can("debt.view") ? "/bao-cao/open-balances" : undefined} />}
                {has("depositsHeld") && <KpiTile tone="hold" icon={<Bookmark size={16} />} label="Cọc đang giữ" value={formatVndShort(k.depositsHeld!)} href={can("reservation.manage") ? "/giu-hang" : undefined} />}
                {has("collabUnsettled") && <KpiTile tone="check" icon={<Handshake size={16} />} label="CTV chưa nộp" value={formatVndShort(k.collabUnsettled!)} href={can("collab.view") ? "/cong-tac-vien" : undefined} />}
              </KpiGrid>

              {showTab && (
                <section className="g wf-pad" aria-label="Biểu đồ" style={{ order: 4 }}>
                  <div className="wf-ch">
                    <h3>
                      {showTab === "profit" ? CHART_TITLE[period].replace("Doanh thu", "Lãi gộp") : showTab === "both" ? CHART_TITLE[period].replace("Doanh thu", "Doanh thu & lãi gộp") : CHART_TITLE[period]}
                      {span.length > 1 && <span className="sub">{formatDateVn(span[0]!.period)} – {formatDateVn(span[span.length - 1]!.period)}</span>}
                    </h3>
                    {rev && prof && <SegmentedControl mode="tabs" ariaLabel="Chỉ số biểu đồ" value={showTab} onChange={setTab} options={[{ value: "revenue", label: "Doanh thu" }, { value: "profit", label: "Lãi gộp" }, { value: "both", label: "Cả hai" }]} />}
                  </div>
                  {chartOk ? (
                    <AreaChart
                      data={chartA}
                      data2={chartB}
                      color={showTab === "profit" ? "var(--wf-ok)" : "var(--wf-accent)"}
                      legend={chartB ? ["Doanh thu", "Lãi gộp"] : undefined}
                      format={formatVndShort}
                      ariaLabel={showTab === "profit" ? "Lãi gộp theo kỳ" : "Doanh thu theo kỳ"}
                    />
                  ) : (
                    <p className="wf-mute" style={{ padding: "18px 4px 6px" }}>Chưa có doanh thu trong khoảng này — biểu đồ sẽ hiện khi có phiếu bán hoặc phiếu sửa đã giao.</p>
                  )}
                </section>
              )}

              {(channelOk || stockSegments.length > 0 || brandSegments.length > 0 || payments.length > 0) && (
                <div className="wf-dcards" style={{ order: 5 }}>
                  {channelOk && (
                    <section className="g wf-pad" aria-label="Bán hàng và sửa chữa theo kỳ">
                      <h3>Bán hàng & sửa chữa</h3>
                      <BarChart data={channelData} format={formatVndShort} legend={["Bán hàng", "Sửa chữa"]} ariaLabel="Doanh thu bán hàng và sửa chữa theo kỳ" height={150} highlightLast />
                    </section>
                  )}
                  {stockSegments.length > 0 && (
                    <section className="g wf-pad" aria-label="Tồn kho theo trạng thái">
                      <h3>Tồn kho theo trạng thái</h3>
                      <Donut segments={stockSegments} size={132} stroke={20} center={{ title: k.unitsInStock ?? 0, caption: "chiếc" }} ariaLabel="Tồn kho theo trạng thái" />
                    </section>
                  )}
                  {brandSegments.length > 0 && (
                    <section className="g wf-pad" aria-label="Tồn kho theo hãng">
                      <h3>Tồn kho theo hãng</h3>
                      <HBarList ariaLabel="Số chiếc tồn theo hãng" items={brandSegments.map((b, i) => ({ label: b.label, value: b.value, display: `${b.value} chiếc`, tone: (["accent", "ok", "repair", "info", "check", "hold", "neutral", "bad"] as const)[i % 8] }))} />
                    </section>
                  )}
                  {payments.length > 0 && (
                    <section className="g wf-pad" aria-label="Thực thu theo hình thức">
                      <h3>Thực thu theo hình thức</h3>
                      <HBarList ariaLabel="Thực thu theo hình thức" items={payments} />
                    </section>
                  )}
                </div>
              )}

              {data.recentSales && data.recentSales.length > 0 && (
                <section aria-label="Phiếu bán gần đây" style={{ order: 6 }}><div className="wf-sec"><h3>Bán gần đây</h3><Link href="/ban-hang">Xem tất cả</Link></div>
                  <InsetList>{data.recentSales.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<ShoppingBag size={18} />} tone="ok" title={s.code} subtitle={`${s.customerName ?? "Khách lẻ"} · ${formatDateVn(s.docDate)}${s.isCollab ? " · qua CTV" : ""}`} end={formatVnd(s.grandTotal)} />)}</InsetList>
                </section>
              )}
            </div>
            <div className="wf-dcol">
              {todos.length > 0 && (
                <section className="g" aria-label="Việc cần xử lý" style={{ overflow: "hidden", order: 3 }}>
                  <div className="wf-card-h"><h2>Việc cần xử lý</h2>{todoTotal > 0 && <span className="n" aria-label={`${todoTotal} việc`}>{todoTotal}</span>}</div>
                  {todoOpen.length === 0 ? (
                    <p className="wf-ok-all"><CheckCircle2 size={22} aria-hidden="true" style={{ color: "var(--wf-ok)" }} />Mọi việc đã xử lý xong.</p>
                  ) : (
                    todoOpen.map((t) => (
                      <Link key={t.key} href={t.href} className="wf-td" data-tone={t.tone}>
                        <span className="wf-ib" data-tone={t.tone} style={{ width: 40, height: 40, borderRadius: 13 }} aria-hidden="true">{t.icon}</span>
                        <span className="m"><b>{t.label}</b><small>{t.sub}</small></span>
                        <span className="n">{k[t.key]}</span>
                        <ChevronRight className="wf-cv" size={18} aria-hidden="true" />
                      </Link>
                    ))
                  )}
                </section>
              )}
              {shortcuts.length > 0 && (
                <section aria-label="Làm nhanh" style={{ order: 7 }}><div className="wf-sec" style={{ marginTop: 4 }}><h3>Làm nhanh</h3></div>
                  <ShortcutGrid ariaLabel="Lối tắt các việc hay làm" items={shortcuts} />
                </section>
              )}
              {data.openRepairs && data.openRepairs.length > 0 && (
                <section aria-label="Máy đang sửa" style={{ order: 8 }}><div className="wf-sec"><h3>Đang sửa</h3><Link href="/sua-chua">Xem tất cả</Link></div>
                  <InsetList>{data.openRepairs.map((r) => <InsetRow key={r.id} href={`/sua-chua/${r.id}`} icon={<Wrench size={18} />} tone="repair" title={r.code} subtitle={`${r.customerName ?? "Máy cửa hàng"}${r.expectedDate ? ` · hẹn ${formatDateVn(r.expectedDate)}` : ""}`} end={<StatusChip kind="repair" status={r.status} />} />)}</InsetList>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
