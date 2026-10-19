"use client";
import { Ban, Check, Plus, Printer, Trash2, Truck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ImageUpload } from "@/components/lucian/ImageUpload";
import { repairTotal, type RepairDetail, type RepairLine, type ServiceType } from "@/components/repairs/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, Timeline } from "@/components/ui/Display";
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
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

type Dlg = "" | "line" | "complete" | "deliver" | "cancel";
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
                <span className="wf-dev-row"><StatusChip kind="repair" status={r.status} />{r.chargeMode === "warranty_free" && <StatusChip tone="ok">Bảo hành miễn phí</StatusChip>}</span>
                <ProgressRing value={r.progress} tone={r.status === "cancelled" ? "bad" : "repair"} />
              </div>
              <KeyValue items={[
                { label: "Khách", value: `${r.customerName ?? "—"}${r.customerPhone ? ` · ${r.customerPhone}` : ""}` },
                { label: "Nhận lúc", value: `${formatDateTimeVn(r.receivedAt)} · ${r.receivedByName ?? ""}` },
                { label: "Lỗi / yêu cầu", value: r.complaint ?? "—" },
                { label: "Tình trạng lúc nhận", value: r.intakeCondition ?? "—" },
                { label: "Kết quả kiểm tra", value: r.findings ?? "—" },
                { label: "Hẹn trả", value: r.expectedDate ? formatDateVn(r.expectedDate) : "—" },
                ...(r.cancelReason ? [{ label: "Lý do hủy", value: r.cancelReason }] : []),
                ...(r.warranty ? [{ label: "Bảo hành sau sửa", value: `đến ${formatDateVn(r.warranty.endDate)}` }] : []),
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
                  {can("repair.update") && open && r.status !== "received" && <Button variant="primary" icon={<Check size={16} aria-hidden="true" />} onClick={() => setDlg("complete")}>Sửa xong</Button>}
                  {can("repair.deliver") && r.status === "completed" && <Button variant="primary" icon={<Truck size={16} aria-hidden="true" />} onClick={() => setDlg("deliver")}>Giao máy</Button>}
                  {can("repair.update") && open && <Button icon={<Ban size={16} aria-hidden="true" />} onClick={() => setDlg("cancel")}>Hủy phiếu</Button>}
                </div>
              </section>
            )}

            <section aria-label="Tiền sửa">
              <div className="wf-sec"><h3>Tiền sửa</h3>{editable && can("repair.update") && <button type="button" onClick={() => setDlg("line")}><Plus size={14} aria-hidden="true" /> Thêm khoản</button>}</div>
              {r.lines.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Chưa có khoản nào. Thêm công sửa hoặc chi phí để tính tiền cho khách.</p></div> : (
                <InsetList>
                  {r.lines.map((l) => (
                    <InsetRow
                      key={l.id}
                      title={l.lineType === "service" ? (l.serviceName ?? "Dịch vụ") : (l.description ?? "Khoản khác")}
                      subtitle={l.lineType === "service" ? l.description ?? undefined : undefined}
                      end={formatVnd(l.lineTotal)}
                      endSub={editable && can("repair.update") ? <Button sm onClick={() => setEditLine(l)}>Sửa</Button> : undefined}
                      chevron={false}
                    />
                  ))}
                </InsetList>
              )}
              <div className="g wf-pad" style={{ marginTop: 10 }}>
                <div className="wf-sum">
                  <div className="tot"><span>{r.chargeMode === "warranty_free" ? "Tiền sửa (miễn phí theo bảo hành)" : "Tổng tiền sửa"}</span><b>{r.chargeMode === "warranty_free" ? formatVnd(0) : formatVnd(total)}</b></div>
                </div>
              </div>
            </section>

            <section className="g wf-pad" aria-label="Lịch sử trạng thái">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Tiến trình</h3>
              <Timeline items={[...r.history].reverse().map((h) => ({ title: `${h.from ? `${statusInfo("repair", h.from).label} → ` : ""}${statusInfo("repair", h.to).label}`, meta: `${formatDateTimeVn(h.at)} · ${h.actorName ?? "Hệ thống"}${h.reason ? ` · ${h.reason}` : ""}` }))} />
            </section>

            <section className="g wf-pad" aria-label="Ảnh máy">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ảnh máy lúc nhận</h3>
              {r.photos.length > 0 && <PhotoGrid photos={r.photos} label="ảnh nhận máy" />}
              {editable && can("repair.update") && <ImageUpload kind="intake" entityTable="repair_orders" entityId={r.id} onUploaded={() => void d.mutate()} />}
            </section>
          </div>
        )}

        {r && <LineModal open={dlg === "line"} onClose={() => setDlg("")} repairId={r.id} onDone={async () => { await d.mutate(); setDlg(""); }} />}
        {r && <EditLineModal line={editLine} repairId={r.id} onClose={() => setEditLine(null)} onDone={async () => { await d.mutate(); setEditLine(null); }} />}
        {r && <CompleteModal open={dlg === "complete"} busy={busy} onClose={() => setDlg("")} onSubmit={(b) => void run(() => sapi(`/api/v1/repairs/${id}/complete`, { body: b, idempotencyKey: newIdempotencyKey() }), "Đã ghi nhận sửa xong", "Không ghi nhận được")} />}
        {r && <CancelModal open={dlg === "cancel"} busy={busy} onClose={() => setDlg("")} onSubmit={(b) => void run(() => sapi(`/api/v1/repairs/${id}/cancel`, { body: b, idempotencyKey: newIdempotencyKey() }), "Đã hủy phiếu sửa", "Không hủy được")} />}
        {r && (
          <ConfirmDialog
            open={dlg === "deliver"}
            title="Giao máy cho khách?"
            message={`Giao máy và ghi nhận tiền sửa ${r.chargeMode === "warranty_free" ? "(miễn phí theo bảo hành)" : formatVnd(total)} vào doanh thu. Sau khi giao, phiếu bị khóa và bắt đầu tính bảo hành sau sửa — không hoàn tác được.`}
            confirmLabel="Giao máy"
            loading={busy}
            onCancel={() => setDlg("")}
            onConfirm={() => void run(() => sapi(`/api/v1/repairs/${id}/deliver`, { body: {}, idempotencyKey: newIdempotencyKey() }), "Đã giao máy", "Không giao được")}
          />
        )}
      </RequirePerm>
    </>
  );
}

function LineModal({ open, onClose, repairId, onDone }: { open: boolean; onClose: () => void; repairId: string; onDone: () => Promise<unknown> }) {
  const { can } = useSession();
  const toast = useToast();
  const [type, setType] = useState<"service" | "other">("service");
  const st = useSWR<{ items: ServiceType[] }>(open ? "/api/v1/service-types" : null, swrFetcher);
  const [svc, setSvc] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setType("service"); setSvc(""); setPrice(null); setDesc(""); setErr(null); }
  }, [open]);
  const def = type === "service" ? st.data?.items.find((x) => x.id === svc)?.defaultPrice : 0;
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await sapi(`/api/v1/repairs/${repairId}/lines`, { body: { lineType: type, serviceTypeId: type === "service" ? svc : null, description: desc.trim() || null, unitPrice: price ?? (type === "other" ? 0 : null) } });
      toast.success("Đã thêm khoản");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Thêm khoản tiền sửa" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={type === "service" ? !svc : !desc.trim()} onClick={() => void go()}>Thêm</Button></>}>
      <SegmentedControl ariaLabel="Loại khoản" value={type} onChange={(v) => { setType(v); setPrice(null); }} options={[{ value: "service", label: "Công sửa (theo loại việc)" }, { value: "other", label: "Khoản khác" }]} />
      <div style={{ height: 12 }} />
      {type === "service" && <Field label="Loại việc" required><Select placeholder="Chọn loại việc" value={svc} onChange={(e) => setSvc(e.target.value)} options={(st.data?.items ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: `${x.name} (${formatVnd(x.defaultPrice)})` }))} /></Field>}
      <Field label={type === "other" ? "Nội dung" : "Ghi chú"} required={type === "other"}><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={type === "other" ? "Ví dụ: dây da mới, công gia công ngoài…" : ""} /></Field>
      <Field label={type === "other" ? "Số tiền" : "Đơn giá"} hint={type === "service" && def !== undefined ? `Giá mặc định ${formatVnd(def)}${can("repair.price.edit") ? "" : " (bạn không có quyền sửa giá)"}` : undefined}>
        <MoneyInput value={price ?? (type === "service" ? (def ?? null) : null)} onChange={setPrice} disabled={type === "service" && !can("repair.price.edit")} />
      </Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function EditLineModal({ line, repairId, onClose, onDone }: { line: RepairLine | null; repairId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const { can } = useSession();
  const toast = useToast();
  const [price, setPrice] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (line) { setPrice(line.unitPrice); setDesc(line.description ?? ""); setErr(null); }
  }, [line]);
  const go = async (del = false) => {
    if (!line) return;
    setBusy(true);
    try {
      if (del) await sapi(`/api/v1/repairs/${repairId}/lines/${line.id}`, { method: "DELETE" });
      else await sapi(`/api/v1/repairs/${repairId}/lines/${line.id}`, { method: "PATCH", body: { description: desc.trim() || undefined, ...(can("repair.price.edit") && price !== null ? { unitPrice: price } : {}) } });
      toast.success(del ? "Đã xóa khoản" : "Đã lưu khoản");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!line} onClose={onClose} busy={busy} title="Sửa khoản" footer={<><Button icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => void go(true)} disabled={busy}>Xóa khoản</Button><Button variant="primary" loading={busy} onClick={() => void go()}>Lưu</Button></>}>
      <Field label="Nội dung"><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      <Field label="Số tiền" hint={can("repair.price.edit") ? undefined : "Bạn không có quyền sửa giá"}><MoneyInput value={price} onChange={setPrice} disabled={!can("repair.price.edit")} /></Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function CompleteModal({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (b: object) => void }) {
  const [findings, setFindings] = useState("");
  useEffect(() => { if (open) setFindings(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Sửa xong" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} onClick={() => onSubmit({ findings: findings.trim() || null })}>Sửa xong</Button></>}>
      <p className="wf-confirm-msg">Khóa các khoản tiền sửa và chuyển phiếu sang “Sửa xong” (chờ khách đến lấy máy). Doanh thu chỉ ghi nhận khi giao máy.</p>
      <Field label="Kết quả / ghi chú (tùy chọn)"><Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} /></Field>
    </Modal>
  );
}

function CancelModal({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (b: object) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  const missing = Math.max(0, 10 - reason.trim().length);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Hủy phiếu sửa" footer={<><Button onClick={onClose} disabled={busy}>Giữ phiếu</Button><Button variant="danger" loading={busy} disabled={missing > 0} onClick={() => onSubmit({ reason: reason.trim() })}>Hủy phiếu</Button></>}>
      <Field label="Lý do hủy" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
    </Modal>
  );
}
