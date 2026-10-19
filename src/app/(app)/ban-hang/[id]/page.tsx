"use client";
import { Ban, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { joinTitle } from "@/components/catalog/types";
import type { SaleDetail } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const d = useSWR<SaleDetail>(can("sale.view") ? `/api/v1/sales/${id}` : null, swrFetcher);
  const s = d.data;
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doVoid = async (reason?: string) => {
    setBusy(true);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/sales/${id}/void`, { body: { reason }, idempotencyKey: key }));
      toast.success("Đã hủy đơn bán — chiếc đã về kho");
      setVoidOpen(false);
      await d.mutate();
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không hủy được đơn", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const canVoid = !!s && s.status === "confirmed" && can("sale.void") && (!s.voidUntil || Date.parse(s.voidUntil) > Date.now());

  return (
    <>
      <PageHeader title={s?.code ?? "Đơn bán"} description={s?.customerName ?? "Khách lẻ"} />
      <RequirePerm perm="sale.view">
        {d.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={180} radius={26} /><Skeleton h={160} radius={26} /></SkeletonGroup>
        ) : d.error || !s ? (
          <div className="g wf-pad"><ErrorState title="Không mở được đơn bán" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin đơn">
              <div className="wf-dev-row" style={{ marginBottom: 8 }}>
                <StatusChip kind="doc" status={s.status} />
                {s.collaboratorName && <StatusChip tone="check">CTV {s.collaboratorName}</StatusChip>}
              </div>
              <div className="wf-uprice">{formatVnd(s.grandTotal)}</div>
              <KeyValue
                items={[
                  { label: "Khách", value: s.customerName ? (s.customerId && can(["customer.view", "customer.view_own"]) ? <Link href={`/khach-hang/${s.customerId}`} style={{ color: "var(--wf-accent-text)", fontWeight: 600 }}>{s.customerName}{s.customerPhone ? ` · ${s.customerPhone}` : ""}</Link> : `${s.customerName}${s.customerPhone ? ` · ${s.customerPhone}` : ""}`) : "Khách lẻ" },
                  { label: "Ngày bán", value: formatDateVn(s.docDate) },
                  ...(s.discountTotal > 0 ? [{ label: "Niêm yết", value: `${formatVnd(s.subtotalList)} (bán thấp hơn ${formatVnd(s.discountTotal)})` }] : []),
                  ...(s.note ? [{ label: "Ghi chú", value: s.note }] : []),
                  ...(s.confirmedAt ? [{ label: "Ghi lúc", value: `${s.confirmedByName ?? "—"} · ${formatDateTimeVn(s.confirmedAt)}` }] : []),
                  ...(s.voidedAt ? [{ label: "Đã hủy", value: `${formatDateTimeVn(s.voidedAt)} — ${s.voidReason ?? ""}` }] : []),
                ]}
              />
              <div className="wf-dev-row" style={{ marginTop: 12 }}>
                {s.status === "confirmed" && <Button variant="primary" href={`/ban-hang/${s.id}/in`} icon={<Printer size={16} aria-hidden="true" />}>In phiếu</Button>}
                {canVoid && <Button icon={<Ban size={16} aria-hidden="true" />} onClick={() => setVoidOpen(true)}>Hủy đơn</Button>}
              </div>
              {s.status === "confirmed" && can("sale.void") && !canVoid && <p className="wf-mute" style={{ marginTop: 8, fontSize: 13 }}>Đã quá thời hạn hủy đơn.</p>}
            </section>

            <section aria-label="Đồng hồ đã bán"><div className="wf-sec"><h3>Đồng hồ đã bán</h3></div>
              <InsetList>
                {s.lines.map((l) => (
                  <InsetRow key={l.id} href={`/dong-ho/${l.unitId}`} wrap thumb={l.thumbUrl ? <img src={l.thumbUrl} alt="" loading="lazy" width={48} height={48} /> : <WatchArt crop="head" seed={artSeed(l.brandName, l.modelName)} brand={l.brandName} model={l.modelName} />}
                    title={joinTitle(l.brandName, l.modelName)}
                    subtitle={[`${l.assetCode}${l.serialNo ? ` · ${l.serialNo}` : ""}`, l.warrantyEnd ? `Bảo hành đến ${formatDateVn(l.warrantyEnd)}` : "Không bảo hành"].join(" · ")}
                    end={formatVnd(l.lineTotal)} endSub={l.listPrice !== l.unitPrice ? `Niêm yết ${formatVnd(l.listPrice)}` : l.warrantyEnd ? <span className="wf-dev-row" style={{ gap: 4 }}><ShieldCheck size={12} aria-hidden="true" /> BH</span> : undefined} />
                ))}
              </InsetList>
            </section>
          </div>
        )}
        <ConfirmDialog
          open={voidOpen}
          danger
          requireReason
          loading={busy}
          title={`Hủy đơn ${s?.code ?? ""}?`}
          message="Các chiếc trong đơn trở về kho (sẵn sàng bán). Chỉ hủy được trong thời hạn cho phép; cần xác nhận lại mật khẩu. Nếu chỉ nhập sai, hãy hủy rồi ghi lại đơn mới."
          confirmLabel="Hủy đơn"
          onCancel={() => setVoidOpen(false)}
          onConfirm={(r) => void doVoid(r)}
        />
      </RequirePerm>
    </>
  );
}
