"use client";
import { Trash2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { UnitThumb } from "@/components/catalog/UnitArt";
import { unitTitle, type UnitDto } from "@/components/catalog/types";
import type { CollabRow } from "@/components/collab/types";
import { UnitSearch } from "@/components/trade/UnitSearch";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { api, newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";

// Giao đồng hồ cho CTV bán (CF-11): chọn chiếc + chọn MỘT HOẶC NHIỀU CTV. Chiếc vẫn ở kho; CTV nào báo đã bán trước được giữ.
export default function OfferPage() {
  const router = useRouter();
  const toast = useToast();
  const list = useSWR<{ items: CollabRow[] }>("/api/v1/collaborators", swrFetcher);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [who, setWho] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const done = useRef(false);
  const ctvs = (list.data?.items ?? []).filter((c) => c.isActive);

  // ?chiec=<id> (từ trang đồng hồ) và ?ctv=<id> (từ trang CTV): mở sẵn lựa chọn
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const u = sp.get("chiec"), c = sp.get("ctv");
    if (c) setWho([c]);
    if (u) void api<UnitDto>(`/api/v1/catalog/units/${u}`, { noRedirect: true }).then((x) => x.status === "in_stock" && setUnits([x])).catch(() => undefined);
  }, []);

  const guard = useDirtyGuard(!done.current && (units.length > 0 || who.length > 0 || !!note.trim()));
  const touch = () => { key.current = newIdempotencyKey(); setErr(null); };
  const missing = [units.length === 0 && "chọn chiếc cần giao", who.length === 0 && "chọn ít nhất một cộng tác viên"].filter(Boolean) as string[];

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<{ created: number; units: number; collaborators: number }>("/api/v1/collab/offers", {
        body: { unitIds: units.map((u) => u.id), collaboratorIds: who, note: note.trim() || null }, idempotencyKey: key.current,
      });
      done.current = true;
      toast.success(`Đã giao ${r.units} chiếc cho ${r.collaborators} CTV`);
      router.replace("/cong-tac-vien/hang");
    } catch (e) {
      key.current = newIdempotencyKey();
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {guard.dialog}
      <PageHeader title="Giao đồng hồ cho CTV" description="Chọn chiếc và các CTV được bán — ai báo bán trước được giữ chiếc" />
      <RequirePerm perm="collab.manage">
        <div className="wf-stack">
          <section className="g wf-pad" aria-label="Chọn chiếc">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>1. Chiếc giao</h3>
            {units.length > 0 && (
              <InsetList label="Chiếc đã chọn">
                {units.map((u) => (
                  <InsetRow key={u.id} wrap thumb={<UnitThumb u={u} />} title={unitTitle(u)} subtitle={`${u.assetCode}${u.serialNo ? ` · ${u.serialNo}` : ""}`} end={formatVnd(u.effectivePrice)}
                    endSub={<Button sm iconOnly aria-label={`Bỏ ${u.assetCode}`} onClick={() => { touch(); setUnits((a) => a.filter((x) => x.id !== u.id)); }}><Trash2 size={14} aria-hidden="true" /></Button>} />
                ))}
              </InsetList>
            )}
            <div style={{ marginTop: 10 }}>
              <UnitSearch exclude={units.map((u) => u.id)} placeholder={units.length ? "Thêm chiếc khác…" : "Tìm mã nội bộ, serial, tên đồng hồ… hoặc quét QR"} onPick={(u) => { touch(); setUnits((a) => [...a, u]); }} />
            </div>
          </section>

          <section className="g wf-pad" aria-label="Chọn cộng tác viên">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>2. Giao cho ai? (chọn một hoặc nhiều)</h3>
            <p className="wf-mute" style={{ fontSize: 13, marginBottom: 8 }}>Chọn nhiều CTV ⇒ ai báo đã bán trước thì được, các CTV còn lại tự mất chiếc đó.</p>
            {list.isLoading ? <p className="wf-mute">Đang tải…</p> : ctvs.length === 0 ? (
              <p className="wf-mute">Chưa có cộng tác viên nào đang hoạt động. Tạo người dùng vai trò Cộng tác viên ở Quản trị → Người dùng.</p>
            ) : (
              <div className="wf-stack" style={{ gap: 4 }}>
                {ctvs.map((c) => (
                  <div key={c.id} className="wf-dev-row" style={{ alignItems: "center", gap: 10 }}>
                    <Avatar name={c.fullName} />
                    <Checkbox className="" checked={who.includes(c.id)} onChange={(on) => { touch(); setWho((w) => (on ? [...w, c.id] : w.filter((x) => x !== c.id))); }} label={<>{c.fullName}<span className="wf-mute"> · đang giữ {c.offered} chiếc</span></>} />
                  </div>
                ))}
                {ctvs.length > 1 && <Button sm onClick={() => { touch(); setWho(who.length === ctvs.length ? [] : ctvs.map((c) => c.id)); }}>{who.length === ctvs.length ? "Bỏ chọn tất cả" : "Chọn tất cả CTV"}</Button>}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Field label="Ghi chú cho CTV (tùy chọn)"><TextInput value={note} maxLength={500} onChange={(e) => { touch(); setNote(e.target.value); }} placeholder="Ví dụ: ưu tiên khách ở Đà Nẵng" /></Field>
            </div>
          </section>

          {err && <p className="wf-fld-err" role="alert">{err}</p>}
          <Button variant="primary" block guard loading={busy} disabled={missing.length > 0} icon={<Truck size={18} aria-hidden="true" />} onClick={() => void submit()}>
            Giao {units.length > 0 ? `${units.length} chiếc` : "đồng hồ"}{who.length > 0 ? ` cho ${who.length} CTV` : ""}
          </Button>
          {missing.length > 0 && <p className="wf-mute" style={{ textAlign: "center", fontSize: 13 }}>Còn thiếu: {missing.join(", ")}</p>}
        </div>
      </RequirePerm>
    </>
  );
}
