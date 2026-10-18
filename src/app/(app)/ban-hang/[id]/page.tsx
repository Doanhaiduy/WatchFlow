"use client";
import { joinTitle } from "@/components/catalog/types";
import { Ban, Banknote, Boxes, HandCoins, Printer, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { PaymentSheet, type PaymentLineInput } from "@/components/payments";
import type { SaleDetail } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, LockNote } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { METHOD_LABELS } from "@/lib/types/payments";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const d = useSWR<SaleDetail>(can(["sale.view", "sale.view_own"]) ? `/api/v1/sales/${id}` : null, swrFetcher);
  const s = d.data;
  const [pay, setPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const payKey = useRef(newIdempotencyKey());

  const collect = async (lines: PaymentLineInput[]) => {
    setPaying(true);
    try {
      await sapi(`/api/v1/sales/${id}/payments`, { body: { lines }, idempotencyKey: payKey.current });
      payKey.current = newIdempotencyKey();
      toast.success("Đã ghi nhận thu thêm");
      setPay(false);
      await d.mutate();
    } catch (e) {
      payKey.current = newIdempotencyKey();
      toast.error("Không ghi nhận được thanh toán", errMsg(e));
    } finally {
      setPaying(false);
    }
  };
  const confirmCtv = async () => {
    setBusy(true);
    try {
      await sapi(`/api/v1/sales/${id}/confirm`, { body: { payments: [], cashTendered: null }, idempotencyKey: payKey.current });
      payKey.current = newIdempotencyKey();
      toast.success("Đã xác nhận đơn CTV");
      await d.mutate();
    } catch (e) {
      payKey.current = newIdempotencyKey();
      toast.error("Không xác nhận được đơn", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const doVoid = async (reason?: string) => {
    setBusy(true);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/sales/${id}/void`, { body: { reason }, idempotencyKey: key }));
      toast.success("Đã hủy phiếu bán");
      setVoidOpen(false);
      await d.mutate();
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không hủy được phiếu", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={s?.code ?? "Phiếu bán"} description={s?.customerName ?? "Khách lẻ"} />
      <RequirePerm perm={["sale.view", "sale.view_own"]}>
        {d.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={180} radius={26} /><Skeleton h={200} radius={26} /></SkeletonGroup>
        ) : d.error || !s ? (
          <div className="g wf-pad"><ErrorState title="Không mở được phiếu bán" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin phiếu">
              <div className="wf-sale-hd">
                <div style={{ minWidth: 0 }}>
                  <div className="wf-dev-row" style={{ marginBottom: 8 }}>
                    <StatusChip kind="doc" status={s.status} />
                    {(s.balance?.due ?? 0) > 0 && <StatusChip kind="doc" status="debt" label={`Còn nợ ${formatVnd(s.balance!.due)}`} />}
                  </div>
                  <div className="wf-uprice">{formatVnd(s.grandTotal)}</div>
                </div>
                {s.status === "confirmed" && s.balance && s.balance.payable > 0 && (
                  <ProgressRing value={(s.balance.paidNet / s.balance.payable) * 100} size={64} stroke={7} tone={s.balance.due > 0 ? "hold" : "ok"} label={s.balance.due > 0 ? `${Math.round((s.balance.paidNet / s.balance.payable) * 100)}%` : "Đủ"} ariaLabel={`Đã thu ${formatVnd(s.balance.paidNet)} trên ${formatVnd(s.balance.payable)}`} />
                )}
              </div>
              <KeyValue
                items={[
                  { label: "Khách", value: s.customerName ? (s.customerId && can(["customer.view", "customer.view_own"]) ? <Link href={`/khach-hang/${s.customerId}`} style={{ color: "var(--wf-accent-text)", fontWeight: 600 }}>{s.customerName}{s.customerPhone ? ` · ${s.customerPhone}` : ""}</Link> : `${s.customerName}${s.customerPhone ? ` · ${s.customerPhone}` : ""}`) : "Khách lẻ" },
                  { label: "Ngày", value: formatDateVn(s.docDate) },
                  { label: "Tiền hàng niêm yết", value: formatVnd(s.subtotalList) },
                  { label: `Giảm giá (${s.discountPct}%)`, value: formatVnd(s.discountTotal) },
                  ...(s.tradeInTotal > 0 ? [{ label: "Thu cũ", value: formatVnd(s.tradeInTotal) }] : []),
                  ...(s.depositApplied > 0 ? [{ label: "Cọc đã trừ", value: formatVnd(s.depositApplied) }] : []),
                  ...(s.balance ? [{ label: "Phải thu", value: formatVnd(s.balance.payable) }, { label: "Đã thu", value: formatVnd(s.balance.paidNet) }, { label: "Còn nợ", value: <b>{formatVnd(s.balance.due)}</b> }] : []),
                  ...(s.dueDate ? [{ label: "Hẹn trả", value: formatDateVn(s.dueDate) }] : []),
                  ...(s.collaboratorId && s.shopRevenue !== undefined ? [{ label: "Doanh thu cửa hàng (giá thu)", value: formatVnd(s.shopRevenue) }] : []),
                  ...(s.grossProfit !== undefined ? [{ label: "Lãi gộp", value: formatVnd(s.grossProfit) }] : []),
                  { label: "Lập bởi", value: s.createdByName ?? "—" },
                  ...(s.confirmedAt ? [{ label: "Xác nhận", value: `${s.confirmedByName ?? "—"} · ${formatDateTimeVn(s.confirmedAt)}` }] : []),
                  ...(s.voidedAt ? [{ label: "Đã hủy", value: `${formatDateTimeVn(s.voidedAt)} — ${s.voidReason ?? ""}` }] : []),
                ]}
              />
              {s.grossProfit !== undefined && <LockNote />}
              <div className="wf-dev-row" style={{ marginTop: 12 }}>
                {s.status === "draft" && !s.collaboratorId && can("sale.create_draft") && <Button variant="primary" href={`/ban-hang/moi?sale=${s.id}`}>Tiếp tục nháp</Button>}
                {s.status === "draft" && s.collaboratorId && can("sale.confirm") && <Button variant="primary" loading={busy} onClick={() => void confirmCtv()}>Xác nhận đơn CTV</Button>}
                {s.status === "confirmed" && (s.balance?.due ?? 0) > 0 && can("payment.create") && <Button variant="primary" icon={<HandCoins size={16} aria-hidden="true" />} onClick={() => setPay(true)}>Thu thêm</Button>}
                {s.status === "confirmed" && <Button href={`/ban-hang/${s.id}/in`} icon={<Printer size={16} aria-hidden="true" />}>In phiếu</Button>}
                {s.status === "confirmed" && can("sale.void") && <Button icon={<Ban size={16} aria-hidden="true" />} onClick={() => setVoidOpen(true)}>Hủy phiếu</Button>}
              </div>
            </section>

            <section aria-label="Các dòng"><div className="wf-sec"><h3>Hàng bán</h3></div>
              <InsetList>
                {s.lines.map((l) => (
                  <InsetRow key={l.id} href={l.unitId ? `/dong-ho/${l.unitId}` : undefined}
                    {...(l.lineType === "watch" ? { thumb: <WatchArt crop="head" seed={artSeed(l.brandName, l.modelName)} brand={l.brandName} model={l.modelName} /> } : { icon: <Boxes size={20} aria-hidden="true" />, tone: "repair" as const })}
                    title={l.lineType === "watch" ? joinTitle(l.brandName, l.modelName) : `${l.partName} × ${l.qty}`}
                    subtitle={`${l.assetCode ?? l.partCode ?? ""}${l.cost != null ? ` · giá vốn ${formatVnd(l.cost)}` : ""}${l.basePrice != null ? ` · giá thu CTV ${formatVnd(l.basePrice)} · CTV hưởng ${formatVnd(l.collabEarn ?? 0)}` : ""}`}
                    end={formatVnd(l.lineTotal)} endSub={l.listPrice !== l.unitPrice ? `Niêm yết ${formatVnd(l.listPrice)}` : undefined} />
                ))}
              </InsetList>
              {s.lines.some((l) => l.cost !== undefined) && <LockNote />}
            </section>

            {s.tradeIns.length > 0 && (
              <section aria-label="Máy cũ thu về"><div className="wf-sec"><h3>Máy cũ thu về</h3></div>
                <InsetList>{s.tradeIns.map((t) => <InsetRow key={t.id} icon={<RefreshCw size={20} aria-hidden="true" />} tone="check" title={t.assetCode ?? "Máy cũ (chờ xác nhận)"} end={formatVnd(t.credit)} />)}</InsetList>
              </section>
            )}

            <section aria-label="Thanh toán"><div className="wf-sec"><h3>Lịch sử thanh toán</h3></div>
              {s.payments.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Chưa có khoản thu nào.</p></div> : (
                <InsetList>
                  {s.payments.map((p) => <InsetRow key={p.id} icon={p.method === "cash" ? <Banknote size={20} aria-hidden="true" /> : <QrCode size={20} aria-hidden="true" />} tone={p.status === "voided" ? "bad" : p.method === "cash" ? "ok" : "info"} title={`${METHOD_LABELS[p.method]} · ${p.code}`} subtitle={`${formatDateTimeVn(p.createdAt)} · ${p.createdByName ?? ""}${p.voidReason ? ` · ${p.voidReason}` : ""}`} end={formatVnd(p.amount)} endSub={p.status === "voided" ? <StatusChip tone="bad">Đã hủy</StatusChip> : undefined} />)}
                </InsetList>
              )}
            </section>

            {s.warranties.length > 0 && (
              <section aria-label="Bảo hành"><div className="wf-sec"><h3>Bảo hành</h3></div>
                <InsetList>{s.warranties.map((w) => <InsetRow key={w.id} icon={<ShieldCheck size={20} aria-hidden="true" />} tone="ok" title={w.code} subtitle={`${formatDateVn(w.startDate)} – ${formatDateVn(w.endDate)}`} end={<StatusChip kind="warranty" status={w.status} />} />)}</InsetList>
              </section>
            )}
          </div>
        )}
        {s && s.balance && <PaymentSheet open={pay} onClose={() => setPay(false)} payable={s.balance.due} submitting={paying} onSubmit={(l) => void collect(l)} title="Thu thêm" reference={s.code} fallbackRef="THU THEM" />}
        <ConfirmDialog
          open={voidOpen}
          danger
          requireReason
          loading={busy}
          title={`Hủy phiếu ${s?.code ?? ""}?`}
          message={`Trả máy về kho và hủy các khoản thu${s?.balance && s.balance.paidNet > 0 ? ` (${formatVnd(s.balance.paidNet)})` : ""}. Chỉ hủy được trong thời hạn cho phép. Cần xác nhận lại mật khẩu.`}
          confirmLabel="Hủy phiếu"
          onCancel={() => setVoidOpen(false)}
          onConfirm={(r) => void doVoid(r)}
        />
      </RequirePerm>
    </>
  );
}
