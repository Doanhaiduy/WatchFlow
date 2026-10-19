"use client";
import { Pencil, Truck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import { CollabTabs } from "@/components/collab/CollabTabs";
import type { CollabDetail } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhoneInput, normalizePhone } from "@/components/ui/PhoneInput";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

export default function CollaboratorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const toast = useToast();
  const d = useSWR<CollabDetail>(can("collab.view") ? `/api/v1/collaborators/${id}` : null, swrFetcher);
  const c = d.data;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ phone: "", area: "", note: "", isActive: true });
  const [busy, setBusy] = useState(false);

  const openEdit = () => { if (!c) return; setF({ phone: normalizePhone(c.phone ?? ""), area: c.area ?? "", note: c.note ?? "", isActive: c.isActive }); setEdit(true); };
  const save = async () => {
    setBusy(true);
    try {
      await sapi(`/api/v1/collaborators/${id}`, { method: "PATCH", body: { phone: f.phone || null, area: f.area.trim() || null, note: f.note.trim() || null, isActive: f.isActive } });
      toast.success("Đã lưu hồ sơ cộng tác viên");
      setEdit(false);
      await d.mutate();
    } catch (e) {
      toast.error("Không lưu được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const revenue = (c?.orders ?? []).filter((o) => o.status === "confirmed").reduce((a, o) => a + o.grandTotal, 0);

  return (
    <>
      <PageHeader title={c?.fullName ?? "Cộng tác viên"} description="Hàng được giao, báo bán và đơn đã bán" actions={can("collab.manage") && c ? <Button sm variant="primary" href={`/cong-tac-vien/giao-hang?ctv=${c.id}`} icon={<Truck size={16} aria-hidden="true" />}>Giao thêm</Button> : undefined} />
      <RequirePerm perm="collab.view">
        <CollabTabs />
        {d.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={140} radius={26} /><Skeleton h={160} radius={26} /></SkeletonGroup>
        ) : d.error || !c ? (
          <div className="g wf-pad"><ErrorState title="Không mở được cộng tác viên" description={errMsg(d.error)} onRetry={async () => (await d.mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Hồ sơ">
              <div className="wf-dev-row" style={{ marginBottom: 8 }}>{c.isActive ? <StatusChip tone="ok">Đang hoạt động</StatusChip> : <StatusChip tone="neutral">Đã tắt</StatusChip>}</div>
              <KeyValue items={[{ label: "Điện thoại", value: c.phone ?? "—" }, { label: "Khu vực", value: c.area ?? "—" }, ...(c.note ? [{ label: "Ghi chú", value: c.note }] : []), { label: "Đang được giao", value: `${c.units.length} chiếc` }, ...(can("report.sales") ? [{ label: "Doanh thu CTV mang về (100 đơn gần nhất)", value: formatVnd(revenue) }] : [])]} />
              {can("collab.manage") && <div className="wf-dev-row" style={{ marginTop: 12 }}><Button icon={<Pencil size={16} aria-hidden="true" />} onClick={openEdit}>Sửa hồ sơ</Button></div>}
            </section>

            <section aria-label="Hàng đang giao"><div className="wf-sec"><h3>Đang được giao ({c.units.length})</h3></div>
              {c.units.length === 0 ? <div className="g wf-pad"><EmptyState title="Chưa giao chiếc nào" description={can("collab.manage") ? "Bấm “Giao thêm” để chọn chiếc cho CTV này." : undefined} /></div> : (
                <InsetList>
                  {c.units.map((u) => (
                    <InsetRow key={u.id} href={`/dong-ho/${u.id}`} wrap thumb={u.thumbUrl ? <img src={u.thumbUrl} alt="" loading="lazy" width={48} height={48} /> : <WatchArt crop="head" seed={artSeed(u.brandName, u.modelName)} brand={u.brandName} model={u.modelName} />}
                      title={joinTitle(u.brandName, u.modelName)} subtitle={`${u.assetCode} · cùng giao cho ${Math.max(u.collaborators.length - 1, 0)} CTV khác`} end={formatVnd(u.listPrice)}
                      endSub={u.collaborators.some((x) => x.claimId && x.collaboratorId === c.id) ? <StatusChip tone="hold">Đã báo bán</StatusChip> : undefined} />
                  ))}
                </InsetList>
              )}
            </section>

            <section aria-label="Báo bán"><div className="wf-sec"><h3>Báo bán gần đây</h3></div>
              {c.claims.length === 0 ? <div className="g wf-pad"><p className="wf-mute">CTV này chưa báo bán lần nào.</p></div> : (
                <InsetList>
                  {c.claims.map((k) => (
                    <InsetRow key={k.id} href="/cong-tac-vien/bao-ban" title={`${k.assetCode} · ${k.customerName}`} subtitle={`${joinTitle(k.brandName, k.modelName)} · ${formatDateTimeVn(k.createdAt)}`} end={<StatusChip kind="claim" status={k.status} />} />
                  ))}
                </InsetList>
              )}
            </section>

            <section aria-label="Đơn đã bán"><div className="wf-sec"><h3>Đơn CTV bán được</h3></div>
              {c.orders.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Chưa có đơn nào.</p></div> : (
                <InsetList>
                  {c.orders.map((o) => (
                    <InsetRow key={o.id} href={`/ban-hang/${o.id}`} title={o.code} subtitle={[o.customerName, o.items, formatDateVn(o.docDate)].filter(Boolean).join(" · ")} end={can("report.sales") ? formatVnd(o.grandTotal) : undefined}
                      endSub={o.status === "voided" ? <StatusChip kind="doc" status="voided" /> : undefined} />
                  ))}
                </InsetList>
              )}
            </section>
            <p className="wf-mute" style={{ fontSize: 13 }}><Link href="/bao-cao/cong-tac-vien" style={{ color: "var(--wf-accent-text)" }}>Xem báo cáo CTV theo ngày/tháng/quý/năm →</Link></p>
          </div>
        )}
        <Modal open={edit} onClose={() => setEdit(false)} busy={busy} dirty={edit && !!c && (f.phone !== normalizePhone(c.phone ?? "") || f.area !== (c.area ?? "") || f.note !== (c.note ?? "") || f.isActive !== c.isActive)} title="Hồ sơ cộng tác viên">
          <div className="wf-stack">
            <Field label="Điện thoại"><PhoneInput value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} /></Field>
            <Field label="Khu vực"><TextInput value={f.area} onChange={(e) => setF((x) => ({ ...x, area: e.target.value }))} placeholder="Ví dụ: Hải Châu, Đà Nẵng" /></Field>
            <Field label="Ghi chú"><Textarea rows={2} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></Field>
            <Switch checked={f.isActive} onChange={(v) => setF((x) => ({ ...x, isActive: v }))} label="Đang hoạt động" description="Tắt ⇒ không giao thêm hàng cho CTV này" />
            <div className="wf-modal-f"><ModalClose disabled={busy}>Hủy</ModalClose><Button variant="primary" loading={busy} onClick={() => void save()}>Lưu</Button></div>
          </div>
        </Modal>
      </RequirePerm>
    </>
  );
}
