"use client";
import { Trash2, Truck } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { unitTitle, type UnitDto } from "@/components/catalog/types";
import type { CollabRow } from "@/components/collab/types";
import { UnitSearch } from "@/components/trade/UnitSearch";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, TextInput } from "@/components/ui/TextInput";
import { StatusChip } from "@/components/ui/StatusChip";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { api, newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

type L = { unit: UnitDto; base: number | null };
type Result = { id?: string; code?: string; warnings?: Array<string | { message?: string; assetCode?: string }> };

function View() {
  const sp = useSearchParams();
  const { can } = useSession();
  const [ctv, setCtv] = useState(sp.get("ctv") ?? "");
  const [lines, setLines] = useState<L[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const key = useRef(newIdempotencyKey());
  const list = useSWR<{ items: CollabRow[] }>(can("collab.manage") ? "/api/v1/collaborators" : null, swrFetcher);
  const who = list.data?.items.find((c) => c.id === ctv);
  const touch = () => { key.current = newIdempotencyKey(); };
  // Đã chọn chiếc/ghi chú mà chưa xác nhận giao ⇒ rời trang sẽ hỏi "Bỏ thay đổi chưa lưu?"
  const guard = useDirtyGuard(!res && (lines.length > 0 || !!note.trim()));
  const [preErr, setPreErr] = useState<string | null>(null);
  const pre = useRef(false);

  // ?unit=<id hoặc mã chiếc>: chọn sẵn chiếc (nút "Giao CTV" ở chi tiết đồng hồ)
  useEffect(() => {
    const q = sp.get("unit")?.trim();
    if (!q || pre.current || !can("collab.manage")) return;
    pre.current = true;
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    (async () => {
      try {
        const u = isId ? await api<UnitDto>(`/api/v1/catalog/units/${q}`) : (await api<{ items: UnitDto[] }>(`/api/v1/catalog/units/lookup?code=${encodeURIComponent(q)}`)).items[0];
        if (!u) setPreErr("Không tìm thấy chiếc cần giao. Hãy tìm lại ở ô bên dưới.");
        else if (u.status !== "in_stock") setPreErr(`Chiếc ${u.assetCode} đang không ở trạng thái sẵn sàng bán nên chưa giao được.`);
        else setLines((a) => (a.some((l) => l.unit.id === u.id) ? a : [...a, { unit: u, base: null }]));
      } catch (e) {
        setPreErr(errMsg(e));
      }
    })();
  }, [sp, can]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<Result>(`/api/v1/collaborators/${ctv}/assignments`, { body: { note: note.trim() || null, lines: lines.map((l) => ({ unitId: l.unit.id, basePrice: l.base ?? 0 })) }, idempotencyKey: key.current });
      setRes(r);
    } catch (e) {
      key.current = newIdempotencyKey();
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (res) {
    return (
      <section className="g wf-pad" style={{ textAlign: "center" }}>
        <StatusChip tone="ok">Đã giao</StatusChip>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0" }}>Phiếu giao {res.code ?? ""}</h2>
        <p className="wf-mute">{lines.length} chiếc đã giao cho {who?.fullName ?? "CTV"}.</p>
        {res.warnings && res.warnings.length > 0 && (
          <div className="wf-lock" role="status" style={{ display: "block", textAlign: "left", marginTop: 10 }}>
            <b>Cảnh báo giá thu thấp hơn giá vốn:</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>{res.warnings.map((w, i) => <li key={i}>{typeof w === "string" ? w : `${w.assetCode ?? ""} ${w.message ?? ""}`.trim()}</li>)}</ul>
          </div>
        )}
        <div className="wf-dev-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <Button variant="primary" href={`/cong-tac-vien/${ctv}`}>Xem CTV</Button>
          <Button onClick={() => window.location.assign(`/cong-tac-vien/giao-hang/moi?ctv=${ctv}`)}>Giao thêm</Button>
        </div>
      </section>
    );
  }
  return (
    <div className="wf-stack">
      {guard.dialog}
      <section className="g wf-pad">
        <Field label="Cộng tác viên" required>
          <Select placeholder="Chọn CTV" value={ctv} onChange={(e) => { touch(); setCtv(e.target.value); }} options={(list.data?.items ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.fullName }))} />
        </Field>
        {preErr && <p className="wf-fld-err" role="alert" style={{ marginBottom: 10 }}>{preErr}</p>}
        <p className="wf-fld-label">Chọn chiếc sẵn sàng bán để giao</p>
        <UnitSearch onPick={(u) => { touch(); setLines((a) => [...a, { unit: u, base: null }]); }} exclude={lines.map((l) => l.unit.id)} />
      </section>
      {lines.map((l) => (
        <section key={l.unit.id} className="g wf-pad" aria-label={l.unit.assetCode}>
          <div className="wf-dev-row" style={{ justifyContent: "space-between" }}>
            <span><b style={{ display: "block" }}>{unitTitle(l.unit)}</b><span className="wf-mute" style={{ fontSize: 12 }}>{l.unit.assetCode} · niêm yết {formatVnd(l.unit.listPrice)}</span></span>
            <Button sm iconOnly aria-label="Bỏ chiếc" onClick={() => { touch(); setLines((a) => a.filter((x) => x.unit.id !== l.unit.id)); }}><Trash2 size={16} aria-hidden="true" /></Button>
          </div>
          <Field label="Giá thu giao CTV" required hint={`CTV bán cao hơn giá này thì phần chênh là của CTV. Gợi ý theo niêm yết: ${formatVnd(l.unit.effectivePrice)}`}>
            <MoneyInput value={l.base} onChange={(v) => { touch(); setLines((a) => a.map((x) => (x.unit.id === l.unit.id ? { ...x, base: v } : x))); }} quickAdds={undefined} />
          </Field>
          {l.unit.cost != null && l.base !== null && l.base < l.unit.cost && <p className="wf-fld-err" role="status">Giá thu thấp hơn giá vốn ({formatVnd(l.unit.cost)}).</p>}
        </section>
      ))}
      <section className="g wf-pad"><Field label="Ghi chú phiếu giao"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        {err && <p className="wf-fld-err" role="alert">{err}</p>}
        {(!ctv || lines.length === 0 || lines.some((l) => l.base === null)) && <p className="wf-mute" role="status" style={{ marginBottom: 10, fontSize: 12.5 }}>{!ctv ? "Chọn cộng tác viên để tiếp tục." : lines.length === 0 ? "Chọn ít nhất một chiếc để giao." : "Nhập giá thu cho từng chiếc."}</p>}
        <Button variant="primary" block icon={<Truck size={16} aria-hidden="true" />} guard loading={busy} disabled={!ctv || lines.length === 0 || lines.some((l) => l.base === null)} onClick={() => void submit()}>Xác nhận giao {lines.length || ""} chiếc</Button>
      </section>
    </div>
  );
}

export default function NewAssignmentPage() {
  return (
    <>
      <PageHeader title="Giao hàng cho CTV" description="Chọn chiếc và nhập giá thu từng chiếc" />
      <RequirePerm perm="collab.manage"><Suspense fallback={null}><View /></Suspense></RequirePerm>
    </>
  );
}
