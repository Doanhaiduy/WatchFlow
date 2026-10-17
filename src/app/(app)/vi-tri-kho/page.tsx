"use client";
import { MapPin, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Location } from "@/components/catalog/types";
import { useLocations } from "@/components/catalog/useLists";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";
import { LOCATION_KINDS, LOCATION_LABELS } from "@/lib/types/catalog";

function LocationModal({ loc, open, onClose, onDone }: { loc: Location | null; open: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("cabinet");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setName(loc?.name ?? ""); setKind(loc?.kind ?? "cabinet"); setNote(loc?.note ?? ""); setActive(loc?.isActive ?? true); setErrs({}); }
  }, [open, loc]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      if (loc) await sapi(`/api/v1/catalog/locations/${loc.id}`, { method: "PATCH", ifMatch: loc.version, body: { name, kind, note: note || undefined, isActive: active } });
      else await sapi("/api/v1/catalog/locations", { body: { name, kind, note: note || undefined } });
      toast.success(loc ? "Đã lưu vị trí" : "Đã thêm vị trí");
      await onDone();
    } catch (x) {
      const f = fieldErrors(x);
      setErrs(Object.keys(f).length ? f : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={loc ? "Sửa vị trí" : "Thêm vị trí"}>
      <form onSubmit={submit} noValidate>
        <Field label="Tên vị trí" required error={errs.name}><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tủ A · Ngăn 2" /></Field>
        <Field label="Loại" error={errs.kind}><Select value={kind} onChange={(e) => setKind(e.target.value)} options={LOCATION_KINDS.map((k) => ({ value: k, label: LOCATION_LABELS[k] }))} /></Field>
        <Field label="Ghi chú"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {loc && <Switch checked={active} onChange={setActive} label="Đang dùng" description="Tắt để không chọn được khi chuyển chiếc" />}
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LocationsPage() {
  const { can } = useSession();
  const manage = can("location.manage");
  const locs = useLocations();
  const [dlg, setDlg] = useState<{ open: boolean; loc: Location | null }>({ open: false, loc: null });
  return (
    <>
      <PageHeader
        title="Vị trí kho"
        description="Két, tủ, kệ trưng bày nơi cất đồng hồ"
        actions={manage ? <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setDlg({ open: true, loc: null })}>Thêm</Button> : undefined}
      />
      <RequirePerm perm={["location.manage", "catalog.view"]}>
        {locs.isLoading ? <SkeletonList rows={5} /> : locs.error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(locs.error)} onRetry={async () => (await locs.mutate()) !== undefined} /></div>
        ) : locs.data && locs.data.items.length > 0 ? (
          <InsetList label="Vị trí lưu kho">
            {locs.data.items.map((l) => (
              <InsetRow key={l.id} icon={<MapPin size={20} aria-hidden="true" />} tone={l.isActive ? "check" : "neutral"} title={l.name} subtitle={[LOCATION_LABELS[l.kind as keyof typeof LOCATION_LABELS] ?? l.kind, l.note].filter((x) => x && x !== l.name).join(" · ") || undefined} end={`${l.unitCount} chiếc`} endSub={l.isActive ? undefined : <StatusChip tone="neutral">Đã tắt</StatusChip>} onClick={manage ? () => setDlg({ open: true, loc: l }) : undefined} chevron={manage} />
            ))}
          </InsetList>
        ) : (
          <div className="g wf-pad"><EmptyState title="Chưa có vị trí kho" description="Thêm két/tủ đầu tiên để biết mỗi chiếc đang cất ở đâu." icon={<MapPin size={24} />} action={manage ? { label: "Thêm vị trí", onClick: () => setDlg({ open: true, loc: null }) } : undefined} /></div>
        )}
        <LocationModal open={dlg.open} loc={dlg.loc} onClose={() => setDlg({ open: false, loc: null })} onDone={async () => { await locs.mutate(); setDlg({ open: false, loc: null }); }} />
      </RequirePerm>
    </>
  );
}
