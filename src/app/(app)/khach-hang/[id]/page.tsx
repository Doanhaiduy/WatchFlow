"use client";
import { Eye, EyeOff, Pencil, Plus, ShieldOff } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import type { Customer } from "@/components/catalog/types";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { CustomerHistory } from "@/components/customers/CustomerHistory";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { Watch } from "lucide-react";

const REVEAL_MS = 30_000;

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const cus = useSWR<Customer>(can(["customer.view", "customer.view_own"]) ? `/api/v1/customers/${id}` : null, swrFetcher);
  const c = cus.data;
  const [edit, setEdit] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [anon, setAnon] = useState(false);
  const [anonBusy, setAnonBusy] = useState(false);

  // Xem CCCD đầy đủ: hỏi lý do → reveal-id (cần xác nhận lại) → hiện 30 giây rồi tự ẩn
  const [revealOpen, setRevealOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revBusy, setRevBusy] = useState(false);
  const [shown, setShown] = useState<{ value: string; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  useEffect(() => {
    // Rời trang/đổi khách thì ẩn ngay
    setShown(null);
  }, [id]);
  const startTimer = (value: string) => {
    if (timer.current) clearInterval(timer.current);
    setShown({ value, left: REVEAL_MS / 1000 });
    timer.current = setInterval(() => {
      setShown((s) => {
        if (!s || s.left <= 1) {
          if (timer.current) clearInterval(timer.current);
          return null;
        }
        return { ...s, left: s.left - 1 };
      });
    }, 1000);
  };
  const reveal = async () => {
    setRevBusy(true);
    try {
      const r = await withReauth(() => sapi<{ idNumber: string | null }>(`/api/v1/customers/${id}/reveal-id`, { body: { reason: reason.trim() } }));
      setRevealOpen(false);
      setReason("");
      if (r.idNumber) startTimer(r.idNumber);
      else toast.info("Khách chưa có số giấy tờ");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không xem được số giấy tờ", errMsg(e));
    } finally {
      setRevBusy(false);
    }
  };

  const doAnon = async (why?: string) => {
    setAnonBusy(true);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/customers/${id}/anonymize`, { body: { reason: why }, idempotencyKey: key }));
      setAnon(false);
      setShown(null);
      await cus.mutate();
      toast.success("Đã ẩn danh khách hàng");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không ẩn danh được", errMsg(e));
    } finally {
      setAnonBusy(false);
    }
  };

  const isAnon = !!c?.anonymizedAt;
  return (
    <>
      <PageHeader title={c?.fullName ?? "Khách hàng"} context={c?.code} description={c?.groupName ?? undefined} actions={c && !isAnon && can(["customer.manage", "customer.create"]) ? <Button sm icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEdit(true)}>Sửa</Button> : undefined} />
      <RequirePerm perm={["customer.view", "customer.view_own"]}>
        {cus.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={220} radius={26} /><Skeleton h={120} radius={26} /></SkeletonGroup>
        ) : cus.error || !c ? (
          <div className="g wf-pad"><ErrorState title="Không mở được khách hàng" description={errMsg(cus.error)} onRetry={async () => (await cus.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin khách">
              {isAnon && <div style={{ marginBottom: 8 }}><StatusChip tone="neutral">Đã ẩn danh {formatDateTimeVn(c.anonymizedAt)}</StatusChip></div>}
              <KeyValue
                items={[
                  { label: "Họ tên", value: c.fullName },
                  { label: "Số điện thoại", value: c.phone ? <a href={`tel:${c.phone}`} style={{ color: "var(--wf-accent)" }}>{c.phone}</a> : "—" },
                  { label: "Email", value: c.email ?? "—" },
                  { label: "Địa chỉ", value: c.address ?? "—" },
                  { label: "Nhóm", value: c.groupName ?? "—" },
                  { label: "Ghi chú", value: c.note ?? "—" },
                  { label: "Tạo bởi", value: `${c.createdByName ?? "—"} · ${formatDateTimeVn(c.createdAt)}` },
                  {
                    label: "CCCD/giấy tờ",
                    value: !c.hasIdNumber ? "Chưa có" : shown ? (
                      <span className="wf-dev-row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <span className="wf-mono" style={{ margin: 0 }}>{shown.value}</span>
                        <Button sm iconOnly aria-label={`Ẩn số giấy tờ (tự ẩn sau ${shown.left} giây)`} onClick={() => setShown(null)}><EyeOff size={16} aria-hidden="true" /></Button>
                      </span>
                    ) : (
                      <span className="wf-dev-row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <span className="wf-mono" style={{ margin: 0 }}>{c.idMasked}</span>
                        {can("customer.pii.view") && !isAnon && <Button sm icon={<Eye size={16} aria-hidden="true" />} onClick={() => setRevealOpen(true)}>Xem đầy đủ</Button>}
                      </span>
                    ),
                  },
                ]}
              />
              {shown && <p className="wf-mute" role="status" style={{ marginTop: 6 }}>Số giấy tờ sẽ tự ẩn sau {shown.left} giây. Việc xem đã được ghi nhật ký.</p>}
            </section>

            <section aria-label="Đồng hồ của khách">
              <div className="wf-sec">
                <h3>Đồng hồ của khách</h3>
                {!isAnon && can(["customer.create", "customer.manage"]) && <button type="button" onClick={() => setWatchOpen(true)}><Plus size={14} aria-hidden="true" /> Thêm</button>}
              </div>
              {c.watches && c.watches.length > 0 ? (
                <InsetList label="Đồng hồ của khách">
                  {c.watches.map((w) => (
                    <InsetRow key={w.id} icon={<Watch size={20} aria-hidden="true" />} tone="check" title={`${w.brandText ?? ""} ${w.modelText ?? ""}`.trim() || "Đồng hồ"} subtitle={`${w.serialNo ? `SN ${w.serialNo}` : "Không có serial"}${w.note ? ` · ${w.note}` : ""}`} />
                  ))}
                </InsetList>
              ) : (
                <div className="g wf-pad"><EmptyState title="Chưa ghi nhận đồng hồ nào" description="Ghi lại đồng hồ khách đang dùng để tra cứu nhanh khi nhận sửa." icon={<Watch size={24} />} /></div>
              )}
            </section>

            <CustomerHistory customerId={c.id} />

            {can("customer.manage") && !isAnon && (
              <Button icon={<ShieldOff size={16} aria-hidden="true" />} onClick={() => setAnon(true)}>Ẩn danh khách (xóa dữ liệu cá nhân)</Button>
            )}
          </div>
        )}

        <CustomerModal customer={c ?? null} open={edit} onClose={() => setEdit(false)} onDone={async () => { await cus.mutate(); setEdit(false); }} />
        <WatchModal open={watchOpen} customerId={id} onClose={() => setWatchOpen(false)} onDone={async () => { await cus.mutate(); setWatchOpen(false); }} />
        <Modal open={revealOpen} onClose={() => setRevealOpen(false)} busy={revBusy} title="Xem số giấy tờ đầy đủ" footer={<><Button onClick={() => setRevealOpen(false)} disabled={revBusy}>Hủy</Button><Button variant="primary" loading={revBusy} disabled={reason.trim().length < 5} onClick={() => void reveal()}>Xem</Button></>}>
          <p className="wf-confirm-msg">Việc xem được ghi vào nhật ký kèm lý do. Cần xác nhận lại mật khẩu.</p>
          <Field label="Lý do xem" required hint="Tối thiểu 5 ký tự, ví dụ: đối chiếu khi nhận thu mua"><Textarea data-autofocus rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
        </Modal>
        <ConfirmDialog
          open={anon}
          danger
          requireReason
          loading={anonBusy}
          title={`Ẩn danh ${c?.fullName ?? "khách"}?`}
          message="Tên, SĐT, email, địa chỉ và số giấy tờ bị xóa không khôi phục được; phiếu cũ vẫn giữ để đối chiếu nhưng không còn hiện danh tính. Cần xác nhận lại mật khẩu."
          confirmLabel="Ẩn danh"
          onCancel={() => setAnon(false)}
          onConfirm={(r) => void doAnon(r)}
        />
      </RequirePerm>
    </>
  );
}

function WatchModal({ open, customerId, onClose, onDone }: { open: boolean; customerId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [f, setF] = useState({ brandText: "", modelText: "", serialNo: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setF({ brandText: "", modelText: "", serialNo: "", note: "" }); setErr(null); }
  }, [open]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await sapi(`/api/v1/customers/${customerId}/watches`, { body: { brandText: f.brandText.trim() || null, modelText: f.modelText.trim() || null, serialNo: f.serialNo.trim() || null, note: f.note.trim() || null } });
      toast.success("Đã thêm đồng hồ của khách");
      await onDone();
    } catch (x) {
      const er = fieldErrors(x);
      setErr(Object.values(er)[0] ?? errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Thêm đồng hồ của khách">
      <form onSubmit={submit} noValidate>
        <Field label="Thương hiệu"><TextInput data-autofocus value={f.brandText} onChange={set("brandText")} /></Field>
        <Field label="Loại / tên"><TextInput value={f.modelText} onChange={set("modelText")} /></Field>
        <Field label="Serial"><TextInput value={f.serialNo} onChange={set("serialNo")} /></Field>
        <Field label="Ghi chú"><TextInput value={f.note} onChange={set("note")} /></Field>
        {err && <p className="wf-fld-err" role="alert">{err}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!f.brandText.trim() && !f.modelText.trim() && !f.serialNo.trim()}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}
