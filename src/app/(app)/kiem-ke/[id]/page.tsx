"use client";
import { Ban, Check, EyeOff, ScanLine } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ScanDialog } from "@/components/catalog/ScanDialog";
import { REASON_LABEL, SCOPE_LABEL, ST_LABEL, type StocktakeDetail, type StocktakeLine } from "@/components/stocktake/meta";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { ApiClientError } from "@/lib/api-client";

export default function StocktakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const d = useSWR<StocktakeDetail>(can("stocktake.manage") ? `/api/v1/stocktakes/${id}` : null, swrFetcher);
  const s = d.data;
  const open = !!s && !["reconciled", "cancelled"].includes(s.status);
  const [code, setCode] = useState("");
  const [scan, setScan] = useState(false);
  const [filter, setFilter] = useState<string[]>(["todo"]);
  const [missing, setMissing] = useState<StocktakeLine | null>(null);
  const [recon, setRecon] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reconErr, setReconErr] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const post = async (body: object, ok?: string) => {
    try {
      await sapi(`/api/v1/stocktakes/${id}/lines`, { body });
      await d.mutate();
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error("Không ghi nhận được", errMsg(e));
      return false;
    }
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (await post({ code: code.trim(), counted: 1 }, "Đã đếm")) setCode("");
  };

  const lines = s?.lines ?? [];
  const counted = lines.filter((l) => l.countedQty !== null).length;
  const diffs = lines.filter((l) => (l.diffQty ?? 0) !== 0);
  const shown = useMemo(() => (filter[0] === "diff" ? diffs : filter[0] === "todo" ? lines.filter((l) => l.countedQty === null) : lines), [filter, lines, diffs]);

  const reconcile = async () => {
    setBusy(true);
    setReconErr(null);
    try {
      await sapi(`/api/v1/stocktakes/${id}/reconcile`, { method: "POST", idempotencyKey: key.current });
      toast.success("Đã chốt kiểm kê");
      setRecon(false);
      await d.mutate();
    } catch (e) {
      key.current = newIdempotencyKey();
      setReconErr(e instanceof ApiClientError && e.code === "WF-AUTH-FORBIDDEN" ? "Đợt này có chiếc bị mất cần ghi mất — cần chủ cửa hàng (quyền ghi mất) chốt." : errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const doCancel = async (reason?: string) => {
    setBusy(true);
    try {
      await sapi(`/api/v1/stocktakes/${id}/cancel`, { body: { reason } });
      toast.success("Đã hủy đợt kiểm kê");
      setCancel(false);
      await d.mutate();
    } catch (e) {
      toast.error("Không hủy được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const st = s ? (ST_LABEL[s.status] ?? { label: s.status, tone: "neutral" as const }) : null;
  return (
    <>
      <PageHeader title={s?.code ?? "Kiểm kê"} description={s ? SCOPE_LABEL[s.scope] ?? s.scope : undefined} />
      <RequirePerm perm="stocktake.manage">
        {d.isLoading ? <SkeletonGroup className="wf-stack"><Skeleton h={120} radius={26} /><Skeleton h={220} radius={26} /></SkeletonGroup> : d.error || !s ? (
          <div className="g wf-pad"><ErrorState title="Không mở được đợt kiểm kê" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Tóm tắt">
              <div className="wf-dev-row" style={{ marginBottom: 6 }}>{st && <StatusChip tone={st.tone}>{st.label}</StatusChip>}</div>
              <KeyValue items={[
                { label: "Bắt đầu", value: formatDateTimeVn(s.startedAt) },
                { label: "Đã đếm", value: `${counted}/${lines.length}` },
                { label: "Dòng lệch", value: <b style={{ color: diffs.length ? "var(--wf-hold-text)" : undefined }}>{diffs.length}</b> },
                ...(s.reconciledAt ? [{ label: "Chốt lúc", value: formatDateTimeVn(s.reconciledAt) }] : []),
                ...(s.note ? [{ label: "Ghi chú", value: s.note }] : []),
              ]} />
              {open && <Button sm variant="danger" style={{ marginTop: 10 }} icon={<Ban size={16} aria-hidden="true" />} onClick={() => setCancel(true)}>Hủy đợt</Button>}
            </section>

            {open && (
              <section className="g wf-pad" aria-label="Đếm hàng">
                <form onSubmit={submitCode} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
                  <TextInput aria-label="Mã nội bộ hoặc serial" placeholder="Mã chiếc hoặc serial" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
                  <Button type="submit" variant="primary" disabled={!code.trim()}>Đếm</Button>
                  <Button iconOnly aria-label="Quét QR" onClick={() => setScan(true)}><ScanLine size={18} aria-hidden="true" /></Button>
                </form>
              </section>
            )}

            <FilterChips ariaLabel="Lọc dòng kiểm kê" value={filter} onChange={(v) => setFilter(v.length ? v : ["todo"])} options={[{ value: "todo", label: "Chưa đếm", count: lines.length - counted }, { value: "diff", label: "Lệch", count: diffs.length }, { value: "all", label: "Tất cả", count: lines.length }]} />

            {shown.length === 0 ? <div className="g wf-pad"><p className="wf-mute">{filter[0] === "diff" ? "Không có dòng lệch." : filter[0] === "todo" ? "Đã đếm hết các dòng." : "Chưa có dòng nào."}</p></div> : (
              <InsetList label="Dòng kiểm kê">
                {shown.map((l) => (
                  <LineRow key={l.id} l={l} open={open} onCount={(n) => void post({ ...(l.unitId ? { unitId: l.unitId } : { partId: l.partId }), counted: n }, "Đã ghi")} onMissing={() => setMissing(l)} />
                ))}
              </InsetList>
            )}

            {open && (
              <div className="wf-sticky-save g" role="region" aria-label="Chốt kiểm kê">
                <span style={{ fontWeight: 700, fontSize: 14 }}>Đã đếm {counted}/{lines.length}</span>
                <Button sm variant="primary" icon={<Check size={16} aria-hidden="true" />} onClick={() => { setReconErr(null); setRecon(true); }}>Chốt kiểm kê</Button>
              </div>
            )}
          </div>
        )}
        <ScanDialog open={scan} continuous onClose={() => setScan(false)} onFound={(u) => { void post({ unitId: u.id, counted: 1 }, `Đã đếm ${u.assetCode}`); }} />
        <MissingModal l={missing} onClose={() => setMissing(null)} onSubmit={async (reason, note) => { if (missing && (await post({ ...(missing.unitId ? { unitId: missing.unitId } : { partId: missing.partId }), counted: missing.subjectType === "unit" ? 0 : (missing.countedQty ?? missing.systemQty), reasonCode: reason, note: note || null }, missing.subjectType === "unit" ? "Đã ghi: không thấy" : "Đã ghi lý do lệch"))) setMissing(null); }} />
        <ConfirmDialog
          open={recon}
          title="Chốt kiểm kê?"
          message={<>{lines.length - counted > 0 ? <b style={{ display: "block", marginBottom: 6 }}>Còn {lines.length - counted} dòng chưa đếm.</b> : null}Số hệ thống được lấy lại lúc chốt. {diffs.length} dòng lệch sẽ được điều chỉnh; chiếc không thấy sẽ ghi mất, linh kiện lệch tạo biến động tồn.{s && lines.some((l) => l.loss !== undefined) ? ` Tổn thất ước tính: ${formatVnd(lines.reduce((a, l) => a + Number(l.loss ?? 0), 0))}.` : ""}{reconErr && <b style={{ display: "block", color: "var(--wf-bad-text)", marginTop: 6 }}>{reconErr}</b>}</>}
          confirmLabel="Chốt"
          loading={busy}
          onCancel={() => setRecon(false)}
          onConfirm={() => void reconcile()}
        />
        <ConfirmDialog open={cancel} danger requireReason title="Hủy đợt kiểm kê?" message="Số đếm đã nhập sẽ bị bỏ, không điều chỉnh tồn kho." confirmLabel="Hủy đợt" loading={busy} onCancel={() => setCancel(false)} onConfirm={(r) => void doCancel(r)} />
      </RequirePerm>
    </>
  );
}

function LineRow({ l, open, onCount, onMissing }: { l: StocktakeLine; open: boolean; onCount: (n: number) => void; onMissing: () => void }) {
  const [n, setN] = useState(String(l.countedQty ?? l.systemQty ?? 0));
  useEffect(() => setN(String(l.countedQty ?? l.systemQty ?? 0)), [l.countedQty, l.systemQty]);
  const unit = l.subjectType === "unit";
  const diff = l.diffQty ?? 0;
  return (
    <div className="wf-ir" role="listitem" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
      <span className="wf-irm">
        <b style={{ whiteSpace: "normal" }}>{unit ? (l.modelName ?? l.assetCode) : `${l.partName} (${l.partCode})`}</b>
        <span>{unit ? `${l.assetCode} · ${l.locationName ?? "chưa đặt vị trí"}${l.serialNo ? ` · SN ${l.serialNo}` : ""}` : `Hệ thống: ${l.systemQty}`}{l.reasonCode ? ` · ${REASON_LABEL[l.reasonCode] ?? l.reasonCode}` : ""}</span>
      </span>
      <span className="wf-ire">
        {l.countedQty === null ? <StatusChip tone="neutral">Chưa đếm</StatusChip> : diff !== 0 ? <StatusChip tone="hold">Lệch {diff > 0 ? "+" : ""}{diff}</StatusChip> : <StatusChip tone="ok">Khớp</StatusChip>}
      </span>
      {open && (
        <div style={{ flexBasis: "100%", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {unit ? (
            <>
              <Button sm onClick={() => onCount(1)} disabled={l.countedQty === 1}>Đã thấy</Button>
              <Button sm icon={<EyeOff size={14} aria-hidden="true" />} onClick={onMissing}>Không thấy</Button>
            </>
          ) : (
            <>
              <TextInput aria-label={`Số đếm ${l.partName}`} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} style={{ width: 90, minHeight: 40 }} />
              <Button sm variant="primary" onClick={() => onCount(Number(n) || 0)}>Ghi số đếm</Button>
              {Number(n) !== l.systemQty && <Button sm onClick={onMissing}>Ghi lý do lệch</Button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MissingModal({ l, onClose, onSubmit }: { l: StocktakeLine | null; onClose: () => void; onSubmit: (reason: string, note: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("lost");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (l) { setReason("lost"); setNote(""); } }, [l]);
  return (
    <Modal open={!!l} onClose={onClose} dirty={!!note.trim() || reason !== "lost"} busy={busy} title={l?.subjectType === "unit" ? "Không thấy chiếc này" : "Lý do lệch số lượng"} footer={<><ModalClose disabled={busy}>Hủy</ModalClose><Button variant="primary" guard loading={busy} onClick={async () => { setBusy(true); await onSubmit(reason, note.trim()); setBusy(false); }}>Ghi nhận</Button></>}>
      <p className="wf-confirm-msg">{l?.subjectType === "unit" ? `${l.assetCode}: ghi số đếm 0 kèm lý do.` : `${l?.partName}: ghi lý do cho số lệch.`}</p>
      <Field label="Lý do" required><Select value={reason} onChange={(e) => setReason(e.target.value)} options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
      <Field label="Ghi chú"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
    </Modal>
  );
}
