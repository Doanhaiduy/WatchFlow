"use client";
import { Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { PartModal } from "@/components/catalog/PartModal";
import type { Part } from "@/components/catalog/types";
import { QuantityStepper } from "@/components/lucian/QuantityStepper";
import { Button } from "@/components/ui/Button";
import { KeyValue, LockNote, Timeline } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Textarea } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

type Move = { id: string; qtyDelta: number; kind: string; prevQty: number; reason: string | null; at: string; actorName: string | null; unitCost?: string | null };
const KIND: Record<string, string> = { adjustment: "Điều chỉnh tồn", purchase: "Nhập hàng", receipt: "Nhập hàng", repair_use: "Dùng cho sửa chữa", repair_return: "Hoàn từ sửa chữa", stocktake: "Kiểm kê", opening: "Tồn đầu kỳ" };

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const part = useSWR<Part>(can("part.view") ? `/api/v1/parts/${id}` : null, swrFetcher);
  const moves = useSWR<{ items: Move[] }>(part.data && can(["part.manage", "cost.view"]) ? `/api/v1/parts/${id}/movements` : null, swrFetcher);
  const [edit, setEdit] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const p = part.data;
  const missing = Math.max(0, 10 - reason.trim().length);

  const adjust = async () => {
    setBusy(true);
    try {
      await sapi(`/api/v1/parts/${id}/adjust`, { body: { delta, reason: reason.trim() }, idempotencyKey: newIdempotencyKey() });
      await Promise.all([part.mutate(), moves.mutate()]);
      toast.success("Đã điều chỉnh tồn kho");
      setDelta(0);
      setReason("");
    } catch (e) {
      toast.error("Không điều chỉnh được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={p?.name ?? "Linh kiện"} context={p?.code} description={p?.categoryName} actions={p && can("part.manage") ? <Button sm icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEdit(true)}>Sửa</Button> : undefined} />
      <RequirePerm perm="part.view">
        {part.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={180} radius={26} /><Skeleton h={160} radius={26} /></SkeletonGroup>
        ) : part.error || !p ? (
          <div className="g wf-pad"><ErrorState title="Không mở được linh kiện" description={errMsg(part.error)} onRetry={async () => (await part.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin">
              <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <p className="wf-mute">Tồn kho</p>
                  <div className="wf-uprice" style={{ color: p.isLow ? "var(--wf-hold-text)" : undefined }}>{p.qtyOnHand} <small style={{ fontSize: 14, fontWeight: 600 }}>{p.uom}</small></div>
                </div>
                {!p.isActive ? <StatusChip tone="neutral">Đã tắt</StatusChip> : p.qtyOnHand <= p.reorderLevel ? <StatusChip tone="hold">Sắp hết</StatusChip> : <StatusChip tone="ok">Đủ hàng</StatusChip>}
              </div>
              <KeyValue
                items={[
                  { label: "Mã", value: p.code },
                  { label: "Loại", value: p.categoryName },
                  { label: "Giá bán", value: formatVnd(p.salePrice) },
                  { label: "Mức đặt hàng lại", value: `${p.reorderLevel} ${p.uom}` },
                  ...(p.avgCost !== undefined ? [{ label: "Giá vốn bình quân", value: p.avgCost === null ? "—" : formatVnd(Math.round(Number(p.avgCost))) }] : []),
                  { label: "Thông số", value: p.specs || "—" },
                ]}
              />
              {p.avgCost !== undefined && <LockNote />}
            </section>

            <section className="g wf-pad" aria-label="Tương thích">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Dùng được cho</h3>
              {p.compatibility && p.compatibility.length > 0 ? (
                <div className="wf-dev-row">{p.compatibility.map((c) => <StatusChip key={c.id} tone="info">{c.brandName}{c.modelName ? ` · ${c.modelName}` : ""}</StatusChip>)}</div>
              ) : <p className="wf-mute">Chưa khai báo thương hiệu/loại tương thích.</p>}
            </section>

            {can("part.stock.adjust") && (
              <section className="g wf-pad" aria-label="Điều chỉnh tồn">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Điều chỉnh tồn kho</h3>
                <p className="wf-mute" style={{ marginBottom: 10 }}>Sau điều chỉnh: <b className="wf-num">{p.qtyOnHand + delta} {p.uom}</b></p>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <QuantityStepper ariaLabel="Số lượng điều chỉnh" value={delta} onChange={setDelta} min={Math.max(-99, -p.qtyOnHand)} max={99} signed />
                </div>
                <Field label="Lý do" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : "Ghi vào nhật ký tồn kho"}>
                  <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ví dụ: kiểm đếm thiếu 2 pin" />
                </Field>
                <Button block variant="primary" loading={busy} disabled={delta === 0 || missing > 0} onClick={() => void adjust()}>Lưu điều chỉnh</Button>
              </section>
            )}

            {can(["part.manage", "cost.view"]) && (
              <section className="g wf-pad" aria-label="Lịch sử xuất nhập">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Lịch sử xuất nhập</h3>
                {moves.isLoading ? <Skeleton h={80} /> : moves.error ? <p className="wf-fld-err">{errMsg(moves.error)}</p> : moves.data && moves.data.items.length > 0 ? (
                  <>
                    <Timeline items={moves.data.items.map((m) => ({ title: `${m.qtyDelta > 0 ? "+" : ""}${m.qtyDelta} ${p.uom} · ${KIND[m.kind] ?? m.kind}${m.unitCost ? ` · giá vốn ${formatVnd(Math.round(Number(m.unitCost)))}` : ""}`, meta: `${formatDateTimeVn(m.at)} · ${m.actorName ?? "Hệ thống"} · tồn trước ${m.prevQty}${m.reason ? ` · ${m.reason}` : ""}` }))} />
                    {moves.data.items.some((m) => m.unitCost !== undefined) && <LockNote />}
                  </>
                ) : <p className="wf-mute">Chưa có biến động tồn.</p>}
              </section>
            )}
          </div>
        )}
        <PartModal part={p ?? null} open={edit} onClose={() => setEdit(false)} onDone={async () => { await part.mutate(); setEdit(false); }} />
      </RequirePerm>
    </>
  );
}
