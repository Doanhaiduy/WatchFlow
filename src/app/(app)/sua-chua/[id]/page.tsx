"use client";
import { Ban, Check, HandCoins, PackageCheck, Plus, Printer, Trash2, Truck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Part } from "@/components/catalog/types";
import { ImageUpload } from "@/components/lucian/ImageUpload";
import { PaymentSheet, TransferQr, type PaymentLineInput } from "@/components/payments";
import { repairTotal, type RepairDetail, type RepairLine, type ServiceType } from "@/components/repairs/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, LockNote, Timeline } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusInfo } from "@/components/ui/status";
import { DateInput } from "@/components/ui/DateInput";
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/types/catalog";

type Dlg = "" | "line" | "complete" | "deliver" | "deliver0" | "cancel" | "pay" | "collect" | "edit";
const NEXT: Record<string, Array<{ to: "inspecting" | "repairing" | "waiting_parts"; label: string }>> = {
  received: [{ to: "inspecting", label: "Bắt đầu kiểm tra" }],
  inspecting: [{ to: "repairing", label: "Bắt đầu sửa" }, { to: "waiting_parts", label: "Chờ linh kiện" }],
  repairing: [{ to: "waiting_parts", label: "Chờ linh kiện" }],
  waiting_parts: [{ to: "repairing", label: "Tiếp tục sửa" }],
};

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const d = useSWR<RepairDetail>(can("repair.view") ? `/api/v1/repairs/${id}` : null, swrFetcher);
  const r = d.data;
  const [dlg, setDlg] = useState<Dlg>("");
  const [editLine, setEditLine] = useState<RepairLine | null>(null);
  const [busy, setBusy] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      await d.mutate();
      toast.success(ok);
      setDlg("");
      setEditLine(null);
    } catch (e) {
      toast.error(fail, errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const open = !!r && !["completed", "delivered", "cancelled"].includes(r.status);
  const editable = !!r && !["delivered", "cancelled"].includes(r.status);
  const total = r ? repairTotal(r) : 0;
  const paid = r ? (r.paidNet ?? r.held ?? 0) : 0;
  const payable = r ? (r.chargeMode === "warranty_free" ? 0 : Math.max(0, r.status === "delivered" ? (r.due ?? 0) : total - paid)) : 0;

  return (
    <>
      <PageHeader title={r?.code ?? "Phiếu sửa"} description={r ? `${r.watchLabel ?? "Đồng hồ"}${r.serialNo ? ` · ${r.serialNo}` : ""}` : undefined} />
      <RequirePerm perm="repair.view">
        {d.isLoading ? <SkeletonGroup className="wf-stack"><Skeleton h={160} radius={26} /><Skeleton h={200} radius={26} /></SkeletonGroup> : d.error || !r ? (
          <div className="g wf-pad"><ErrorState title="Không mở được phiếu sửa" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin phiếu">
              <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span className="wf-dev-row"><StatusChip kind="repair" status={r.status} />{r.chargeMode === "warranty_free" && <StatusChip tone="ok">Bảo hành miễn phí</StatusChip>}{r.kind === "internal" && <StatusChip tone="info">Sửa nội bộ</StatusChip>}</span>
                <ProgressRing value={r.progress} tone={r.status === "cancelled" ? "bad" : "repair"} />
              </div>
              <KeyValue items={[
                { label: "Khách", value: r.kind === "internal" ? "Máy cửa hàng" : `${r.customerName ?? "—"}${r.customerPhone ? ` · ${r.customerPhone}` : ""}` },
                { label: "Nhận lúc", value: `${formatDateTimeVn(r.receivedAt)} · ${r.receivedByName ?? ""}` },
                { label: "Lỗi / yêu cầu", value: r.complaint ?? "—" },
                { label: "Tình trạng lúc nhận", value: r.intakeCondition ?? "—" },
                { label: "Kết quả kiểm tra", value: r.findings ?? "—" },
                { label: "Hẹn trả", value: r.expectedDate ? formatDateVn(r.expectedDate) : "—" },
                ...(r.cancelReason ? [{ label: "Lý do hủy", value: r.cancelReason }] : []),
                ...(r.warranty ? [{ label: "Bảo hành sau sửa", value: `${r.warranty.code} đến ${formatDateVn(r.warranty.endDate)}` }] : []),
              ]} />
              <div className="wf-dev-row" style={{ marginTop: 12 }}>
                <Button icon={<Printer size={16} aria-hidden="true" />} href={`/sua-chua/${r.id}/in?loai=nhan`}>In phiếu nhận</Button>
                {r.status === "delivered" && <Button icon={<Printer size={16} aria-hidden="true" />} href={`/sua-chua/${r.id}/in?loai=giao`}>In phiếu giao</Button>}
              </div>
            </section>

            {(can("repair.update") || can("repair.deliver")) && r.status !== "delivered" && r.status !== "cancelled" && (
              <section className="g wf-pad" aria-label="Thao tác">
                <div className="wf-act">
                  {can("repair.update") && (NEXT[r.status] ?? []).map((n) => <Button key={n.to} variant="primary" loading={busy} onClick={() => void run(() => sapi(`/api/v1/repairs/${id}/status`, { body: { to: n.to }, idempotencyKey: newIdempotencyKey() }), `Đã chuyển: ${statusInfo("repair", n.to).label}`, "Không đổi được trạng thái")}>{n.label}</Button>)}
                  {can("repair.update") && open && r.status !== "received" && <Button variant="primary" icon={<Check size={16} aria-hidden="true" />} onClick={() => setDlg("complete")}>Hoàn thành</Button>}
                  {can("repair.deliver") && r.status === "completed" && <Button variant="primary" icon={<Truck size={16} aria-hidden="true" />} onClick={() => setDlg(payable === 0 ? "deliver0" : "deliver")}>Giao máy</Button>}
                  {can("repair.update") && open && !r.quoteApprovedAt && <Button onClick={() => void run(() => sapi(`/api/v1/repairs/${id}/approve-quote`, { body: { channel: "Tại quầy" } }), "Đã ghi nhận khách đồng ý báo giá", "Không ghi nhận được")}>Khách đồng ý giá</Button>}
                  {can("payment.create") && r.kind === "customer" && <Button icon={<HandCoins size={16} aria-hidden="true" />} onClick={() => setDlg("collect")}>Nhận thêm tiền</Button>}
                  {can("repair.update") && open && <Button icon={<Ban size={16} aria-hidden="true" />} onClick={() => setDlg("cancel")}>Hủy phiếu</Button>}
                </div>
                {r.quoteApprovedAt && <p className="wf-mute" style={{ marginTop: 8 }}>Khách đã đồng ý giá lúc {formatDateTimeVn(r.quoteApprovedAt)}{r.quoteApprovedChannel ? ` (${r.quoteApprovedChannel})` : ""}.</p>}
              </section>
            )}
            {r.status === "delivered" && (r.due ?? 0) > 0 && can("payment.create") && <Button variant="primary" icon={<HandCoins size={16} aria-hidden="true" />} onClick={() => setDlg("pay")}>Thu nợ {formatVnd(r.due ?? 0)}</Button>}

            <section aria-label="Dịch vụ & linh kiện">
              <div className="wf-sec"><h3>Dịch vụ & linh kiện</h3>{editable && can("repair.update") && <button type="button" onClick={() => setDlg("line")}><Plus size={14} aria-hidden="true" /> Thêm dòng</button>}</div>
              {r.lines.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Chưa có dòng nào. Thêm dịch vụ hoặc linh kiện đã dùng.</p></div> : (
                <InsetList>
                  {r.lines.map((l) => (
                    <InsetRow
                      key={l.id}
                      title={l.lineType === "service" ? (l.serviceName ?? "Dịch vụ") : l.lineType === "part" ? `${l.partName ?? "Linh kiện"} × ${l.qty}` : (l.description ?? "Chi phí khác")}
                      subtitle={`${l.lineType === "part" ? `${l.partCode ?? ""} · tồn ${l.partStock ?? 0} · ${l.consumedAt ? "đã dùng" : "chưa xác nhận dùng"}` : l.description ?? ""}${l.cost !== undefined ? ` · giá vốn ${formatVnd(l.cost)}` : ""}`}
                      end={formatVnd(l.lineTotal)}
                      endSub={editable && can("repair.update") ? (
                        <span className="wf-dev-row" style={{ gap: 4, justifyContent: "flex-end" }}>
                          <Button sm onClick={() => setEditLine(l)}>Sửa</Button>
                          {l.lineType !== "part" ? null : l.consumedAt ? <Button sm onClick={() => void run(() => sapi(`/api/v1/repairs/${id}/lines/${l.id}/unconsume`, { body: {} }), "Đã bỏ dùng linh kiện", "Không bỏ dùng được")}>Bỏ dùng</Button> : <Button sm onClick={() => void run(() => sapi(`/api/v1/repairs/${id}/lines/${l.id}/consume`, { method: "POST", idempotencyKey: newIdempotencyKey() }), "Đã xác nhận dùng, trừ kho", "Không xác nhận dùng được")}>Xác nhận dùng</Button>}
                        </span>
                      ) : undefined}
                      chevron={false}
                    />
                  ))}
                </InsetList>
              )}
              <div className="g wf-pad" style={{ marginTop: 10 }}>
                <div className="wf-sum">
                  <div><span>Tổng dịch vụ + linh kiện</span><b>{formatVnd(total)}</b></div>
                  {paid > 0 && <div><span>Đã nhận (cọc/thu)</span><b>{formatVnd(paid)}</b></div>}
                  <div className="tot"><span>Còn phải thu</span><b>{formatVnd(payable)}</b></div>
                  {r.partsCost !== undefined && <div><span>Giá vốn linh kiện</span><b>{formatVnd(r.partsCost)}</b></div>}
                  {r.grossProfit !== undefined && <div><span>Lãi gộp</span><b>{formatVnd(r.grossProfit)}</b></div>}
                </div>
                {r.partsCost !== undefined && <LockNote />}
              </div>
            </section>

            <section className="g wf-pad" aria-label="Lịch sử trạng thái">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Tiến trình</h3>
              <Timeline items={[...r.history].reverse().map((h) => ({ title: `${h.from ? `${statusInfo("repair", h.from).label} → ` : ""}${statusInfo("repair", h.to).label}`, meta: `${formatDateTimeVn(h.at)} · ${h.actorName ?? "Hệ thống"}${h.reason ? ` · ${h.reason}` : ""}` }))} />
            </section>

            {r.payments.length > 0 && (
              <section aria-label="Thanh toán"><div className="wf-sec"><h3>Thanh toán</h3></div>
                <InsetList>{r.payments.map((p) => <InsetRow key={p.id} title={`${p.direction === "out" ? "Hoàn " : ""}${p.method === "cash" ? "Tiền mặt" : "Chuyển khoản"} · ${p.code}`} subtitle={formatDateTimeVn(p.createdAt)} end={`${p.direction === "out" ? "−" : ""}${formatVnd(p.amount)}`} endSub={p.status === "voided" ? <StatusChip tone="bad">Đã hủy</StatusChip> : undefined} />)}</InsetList>
              </section>
            )}

            <section className="g wf-pad" aria-label="Ảnh máy">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ảnh máy lúc nhận</h3>
              {r.photos.length > 0 && <PhotoGrid photos={r.photos} label="ảnh nhận máy" />}
              {editable && can("repair.update") && <ImageUpload kind="intake" entityTable="repair_orders" entityId={r.id} onUploaded={() => void d.mutate()} />}
            </section>
          </div>
        )}

        {r && <LineModal open={dlg === "line"} onClose={() => setDlg("")} repairId={r.id} onDone={async () => { await d.mutate(); setDlg(""); }} />}
        {r && <EditLineModal line={editLine} repairId={r.id} onClose={() => setEditLine(null)} onDone={async () => { await d.mutate(); setEditLine(null); }} />}
        {r && <CompleteModal open={dlg === "complete"} internal={r.kind === "internal"} busy={busy} onClose={() => setDlg("")} onSubmit={(b) => void run(() => sapi(`/api/v1/repairs/${id}/complete`, { body: b, idempotencyKey: newIdempotencyKey() }), "Đã hoàn thành", "Không hoàn thành được")} />}
        {r && <CancelModal open={dlg === "cancel"} held={r.held ?? 0} busy={busy} onClose={() => setDlg("")} onSubmit={(b) => void run(() => sapi(`/api/v1/repairs/${id}/cancel`, { body: b, idempotencyKey: newIdempotencyKey() }), "Đã hủy phiếu sửa", "Không hủy được")} />}
        {r && <ExtraPay open={dlg === "collect"} code={r.code} busy={busy} onClose={() => setDlg("")} onSubmit={(l) => void run(() => sapi(`/api/v1/repairs/${id}/payments`, { body: { lines: [l] }, idempotencyKey: newIdempotencyKey() }), "Đã nhận thêm tiền", "Không ghi nhận được")} />}
        {r && (
          <PaymentSheet
            open={dlg === "deliver" || dlg === "pay"}
            onClose={() => setDlg("")}
            payable={payable}
            allowDebt={dlg === "deliver" && !!r.customerPhone}
            submitting={busy}
            reference={r.code}
            fallbackRef="SUA CHUA"
            title={dlg === "deliver" ? "Giao máy & thu tiền" : "Thu nợ phiếu sửa"}
            extra={dlg === "deliver" && !!r.customerPhone ? <div style={{ marginTop: 12 }}><Field label="Hẹn trả nợ (nếu còn nợ)"><DateInput value={dueDate} onChange={(v) => setDueDate(v)} /></Field></div> : undefined}
            onSubmit={(lines: PaymentLineInput[]) =>
              void run(
                () => dlg === "deliver"
                  ? sapi(`/api/v1/repairs/${id}/deliver`, { body: { payments: lines.map((x) => ({ method: x.method, amount: x.amount })), dueDate: dueDate || null }, idempotencyKey: newIdempotencyKey() })
                  : sapi(`/api/v1/repairs/${id}/payments`, { body: { lines }, idempotencyKey: newIdempotencyKey() }),
                dlg === "deliver" ? "Đã giao máy" : "Đã thu nợ", "Không ghi nhận được",
              )
            }
          />
        )}
        {r && (
          <ConfirmDialog
            open={dlg === "deliver0"}
            title="Giao máy cho khách?"
            message="Phiếu không còn khoản phải thu. Sau khi giao, phiếu bị khóa và bắt đầu tính bảo hành sau sửa — không hoàn tác được."
            confirmLabel="Giao máy"
            loading={busy}
            onCancel={() => setDlg("")}
            onConfirm={() => void run(() => sapi(`/api/v1/repairs/${id}/deliver`, { body: { payments: [], dueDate: null }, idempotencyKey: newIdempotencyKey() }), "Đã giao máy", "Không giao được")}
          />
        )}
      </RequirePerm>
    </>
  );
}

function LineModal({ open, onClose, repairId, onDone }: { open: boolean; onClose: () => void; repairId: string; onDone: () => Promise<unknown> }) {
  const { can } = useSession();
  const toast = useToast();
  const [type, setType] = useState<"service" | "part" | "other">("service");
  const st = useSWR<{ items: ServiceType[] }>(open ? "/api/v1/service-types" : null, swrFetcher);
  const parts = useSWR<{ items: Part[] }>(open && can("part.view") ? "/api/v1/parts?pageSize=100" : null, swrFetcher);
  const [svc, setSvc] = useState("");
  const [part, setPart] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setType("service"); setSvc(""); setPart(""); setQty("1"); setPrice(null); setDesc(""); setErr(null); }
  }, [open]);
  const def = type === "service" ? st.data?.items.find((x) => x.id === svc)?.defaultPrice : type === "part" ? parts.data?.items.find((x) => x.id === part)?.salePrice : 0;
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await sapi(`/api/v1/repairs/${repairId}/lines`, { body: { lineType: type, serviceTypeId: type === "service" ? svc : null, partId: type === "part" ? part : null, description: desc.trim() || null, qty: type === "part" ? Number(qty) || 1 : 1, unitPrice: price ?? (type === "other" ? 0 : null) } });
      toast.success("Đã thêm dòng");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Thêm dòng" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={type === "service" ? !svc : type === "part" ? !part : !desc.trim()} onClick={() => void go()}>Thêm</Button></>}>
      <SegmentedControl ariaLabel="Loại dòng" value={type} onChange={(v) => { setType(v); setPrice(null); }} options={[{ value: "service", label: "Dịch vụ" }, { value: "part", label: "Linh kiện" }, { value: "other", label: "Chi phí khác" }]} />
      <div style={{ height: 12 }} />
      {type === "service" && <Field label="Loại việc" required><Select placeholder="Chọn loại việc" value={svc} onChange={(e) => setSvc(e.target.value)} options={(st.data?.items ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: `${x.name} (${formatVnd(x.defaultPrice)})` }))} /></Field>}
      {type === "part" && (
        <>
          <Field label="Linh kiện" required><Select placeholder="Chọn linh kiện" value={part} onChange={(e) => setPart(e.target.value)} options={(parts.data?.items ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: `${x.name} · tồn ${x.qtyOnHand}` }))} /></Field>
          <Field label="Số lượng"><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
        </>
      )}
      {type === "other" && <Field label="Nội dung" required><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>}
      {type !== "other" && <Field label="Ghi chú"><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>}
      <Field label={type === "other" ? "Số tiền" : "Đơn giá"} hint={type !== "other" && def !== undefined ? `Giá mặc định ${formatVnd(def)}${can("repair.price.edit") ? "" : " (bạn không có quyền sửa giá)"}` : undefined}>
        <MoneyInput value={price ?? (type !== "other" ? (def ?? null) : null)} onChange={setPrice} disabled={type !== "other" && !can("repair.price.edit")} />
      </Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function EditLineModal({ line, repairId, onClose, onDone }: { line: RepairLine | null; repairId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const { can } = useSession();
  const toast = useToast();
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (line) { setQty(String(line.qty)); setPrice(line.unitPrice); setDesc(line.description ?? ""); setErr(null); }
  }, [line]);
  const go = async (del = false) => {
    if (!line) return;
    setBusy(true);
    try {
      if (del) await sapi(`/api/v1/repairs/${repairId}/lines/${line.id}`, { method: "DELETE" });
      else await sapi(`/api/v1/repairs/${repairId}/lines/${line.id}`, { method: "PATCH", body: { qty: Number(qty) || 1, description: desc.trim() || undefined, ...(can("repair.price.edit") && price !== null ? { unitPrice: price } : {}) } });
      toast.success(del ? "Đã xóa dòng" : "Đã lưu dòng");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!line} onClose={onClose} busy={busy} title="Sửa dòng" footer={<><Button icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => void go(true)} disabled={busy}>Xóa dòng</Button><Button variant="primary" loading={busy} onClick={() => void go()}>Lưu</Button></>}>
      {line?.lineType === "part" && <Field label="Số lượng"><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>}
      <Field label="Ghi chú"><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label="Đơn giá" hint={can("repair.price.edit") ? undefined : "Bạn không có quyền sửa giá"}><MoneyInput value={price} onChange={setPrice} disabled={!can("repair.price.edit")} /></Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function CompleteModal({ open, internal, busy, onClose, onSubmit }: { open: boolean; internal: boolean; busy: boolean; onClose: () => void; onSubmit: (b: object) => void }) {
  const [us, setUs] = useState("in_stock");
  const [cond, setCond] = useState("refurbished");
  const [grade, setGrade] = useState("");
  const [findings, setFindings] = useState("");
  useEffect(() => { if (open) { setUs("in_stock"); setCond("refurbished"); setGrade(""); setFindings(""); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Hoàn thành sửa chữa" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} onClick={() => onSubmit({ unitStatus: us, ...(internal ? { condition: cond, grade: grade.trim() || null } : {}), findings: findings.trim() || null })}>Hoàn thành</Button></>}>
      <p className="wf-confirm-msg">Khóa các dòng và trừ nốt linh kiện đã dùng.{internal ? " Chi phí sửa được cộng vào giá vốn chiếc." : ""}</p>
      {internal && (
        <>
          <Field label="Chiếc về"><Select value={us} onChange={(e) => setUs(e.target.value)} options={[{ value: "in_stock", label: "Sẵn sàng bán" }, { value: "inspecting", label: "Chờ kiểm tra" }]} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Tình trạng"><Select value={cond} onChange={(e) => setCond(e.target.value)} options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))} /></Field>
            <Field label="Hạng / % mới"><TextInput value={grade} maxLength={5} onChange={(e) => setGrade(e.target.value.toUpperCase())} placeholder="A, B, C, 95%" /></Field>
          </div>
        </>
      )}
      <Field label="Kết quả / ghi chú"><Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} /></Field>
    </Modal>
  );
}

function CancelModal({ open, held, busy, onClose, onSubmit }: { open: boolean; held: number; busy: boolean; onClose: () => void; onSubmit: (b: object) => void }) {
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  useEffect(() => { if (open) { setReason(""); setMethod("cash"); } }, [open]);
  const missing = Math.max(0, 10 - reason.trim().length);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Hủy phiếu sửa" footer={<><Button onClick={onClose} disabled={busy}>Giữ phiếu</Button><Button variant="danger" loading={busy} disabled={missing > 0} onClick={() => onSubmit({ reason: reason.trim(), refundMethod: method })}>Hủy phiếu</Button></>}>
      <p className="wf-confirm-msg">Linh kiện đã dùng được hoàn kho{held > 0 ? `; cọc ${formatVnd(held)} hoàn lại cho khách` : ""}.</p>
      {held > 0 && <Field label="Hoàn cọc bằng"><SegmentedControl ariaLabel="Hình thức hoàn cọc" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} /></Field>}
      <Field label="Lý do hủy" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
    </Modal>
  );
}

function ExtraPay({ open, code, busy, onClose, onSubmit }: { open: boolean; code: string; busy: boolean; onClose: () => void; onSubmit: (l: { method: string; amount: number }) => void }) {
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(() => { if (open) { setMethod("cash"); setAmount(null); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Nhận thêm tiền" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!amount} onClick={() => amount && onSubmit({ method, amount })}>Ghi nhận</Button></>}>
      <SegmentedControl ariaLabel="Hình thức" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} />
      <div style={{ height: 12 }} />
      <Field label="Số tiền nhận" required><MoneyInput data-autofocus value={amount} onChange={setAmount} quickAdds={[200_000, 500_000, 1_000_000]} /></Field>
      {method === "bank_transfer" && !!amount && <TransferQr amount={amount} reference={code} fallbackRef="SUA CHUA" />}
    </Modal>
  );
}
