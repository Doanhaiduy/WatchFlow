"use client";
import { joinTitle } from "@/components/catalog/types";
import { Ban } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { PurchaseForm } from "@/components/purchases/PurchaseForm";
import type { PurchaseDetail } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, LockNote } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { COST_LABELS, KIND_LABELS } from "@/lib/types/purchases";

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const d = useSWR<PurchaseDetail>(can("purchase.view") ? `/api/v1/purchases/${id}` : null, swrFetcher, { revalidateOnFocus: false });
  const p = d.data;
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doVoid = async (reason?: string) => {
    setBusy(true);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/purchases/${id}/void`, { body: { reason }, idempotencyKey: key }));
      toast.success("Đã hủy phiếu nhập");
      setVoidOpen(false);
      await d.mutate();
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không hủy được phiếu", errMsg(e)); // WF-PUR-HAS-DEPENDENTS: máy chủ nêu rõ chiếc đã phát sinh giao dịch
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={p?.code ?? (p ? "Phiếu nhập nháp" : "Phiếu nhập")} description={p ? KIND_LABELS[p.kind] : undefined} />
      <RequirePerm perm="purchase.view">
        {d.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={160} radius={26} /><Skeleton h={200} radius={26} /></SkeletonGroup>
        ) : d.error || !p ? (
          <div className="g wf-pad"><ErrorState title="Không mở được phiếu nhập" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : p.status === "draft" && can("purchase.create") ? (
          <PurchaseForm key={p.id} initial={p} onSaved={() => undefined} />
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin phiếu">
              <div className="wf-dev-row" style={{ marginBottom: 8 }}><StatusChip kind="doc" status={p.status} /><StatusChip tone="info">{KIND_LABELS[p.kind]}</StatusChip></div>
              <KeyValue
                items={[
                  { label: p.kind === "customer_buyback" ? "Người bán" : "Nguồn", value: p.sellerName ?? p.sourceName ?? "—" },
                  { label: "Ngày chứng từ", value: formatDateVn(p.docDate) },
                  { label: "Tiền hàng", value: formatVnd(p.subtotal) },
                  { label: "Chi phí phát sinh", value: formatVnd(p.extraCostTotal) },
                  { label: "Tổng phiếu", value: <b>{formatVnd(p.grandTotal)}</b> },
                  { label: "Lập bởi", value: `${p.createdByName ?? "—"} · ${formatDateTimeVn(p.createdAt)}` },
                  ...(p.confirmedAt ? [{ label: "Xác nhận", value: `${p.confirmedByName ?? "—"} · ${formatDateTimeVn(p.confirmedAt)}` }] : []),
                  ...(p.voidedAt ? [{ label: "Hủy lúc", value: `${formatDateTimeVn(p.voidedAt)} — ${p.voidReason ?? ""}` }] : []),
                  { label: "Ghi chú", value: p.note ?? "—" },
                ]}
              />
            </section>
            <section aria-label="Các dòng">
              <div className="wf-sec"><h3>Các dòng ({p.lines.length})</h3></div>
              <InsetList>
                {p.lines.map((l) => (
                  <InsetRow
                    key={l.id}
                    href={l.unitId ? `/dong-ho/${l.unitId}` : undefined}
                    title={l.lineType === "watch" ? joinTitle(l.brandName, l.modelName) : `${l.partName ?? "Linh kiện"} × ${l.qty}`}
                    subtitle={l.lineType === "watch" ? `${l.assetCode ?? "chưa có mã"}${l.serialNo ? ` · ${l.serialNo}` : ""}` : l.partCode ?? ""}
                    end={formatVnd(l.lineTotal ?? l.unitPrice * l.qty)}
                    endSub={can("cost.view") && l.unitCost !== undefined ? `Giá vốn ${formatVnd(Math.round(l.unitCost))}` : undefined}
                  />
                ))}
              </InsetList>
              {can("cost.view") && <LockNote />}
            </section>
            {p.costs.length > 0 && (
              <section aria-label="Chi phí">
                <div className="wf-sec"><h3>Chi phí phát sinh</h3></div>
                <InsetList>{p.costs.map((c, i) => <InsetRow key={c.id ?? i} title={COST_LABELS[c.kind as keyof typeof COST_LABELS] ?? c.kind} subtitle={`${c.description ?? ""} ${c.allocateMethod === "equal" ? "· chia đều" : "· theo giá trị"}`.trim()} end={formatVnd(c.amount)} />)}</InsetList>
              </section>
            )}
            {p.files.length > 0 && (
              <section className="g wf-pad" aria-label="Ảnh chứng từ">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ảnh đính kèm</h3>
                <PhotoGrid photos={p.files.map((f) => ({ id: f.id, url: `/api/v1/files/${f.id}`, thumbUrl: f.thumbUrl }))} label="ảnh đính kèm" />
              </section>
            )}
            {p.status === "confirmed" && can("purchase.void") && <Button variant="danger" icon={<Ban size={16} aria-hidden="true" />} onClick={() => setVoidOpen(true)}>Hủy phiếu nhập</Button>}
            <Button href="/nhap-hang">← Danh sách phiếu nhập</Button>
          </div>
        )}
        <ConfirmDialog
          open={voidOpen}
          danger
          requireReason
          loading={busy}
          title={`Hủy phiếu ${p?.code ?? ""}?`}
          message="Các chiếc và linh kiện đã nhập sẽ bị rút khỏi kho. Chỉ hủy được khi chưa có giao dịch nào dùng đến chúng. Cần xác nhận lại mật khẩu."
          confirmLabel="Hủy phiếu"
          onCancel={() => setVoidOpen(false)}
          onConfirm={(r) => void doVoid(r)}
        />
      </RequirePerm>
    </>
  );
}
