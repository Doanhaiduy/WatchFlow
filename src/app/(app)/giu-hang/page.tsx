"use client";
import { Bookmark, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { HoldButton } from "@/components/lucian/HoldButton";
import { ReservationModal } from "@/components/trade/ReservationModal";
import type { Reservation } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Textarea } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

const GROUPS: Record<string, string> = { open: "active,expired", done: "converted", closed: "cancelled,forfeited" };

function CancelModal({ r, onClose, onDone }: { r: Reservation | null; onClose: () => void; onDone: () => Promise<unknown> }) {
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const [mode, setMode] = useState<"refund" | "forfeit">("refund");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef("");
  useEffect(() => {
    if (r) { setMode("refund"); setMethod("cash"); setReason(""); setErr(null); key.current = newIdempotencyKey(); }
  }, [r]);
  const missing = Math.max(0, 10 - reason.trim().length);
  const run = async () => {
    if (!r) return;
    setBusy(true);
    setErr(null);
    try {
      const call = () => sapi(`/api/v1/reservations/${r.id}/cancel`, { body: { mode, method, reason: reason.trim() || undefined }, idempotencyKey: key.current });
      await (mode === "forfeit" ? withReauth(call) : call());
      toast.success(mode === "refund" ? "Đã hủy giữ và hoàn cọc" : "Đã tịch thu cọc");
      await onDone();
    } catch (e) {
      key.current = newIdempotencyKey();
      if (!isReauthCancelled(e)) setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!r} onClose={onClose} busy={busy} title={`Hủy giữ ${r?.code ?? ""}`}>
      <p className="wf-confirm-msg">Đang giữ cọc {formatVnd(r?.held ?? 0)}. Chiếc sẽ được trả về trạng thái sẵn sàng bán.</p>
      {can("reservation.forfeit") && <SegmentedControl ariaLabel="Xử lý tiền cọc" value={mode} onChange={setMode} options={[{ value: "refund", label: "Hoàn cọc" }, ...(can("reservation.forfeit") ? [{ value: "forfeit", label: "Tịch thu cọc" }] : [])] as Array<{ value: "refund" | "forfeit"; label: string }>} />}
      <div style={{ height: 12 }} />
      {mode === "refund" && <Field label="Hoàn bằng"><SegmentedControl ariaLabel="Hình thức hoàn" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} /></Field>}
      <Field label={mode === "forfeit" ? "Lý do tịch thu" : "Lý do (tùy chọn)"} required={mode === "forfeit"} hint={mode === "forfeit" && missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
      {mode === "refund" ? (
        <Button block variant="primary" loading={busy} onClick={() => void run()}>Hủy giữ & hoàn {formatVnd(r?.held ?? 0)}</Button>
      ) : (
        <>
          <p className="wf-fld-err" style={{ marginBottom: 8 }}>Tịch thu {formatVnd(r?.held ?? 0)} không hoàn tác được. Cần xác nhận lại mật khẩu.</p>
          <HoldButton label="Tịch thu cọc" disabled={busy || missing > 0} onConfirm={() => void run()} />
        </>
      )}
    </Modal>
  );
}

export default function ReservationsPage() {
  const { can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [g, setG] = useState<string[]>(["open"]);
  const grp = g[0] ?? "open";
  const { data, error, isLoading, mutate } = useSWR<{ items: Reservation[] }>(can(["reservation.manage", "sale.view"]) ? `/api/v1/reservations?status=${GROUPS[grp]}` : null, swrFetcher);
  const [create, setCreate] = useState(false);
  const [sel, setSel] = useState<Reservation | null>(null);
  const [cancel, setCancel] = useState<Reservation | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("moi") === "1" && can("reservation.manage")) setCreate(true);
  }, [can]);

  const convert = async (r: Reservation) => {
    try {
      const x = await sapi<{ saleId: string }>(`/api/v1/reservations/${r.id}/convert`, { method: "POST", idempotencyKey: newIdempotencyKey() });
      router.push(`/ban-hang/moi?sale=${x.saleId}`);
    } catch (e) {
      toast.error("Không chuyển được sang phiếu bán", errMsg(e));
    }
  };

  return (
    <>
      <PageHeader title="Giữ hàng" description="Đặt cọc giữ chiếc cho khách" actions={can("reservation.manage") ? <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreate(true)}>Giữ hàng</Button> : undefined} />
      <RequirePerm perm={["reservation.manage", "sale.view"]}>
        <FilterChips ariaLabel="Nhóm giữ hàng" value={g} onChange={(v) => setG(v.length ? v : ["open"])} options={[{ value: "open", label: "Đang giữ" }, { value: "done", label: "Đã chuyển bán" }, { value: "closed", label: "Đã hủy" }]} />
        {isLoading ? <SkeletonList rows={5} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Bookmark size={24} />} title={grp === "open" ? "Chưa có chiếc nào đang giữ" : "Chưa có phiếu giữ nào"} description="Giữ chiếc cho khách đặt cọc để không bán nhầm." action={grp === "open" && can("reservation.manage") ? { label: "Giữ hàng", onClick: () => setCreate(true) } : undefined} /></div>
        ) : (
          <InsetList label="Danh sách giữ hàng">
            {data?.items.map((r) => (
              <InsetRow
                key={r.id}
                onClick={() => setSel(r)}
                icon={<Bookmark size={20} aria-hidden="true" />}
                tone={r.overdue ? "bad" : r.status === "active" ? "hold" : r.status === "converted" ? "ok" : "neutral"}
                title={r.modelName}
                subtitle={[r.assetCode, r.customerName, r.customerPhone, `đến ${formatDateVn(r.holdUntil)}`].filter(Boolean).join(" · ")}
                end={formatVnd(r.held ?? r.received ?? 0)}
                endSub={r.overdue ? <StatusChip tone="bad">Quá hạn</StatusChip> : <StatusChip kind="reservation" status={r.status} />}
              />
            ))}
          </InsetList>
        )}
        <ReservationModal open={create} onClose={() => setCreate(false)} onDone={async () => { setCreate(false); await mutate(); }} />
        <Modal open={!!sel && !cancel} onClose={() => setSel(null)} title={sel ? `Giữ hàng ${sel.code}` : ""}>
          {sel && (
            <>
              <div className="wf-dev-row" style={{ marginBottom: 8 }}>{sel.overdue ? <StatusChip tone="bad">Quá hạn giữ</StatusChip> : <StatusChip kind="reservation" status={sel.status} />}</div>
              <KeyValue items={[
                { label: "Chiếc", value: `${sel.modelName} · ${sel.assetCode}` },
                { label: "Khách", value: `${sel.customerName}${sel.customerPhone ? ` · ${sel.customerPhone}` : ""}` },
                { label: "Giá lúc giữ", value: formatVnd(sel.priceSnapshot) },
                { label: "Cọc tối thiểu", value: formatVnd(sel.minDeposit) },
                { label: "Cọc đang giữ", value: <b>{formatVnd(sel.held ?? 0)}</b> },
                { label: "Giữ đến", value: formatDateVn(sel.holdUntil) },
                { label: "Ghi chú", value: sel.note ?? "—" },
              ]} />
              {["active", "expired"].includes(sel.status) && (
                <div className="wf-dev-row" style={{ marginTop: 14 }}>
                  {can("sale.create_draft") && <Button variant="primary" onClick={() => void convert(sel)}>Chuyển thành bán</Button>}
                  {can("reservation.manage") && <Button onClick={() => setCancel(sel)}>Hủy giữ</Button>}
                </div>
              )}
              {sel.saleId && <div style={{ marginTop: 12 }}><Button href={`/ban-hang/${sel.saleId}`}>Xem phiếu bán</Button></div>}
            </>
          )}
        </Modal>
        <CancelModal r={cancel} onClose={() => setCancel(null)} onDone={async () => { setCancel(null); setSel(null); await mutate(); }} />
      </RequirePerm>
    </>
  );
}
