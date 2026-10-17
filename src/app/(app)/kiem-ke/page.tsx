"use client";
import { ClipboardCheck, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { useLocations } from "@/components/catalog/useLists";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, TextInput } from "@/components/ui/TextInput";
import { ST_LABEL, SCOPE_LABEL, type Stocktake } from "@/components/stocktake/meta";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

export default function StocktakesPage() {
  const { can } = useSession();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ items: Stocktake[] }>(can("stocktake.manage") ? "/api/v1/stocktakes" : null, swrFetcher);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("all_units");
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locs = useLocations(open);
  const key = useRef("");
  useEffect(() => {
    if (open) { setScope("all_units"); setLoc(""); setNote(""); setErr(null); key.current = newIdempotencyKey(); }
  }, [open]);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<{ id: string }>("/api/v1/stocktakes", { body: { scope, locationId: scope === "location" ? loc : null, note: note.trim() || undefined }, idempotencyKey: key.current });
      await mutate();
      router.push(`/kiem-ke/${r.id}`);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Kiểm kê" description="Đếm chiếc và linh kiện, đối chiếu với hệ thống" actions={can("stocktake.manage") ? <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>Mở đợt</Button> : undefined} />
      <RequirePerm perm="stocktake.manage">
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<ClipboardCheck size={24} />} title="Chưa có đợt kiểm kê" description="Mở đợt để đếm hàng trong kho và đối chiếu số hệ thống." action={{ label: "Mở đợt kiểm kê", onClick: () => setOpen(true) }} /></div>
        ) : (
          <InsetList label="Các đợt kiểm kê">
            {data?.items.map((s) => {
              const st = ST_LABEL[s.status] ?? { label: s.status, tone: "neutral" as const };
              return (
                <InsetRow key={s.id} href={`/kiem-ke/${s.id}`} icon={<ClipboardCheck size={20} aria-hidden="true" />} tone={st.tone}
                  title={s.code}
                  subtitle={`${SCOPE_LABEL[s.scope] ?? s.scope}${s.locationName ? ` (${s.locationName})` : ""} · đã đếm ${s.countedCount}/${s.lineCount} · ${formatDateTimeVn(s.startedAt)}`}
                  end={Number(s.loss) > 0 ? formatVnd(Number(s.loss)) : undefined} endSub={<StatusChip tone={st.tone}>{st.label}</StatusChip>} />
              );
            })}
          </InsetList>
        )}
        <Modal open={open} onClose={() => setOpen(false)} busy={busy} title="Mở đợt kiểm kê" footer={<><Button onClick={() => setOpen(false)} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={scope === "location" && !loc} onClick={() => void start()}>Mở đợt</Button></>}>
          <Field label="Phạm vi kiểm"><Select value={scope} onChange={(e) => setScope(e.target.value)} options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
          {scope === "location" && <Field label="Vị trí" required><Select placeholder="Chọn vị trí" value={loc} onChange={(e) => setLoc(e.target.value)} options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} /></Field>}
          <Field label="Ghi chú"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
          <p className="wf-mute">Danh sách chiếc/linh kiện cần đếm được lập sẵn; số hệ thống sẽ lấy lại lúc chốt.</p>
          {err && <p className="wf-fld-err" role="alert">{err}</p>}
        </Modal>
      </RequirePerm>
    </>
  );
}
