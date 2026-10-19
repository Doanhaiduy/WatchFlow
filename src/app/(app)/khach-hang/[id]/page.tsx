"use client";
import { Pencil, Phone, Plus, Watch } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Customer } from "@/components/catalog/types";
import { CustomerHistory } from "@/components/customers/CustomerHistory";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const cus = useSWR<Customer>(can(["customer.view", "customer.view_own"]) ? `/api/v1/customers/${id}` : null, swrFetcher);
  const c = cus.data;
  const [edit, setEdit] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const isAnon = !!c?.anonymizedAt;
  return (
    <>
      <PageHeader title={c?.fullName ?? "Khách hàng"} context={c?.code} actions={c && !isAnon && can(["customer.manage", "customer.create"]) ? <Button sm icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEdit(true)}>Sửa</Button> : undefined} />
      <RequirePerm perm={["customer.view", "customer.view_own"]}>
        {cus.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={180} radius={26} /><Skeleton h={120} radius={26} /></SkeletonGroup>
        ) : cus.error || !c ? (
          <div className="g wf-pad"><ErrorState title="Không mở được khách hàng" description={errMsg(cus.error)} onRetry={async () => (await cus.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Thông tin khách">
              {isAnon && <div style={{ marginBottom: 8 }}><StatusChip tone="neutral">Đã ẩn danh {formatDateTimeVn(c.anonymizedAt)}</StatusChip></div>}
              <div className="wf-prof">
                <Avatar name={c.fullName} tone={isAnon ? "neutral" : undefined} className="lg" />
                <div className="tx">
                  <b>{c.fullName}</b>
                  <span>{c.code}</span>
                </div>
                {c.phone && !isAnon && (
                  <a className="wf-btn wf-btn-sm wf-touch" href={`tel:${c.phone}`}>
                    <Phone size={16} aria-hidden="true" />
                    Gọi
                  </a>
                )}
              </div>
              <KeyValue
                items={[
                  { label: "Số điện thoại", value: c.phone ? <a href={`tel:${c.phone}`} style={{ color: "var(--wf-accent)" }}>{c.phone}</a> : "—" },
                  { label: "Địa chỉ", value: c.address ?? "—" },
                  { label: "Ghi chú", value: c.note ?? "—" },
                  { label: "Lưu bởi", value: `${c.createdByName ?? "—"} · ${formatDateTimeVn(c.createdAt)}` },
                ]}
              />
            </section>

            <section aria-label="Đồng hồ của khách">
              <div className="wf-sec">
                <h3>Đồng hồ của khách</h3>
                {!isAnon && can(["customer.create", "customer.manage"]) && <button type="button" onClick={() => setWatchOpen(true)}><Plus size={14} aria-hidden="true" /> Thêm</button>}
              </div>
              {c.watches && c.watches.length > 0 ? (
                <InsetList label="Đồng hồ của khách">
                  {c.watches.map((w) => (
                    <InsetRow key={w.id} thumb={<WatchArt crop="head" seed={artSeed(w.brandText, w.modelText)} brand={w.brandText} model={w.modelText} />} title={`${w.brandText ?? ""} ${w.modelText ?? ""}`.trim() || "Đồng hồ"} subtitle={`${w.serialNo ? `SN ${w.serialNo}` : "Không có serial"}${w.note ? ` · ${w.note}` : ""}`} />
                  ))}
                </InsetList>
              ) : (
                <div className="g wf-pad"><EmptyState title="Chưa ghi nhận đồng hồ nào" description="Đồng hồ khách mang đến sửa sẽ được lưu ở đây; bạn cũng có thể thêm trước." icon={<Watch size={24} />} /></div>
              )}
            </section>

            <CustomerHistory customerId={c.id} />
          </div>
        )}

        <CustomerModal customer={c ?? null} open={edit} onClose={() => setEdit(false)} onDone={async () => { await cus.mutate(); setEdit(false); }} />
        <WatchModal open={watchOpen} customerId={id} onClose={() => setWatchOpen(false)} onDone={async () => { await cus.mutate(); setWatchOpen(false); }} />
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
