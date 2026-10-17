"use client";
import { Pencil, Truck, Undo2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { useLocations } from "@/components/catalog/useLists";
import { joinTitle } from "@/components/catalog/types";
import { n, type CollabDetail } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { Checkbox, Switch } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TransferQr } from "@/components/payments/TransferQr";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

type Tab = "held" | "orders" | "settle" | "assign" | "profile";

export default function CollaboratorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const d = useSWR<CollabDetail>(can("collab.view") ? `/api/v1/collaborators/${id}` : null, swrFetcher);
  const c = d.data;
  const manage = can("collab.manage");
  const [tab, setTab] = useState<Tab>("held");
  const [ret, setRet] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidFor, setVoidFor] = useState<{ kind: "settlement" | "assignment"; id: string; code: string } | null>(null);
  const [profile, setProfile] = useState(false);
  const [askSettle, setAskSettle] = useState(false);
  const setKey = useRef(newIdempotencyKey());

  const selTotal = useMemo(() => (c?.unsettled ?? []).filter((u) => sel.includes(u.id)).reduce((a, u) => a + n(u.basePrice), 0), [c, sel]);

  const settle = async () => {
    setBusy(true);
    try {
      const r = await sapi<{ code?: string }>(`/api/v1/collaborators/${id}/settlements`, { body: { lineIds: sel, method, note: note.trim() || undefined }, idempotencyKey: setKey.current });
      toast.success(`Đã quyết toán ${r.code ?? ""}`, `Thu ${formatVnd(selTotal)}`);
      setKey.current = newIdempotencyKey();
      setSel([]);
      setNote("");
      await d.mutate();
    } catch (e) {
      setKey.current = newIdempotencyKey();
      toast.error("Không quyết toán được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const doVoid = async (reason?: string) => {
    if (!voidFor) return;
    setBusy(true);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/${voidFor.kind === "settlement" ? "settlements" : "assignments"}/${voidFor.id}/void`, { body: { reason }, idempotencyKey: key }));
      toast.success(voidFor.kind === "settlement" ? "Đã hủy quyết toán" : "Đã hủy phiếu giao");
      setVoidFor(null);
      await d.mutate();
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không hủy được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={c?.fullName ?? "Cộng tác viên"} description={c ? [c.phone, c.area].filter(Boolean).join(" · ") || undefined : undefined} actions={manage && c ? <Button sm variant="primary" href={`/cong-tac-vien/giao-hang/moi?ctv=${c.id}`} icon={<Truck size={16} aria-hidden="true" />}>Giao hàng</Button> : undefined} />
      <RequirePerm perm="collab.view">
        {d.isLoading ? <SkeletonGroup className="wf-stack"><Skeleton h={44} radius={22} /><Skeleton h={200} radius={26} /></SkeletonGroup> : d.error || !c ? (
          <div className="g wf-pad"><ErrorState title="Không mở được cộng tác viên" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <SegmentedControl mode="tabs" ariaLabel="Mục cộng tác viên" value={tab} onChange={setTab} options={[{ value: "held", label: `Đang giữ (${c.units.length})` }, { value: "orders", label: "Đơn" }, { value: "settle", label: "Quyết toán" }, { value: "assign", label: "Phiếu giao" }, { value: "profile", label: "Hồ sơ" }]} />

            {tab === "held" && (c.units.length === 0 ? <div className="g wf-pad"><EmptyState icon={<Truck size={24} />} title="CTV chưa giữ chiếc nào" description="Giao hàng để CTV có chiếc đi bán." action={manage ? { label: "Giao hàng", href: `/cong-tac-vien/giao-hang/moi?ctv=${c.id}` } : undefined} /></div> : (
              <InsetList label="Hàng đang giữ">
                {c.units.map((u) => (
                  <InsetRow key={u.id} title={joinTitle(u.brandName, u.modelName)} subtitle={`${u.assetCode} · giữ ${u.daysHeld} ngày · giao ${formatDateVn(u.assignedDate)}`} end={formatVnd(u.basePrice)} endSub={manage ? <Button sm icon={<Undo2 size={14} aria-hidden="true" />} onClick={() => setRet(u.id)}>Thu hồi</Button> : "giá thu"} />
                ))}
              </InsetList>
            ))}

            {tab === "orders" && (c.orders.length === 0 ? <div className="g wf-pad"><EmptyState title="Chưa có đơn nào" /></div> : (
              <InsetList label="Đơn của CTV">
                {c.orders.map((o) => <InsetRow key={o.id} href={`/ban-hang/${o.id}`} title={o.code ?? "Đơn chờ xác nhận"} subtitle={`${o.customerName ?? "Khách"} · ${formatDateVn(o.docDate)}`} end={formatVnd(o.grandTotal)} endSub={<StatusChip kind="doc" status={o.status} label={o.status === "draft" ? "Chờ xác nhận" : undefined} />} />)}
              </InsetList>
            ))}

            {tab === "settle" && (
              <>
                <section className="g wf-pad" aria-label="Dòng chưa nộp">
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Đã bán, chưa nộp ({c.unsettled.length})</h3>
                  {c.unsettled.length === 0 ? <p className="wf-mute">CTV không còn dòng nào chưa nộp.</p> : (
                    <>
                      <Checkbox checked={sel.length === c.unsettled.length} onChange={(v) => setSel(v ? c.unsettled.map((u) => u.id) : [])} label="Chọn tất cả" />
                      {c.unsettled.map((u) => (
                        <Checkbox key={u.id} checked={sel.includes(u.id)} onChange={(v) => setSel((s) => (v ? [...s, u.id] : s.filter((x) => x !== u.id)))} label={<span>{u.modelName} · {u.assetCode}<small className="wf-mute" style={{ display: "block", fontSize: 12 }}>{u.saleCode} · bán {formatVnd(u.salePrice)} · phải nộp {formatVnd(n(u.basePrice))} · CTV hưởng {formatVnd(n(u.collabEarn))}</small></span>} />
                      ))}
                      <div className="wf-sum" style={{ marginTop: 8 }}><div className="tot"><span>CTV phải nộp ({sel.length} dòng)</span><b>{formatVnd(selTotal)}</b></div></div>
                      {manage && (
                        <>
                          <SegmentedControl ariaLabel="Hình thức nộp" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} />
                          {method === "bank_transfer" && selTotal > 0 && <TransferQr amount={selTotal} fallbackRef={`QT ${c.fullName}`} />}
                          <div style={{ height: 10 }} />
                          <Field label="Ghi chú"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
                          <Button variant="primary" block loading={busy} disabled={sel.length === 0} onClick={() => setAskSettle(true)}>Quyết toán {formatVnd(selTotal)}</Button>
                        </>
                      )}
                    </>
                  )}
                </section>
                <section aria-label="Lịch sử quyết toán"><div className="wf-sec"><h3>Lịch sử quyết toán</h3></div>
                  {c.settlements.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Chưa quyết toán lần nào.</p></div> : (
                    <InsetList>
                      {c.settlements.map((s) => <InsetRow key={s.id} title={s.code} subtitle={`${formatDateVn(s.docDate)} · ${s.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}${s.voidReason ? ` · ${s.voidReason}` : ""}`} end={formatVnd(s.total)} endSub={s.status === "voided" ? <StatusChip tone="bad">Đã hủy</StatusChip> : manage ? <Button sm onClick={() => setVoidFor({ kind: "settlement", id: s.id, code: s.code })}>Hủy</Button> : <StatusChip tone="ok">Đã nộp</StatusChip>} />)}
                    </InsetList>
                  )}
                </section>
              </>
            )}

            {tab === "assign" && (c.assignments.length === 0 ? <div className="g wf-pad"><EmptyState title="Chưa có phiếu giao" /></div> : (
              <InsetList label="Phiếu giao hàng">
                {c.assignments.map((a) => <InsetRow key={a.id} title={a.code} subtitle={`${formatDateVn(a.docDate)} · ${a.lineCount} chiếc`} end={a.status === "voided" ? <StatusChip tone="bad">Đã hủy</StatusChip> : <StatusChip tone="ok">Đã giao</StatusChip>} endSub={manage && a.status !== "voided" ? <Button sm onClick={() => setVoidFor({ kind: "assignment", id: a.id, code: a.code })}>Hủy phiếu</Button> : undefined} />)}
              </InsetList>
            ))}

            {tab === "profile" && (
              <section className="g wf-pad" aria-label="Hồ sơ">
                <KeyValue items={[{ label: "Họ tên", value: c.fullName }, { label: "Điện thoại", value: c.phone ?? "—" }, { label: "Khu vực", value: c.area ?? "—" }, { label: "Ghi chú", value: c.note ?? "—" }, { label: "Trạng thái", value: c.isActive ? "Đang hoạt động" : "Đã tắt" }]} />
                {manage && <Button block style={{ marginTop: 10 }} icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setProfile(true)}>Sửa hồ sơ</Button>}
              </section>
            )}
          </div>
        )}
        <ReturnModal unitId={ret} collab={id} onClose={() => setRet(null)} onDone={async () => { setRet(null); await d.mutate(); }} />
        <ProfileModal open={profile} c={c ?? null} onClose={() => setProfile(false)} onDone={async () => { setProfile(false); await d.mutate(); }} />
        <ConfirmDialog
          open={askSettle}
          title="Quyết toán cho CTV?"
          message={`Ghi nhận CTV nộp ${formatVnd(selTotal)} cho ${sel.length} chiếc đã bán (${method === "cash" ? "tiền mặt" : "chuyển khoản"}). Muốn sửa sau phải hủy quyết toán và nhập lại.`}
          confirmLabel={`Quyết toán ${formatVnd(selTotal)}`}
          loading={busy}
          onCancel={() => setAskSettle(false)}
          onConfirm={async () => { await settle(); setAskSettle(false); }}
        />
        <ConfirmDialog
          open={!!voidFor}
          danger
          requireReason
          loading={busy}
          title={voidFor?.kind === "settlement" ? `Hủy quyết toán ${voidFor.code}?` : `Hủy phiếu giao ${voidFor?.code ?? ""}?`}
          message={voidFor?.kind === "settlement" ? "Các dòng quay lại trạng thái chưa nộp và khoản thu bị hủy. Cần xác nhận lại mật khẩu." : "Các chiếc trong phiếu về lại kho (chỉ được khi CTV chưa bán). Cần xác nhận lại mật khẩu."}
          confirmLabel="Hủy"
          onCancel={() => setVoidFor(null)}
          onConfirm={(r) => void doVoid(r)}
        />
      </RequirePerm>
    </>
  );
}

function ReturnModal({ unitId, collab, onClose, onDone }: { unitId: string | null; collab: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const locs = useLocations(!!unitId);
  const [loc, setLoc] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (unitId) { setLoc(""); setReason(""); setErr(null); }
  }, [unitId]);
  const missing = Math.max(0, 10 - reason.trim().length);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await sapi(`/api/v1/collaborators/${collab}/return`, { body: { unitId, locationId: loc, reason: reason.trim() }, idempotencyKey: newIdempotencyKey() });
      toast.success("Đã thu hồi chiếc về kho");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!unitId} onClose={onClose} busy={busy} title="Thu hồi chiếc về kho" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!loc || missing > 0} onClick={() => void go()}>Thu hồi</Button></>}>
      <Field label="Đặt vào vị trí" required><Select placeholder="Chọn vị trí" value={loc} onChange={(e) => setLoc(e.target.value)} options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} /></Field>
      <Field label="Lý do" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function ProfileModal({ open, c, onClose, onDone }: { open: boolean; c: CollabDetail | null; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [f, setF] = useState({ phone: "", area: "", note: "" });
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open && c) { setF({ phone: c.phone ?? "", area: c.area ?? "", note: c.note ?? "" }); setActive(c.isActive); setErr(null); }
  }, [open, c]);
  const go = async () => {
    if (!c) return;
    setBusy(true);
    try {
      await sapi(`/api/v1/collaborators/${c.id}`, { method: "PATCH", body: { phone: f.phone.trim() || null, area: f.area.trim() || null, note: f.note.trim() || null, isActive: active } });
      toast.success("Đã lưu hồ sơ CTV");
      await onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Sửa hồ sơ CTV" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} onClick={() => void go()}>Lưu</Button></>}>
      <Field label="Điện thoại"><TextInput data-autofocus value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
      <Field label="Khu vực"><TextInput value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
      <Field label="Ghi chú"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <Switch checked={active} onChange={setActive} label="Đang hoạt động" />
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}
