"use client";
import { BarChart3, CheckCircle2, ChevronRight, Handshake, LayoutDashboard, PackageCheck, ShoppingBag, Watch, Wrench } from "lucide-react";
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
  series: { revenue?: Array<{ period: string; shopRevenue: number; collabRevenue: number; repairRevenue: number; revenue: number; invoiceCount: number; unitsSold: number }> };
  recentSales?: Array<{ id: string; code: string; docDate: string; grandTotal: number; customerName: string | null; isCollab: boolean; items: string | null }>;
  pendingClaims?: Array<{ id: string; assetCode: string; modelName: string; collaboratorName: string | null; customerName: string }>;
  openRepairs?: Array<{ id: string; code: string; status: string; customerName: string | null; expectedDate: string | null }>;
  stockByBrand?: Array<{ name: string; count: number }>;
};
const PERIOD_LABEL: Record<Period, string> = { today: "hôm nay", "7d": "7 ngày", month: "tháng này", quarter: "quý này", year: "năm nay" };
const VS_LABEL: Record<Period, string> = { today: "hôm qua", "7d": "7 ngày trước", month: "tháng trước", quarter: "quý trước", year: "năm trước" };
const CHART_TITLE: Record<Period, string> = { today: "Doanh thu 7 ngày gần đây", "7d": "Doanh thu 7 ngày", month: "Doanh thu tháng này", quarter: "Doanh thu quý này", year: "Doanh thu năm nay" };

// Việc cần xử lý (bản gọn): CTV báo bán chờ xác nhận, máy sửa xong chưa giao
const TODOS: Array<{ key: string; label: string; sub: string; href: string; icon: ReactNode; tone: "bad" | "hold" | "info" | "ok" | "check" | "repair" }> = [
  { key: "collabPendingClaims", label: "CTV báo đã bán, chờ xác nhận", sub: "Xác nhận hoặc từ chối", href: "/cong-tac-vien/bao-ban", icon: <Handshake size={20} />, tone: "hold" },
  { key: "repairsReady", label: "Máy sửa xong chưa giao", sub: "Báo khách đến lấy máy", href: "/sua-chua", icon: <Wrench size={20} />, tone: "ok" },
];

/** Nhãn trục ngang: ngày "17/10", tháng "T10" */
const axisLabel = (period: string, monthly: boolean) => (monthly ? `T${Number(period.slice(5, 7))}` : `${period.slice(8, 10)}/${period.slice(5, 7)}`);
const weekdayVn = (iso: string) => new Intl.DateTimeFormat("vi-VN", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default function HomePage() {
  const { user, can } = useSession();
  const router = useRouter();
  const isCtv = detectProfile(can) === "ctv";
  const [period, setPeriod] = useState<Period>("today");
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
  const monthly = period === "year" || period === "quarter";
  const revData = (rev ?? []).map((r) => ({ label: axisLabel(r.period, monthly), value: Number(r.revenue) }));
  const chartOk = revData.length > 1 && revData.some((d) => d.value !== 0);
  const span = (rev ?? []) as Array<{ period: string }>;
  const channelData = (rev ?? []).map((r) => ({ label: axisLabel(r.period, monthly), value: Number(r.shopRevenue) + Number(r.collabRevenue), value2: Number(r.repairRevenue) }));
  const channelOk = channelData.length > 1 && channelData.some((d) => d.value > 0 || (d.value2 ?? 0) > 0);
  const anyKpi = Object.keys(k).length > 0;

  // Đồng hồ trong kho theo trạng thái: sẵn sàng bán (trong đó đang giao CTV) / chờ kiểm tra
  const stockSegments = useMemo(() => {
    if (!has("unitsInStock")) return [];
    const sellable = k.unitsSellable ?? 0, insp = k.unitsInspecting ?? 0, offered = Math.min(k.unitsOffered ?? 0, sellable);
    return [
      { label: "Bán tại cửa hàng", value: Math.max(0, sellable - offered), color: "var(--wf-ok)" },
      { label: "Đang giao CTV", value: offered, color: "var(--wf-info)" },
      { label: "Chờ kiểm tra", value: insp, color: "var(--wf-check)" },
    ].filter((s) => s.value > 0);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const brandSegments = (data?.stockByBrand ?? []).map((b) => ({ label: b.name, value: b.count }));

  const shortcuts = QUICK_ACTIONS.filter((a) => !a.id.startsWith("ctv-") && a.id !== "print-qr" && can(a.permission)).slice(0, 6).map((a) => ({ href: a.href, label: a.label, tone: a.tone, icon: <a.icon size={22} /> }));

  const today = todayVn();
  const dateLine = `${weekdayVn(today).replace(/^./, (c) => c.toUpperCase())}, ${formatDateVn(today)}`;
  const summary = has("invoiceCount") && has("revenue") ? ` · ${PERIOD_LABEL[period]}: ${k.invoiceCount} đơn, ${formatVndShort(k.revenue!)}` : "";

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
                      ...(has("shopSalesRevenue") ? [{ label: "Bán tại cửa hàng", value: formatVndShort(k.shopSalesRevenue!) }] : []),
                      ...(has("collabSalesRevenue") ? [{ label: "CTV bán", value: formatVndShort(k.collabSalesRevenue!) }] : []),
                      ...(has("repairRevenue") ? [{ label: "Sửa chữa", value: formatVndShort(k.repairRevenue!) }] : []),
                    ].slice(0, 3)}
                    action={can("report.sales") ? { label: "Báo cáo", href: "/bao-cao/doanh-thu" } : undefined}
                  />
                </div>
              )}
              <KpiGrid className="wf-o2">
                {has("unitsSold") && <KpiTile tone="ok" icon={<ShoppingBag size={16} />} label="Đã bán" value={`${k.unitsSold} chiếc`} delta={vs("unitsSold")} hint={has("invoiceCount") ? `${k.invoiceCount} đơn` : undefined} href={can("sale.view") ? "/ban-hang" : undefined} />}
                {has("unitsSellable") && <KpiTile tone="check" icon={<Watch size={16} />} label="Sẵn sàng bán" value={`${k.unitsSellable} chiếc`} hint={has("unitsInspecting") && (k.unitsInspecting ?? 0) > 0 ? `${k.unitsInspecting} chờ kiểm tra` : undefined} href={can("catalog.view") ? "/dong-ho" : undefined} />}
                {has("unitsOffered") && <KpiTile tone="info" icon={<PackageCheck size={16} />} label="Đang giao CTV" value={`${k.unitsOffered} chiếc`} href={can("collab.view") ? "/cong-tac-vien/hang" : undefined} />}
                {has("collabPendingClaims") && <KpiTile tone={(k.collabPendingClaims ?? 0) > 0 ? "hold" : "neutral"} icon={<Handshake size={16} />} label="CTV báo bán chờ" value={String(k.collabPendingClaims)} href="/cong-tac-vien/bao-ban" />}
                {has("repairsOpen") && <KpiTile tone="repair" icon={<Wrench size={16} />} label="Máy đang sửa" value={`${k.repairsOpen} máy`} hint={has("repairsReady") && (k.repairsReady ?? 0) > 0 ? `${k.repairsReady} xong chưa giao` : undefined} href={can("repair.view") ? "/sua-chua" : undefined} />}
              </KpiGrid>

              {rev && (
                <section className="g wf-pad" aria-label="Biểu đồ" style={{ order: 4 }}>
                  <div className="wf-ch">
                    <h3>
                      {CHART_TITLE[period]}
                      {span.length > 1 && <span className="sub">{formatDateVn(span[0]!.period)} – {formatDateVn(span[span.length - 1]!.period)}</span>}
                    </h3>
                  </div>
                  {chartOk ? (
                    <AreaChart data={revData} color="var(--wf-accent)" format={formatVndShort} ariaLabel="Doanh thu theo kỳ" />
                  ) : (
                    <p className="wf-mute" style={{ padding: "18px 4px 6px" }}>Chưa có doanh thu trong khoảng này — biểu đồ sẽ hiện khi có đơn bán hoặc phiếu sửa đã giao.</p>
                  )}
                </section>
              )}

              {(channelOk || stockSegments.length > 0 || brandSegments.length > 0) && (
                <div className="wf-dcards" style={{ order: 5 }}>
                  {channelOk && (
                    <section className="g wf-pad" aria-label="Bán hàng và sửa chữa theo kỳ">
                      <h3>Bán hàng & sửa chữa</h3>
                      <BarChart data={channelData} format={formatVndShort} legend={["Bán hàng", "Sửa chữa"]} ariaLabel="Doanh thu bán hàng và sửa chữa theo kỳ" height={150} highlightLast />
                    </section>
                  )}
                  {stockSegments.length > 0 && (
                    <section className="g wf-pad" aria-label="Đồng hồ trong kho">
                      <h3>Đồng hồ trong kho</h3>
                      <Donut segments={stockSegments} size={132} stroke={20} center={{ title: k.unitsInStock ?? 0, caption: "chiếc" }} ariaLabel="Đồng hồ trong kho theo trạng thái" />
                    </section>
                  )}
                  {brandSegments.length > 0 && (
                    <section className="g wf-pad" aria-label="Kho theo hãng">
                      <h3>Kho theo hãng</h3>
                      <HBarList ariaLabel="Số chiếc trong kho theo hãng" items={brandSegments.map((b, i) => ({ label: b.label, value: b.value, display: `${b.value} chiếc`, tone: (["accent", "ok", "repair", "info", "check", "hold", "neutral", "bad"] as const)[i % 8] }))} />
                    </section>
                  )}
                </div>
              )}

              {data.recentSales && data.recentSales.length > 0 && (
                <section aria-label="Đơn bán gần đây" style={{ order: 6 }}><div className="wf-sec"><h3>Bán gần đây</h3><Link href="/ban-hang">Xem tất cả</Link></div>
                  <InsetList>{data.recentSales.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<ShoppingBag size={18} />} tone="ok" title={s.customerName ?? "Khách lẻ"} subtitle={`${s.items ?? s.code} · ${formatDateVn(s.docDate)}${s.isCollab ? " · CTV bán" : ""}`} end={formatVnd(s.grandTotal)} />)}</InsetList>
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
                  <InsetList>{data.openRepairs.map((r) => <InsetRow key={r.id} href={`/sua-chua/${r.id}`} icon={<Wrench size={18} />} tone="repair" title={r.code} subtitle={`${r.customerName ?? "—"}${r.expectedDate ? ` · hẹn ${formatDateVn(r.expectedDate)}` : ""}`} end={<StatusChip kind="repair" status={r.status} />} />)}</InsetList>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
