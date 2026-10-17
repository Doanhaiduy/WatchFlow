"use client";
import { joinTitle } from "@/components/catalog/types";
import { Copy, History, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "../auth/helpers";
import type { Part, UnitDto } from "../catalog/types";
import { unitTitle } from "../catalog/types";
import { CustomerPicker, type PickedCustomer } from "../customers/CustomerPicker";
import { ImageUpload } from "../lucian/ImageUpload";
import { WizardSteps } from "../lucian/WizardSteps";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { useDirtyGuard } from "../ui/useDirtyGuard";
import { useSourceNames } from "./useSourceNames";
import { KeyValue, LockNote } from "../ui/Display";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Field } from "../ui/Field";
import { InsetList, InsetRow } from "../ui/InsetList";
import { Modal } from "../ui/Modal";
import { MoneyInput } from "../ui/MoneyInput";
import { SearchBar } from "../ui/SearchBar";
import { SegmentedControl } from "../ui/SegmentedControl";
import { DateInput } from "../ui/DateInput";
import { Select, Textarea, TextInput } from "../ui/TextInput";
import { StatusChip } from "../ui/StatusChip";
import { useToast } from "../ui/Toast";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { todayVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { COST_KINDS, COST_LABELS } from "@/lib/types/purchases";
import type { PurchaseConfirmResult, PurchaseDetail } from "../trade/types";
import { emptyWatch, WatchFields, watchBody, type WatchValue } from "../trade/WatchFields";
import { useDebounced } from "../trade/useDebounced";

type WLine = { key: string; kind: "watch"; w: WatchValue; unitPrice: number | null; rebuy: { id: string; label: string } | null; note: string };
type PLine = { key: string; kind: "part"; partId: string; qty: string; unitPrice: number | null; note: string };
type Line = WLine | PLine;
type Cost = { key: string; kind: string; description: string; amount: number | null; method: "by_value" | "equal" };

let k = 0;
const nk = () => `l${++k}`;
const STEPS = ["Loại phiếu", "Hàng nhập", "Chi phí", "Xem lại"];
const KINDS = [{ value: "purchase", label: "Mua vào" }, { value: "customer_buyback", label: "Thu mua từ khách" }, { value: "opening", label: "Tồn đầu kỳ" }] as const;

function fromDetail(d: PurchaseDetail): Line[] {
  return d.lines.map((l) =>
    l.lineType === "watch"
      ? {
          key: nk(), kind: "watch" as const,
          w: emptyWatch({ modelId: l.modelId ?? "", serialNo: l.serialNo ?? "", hasSerial: l.hasSerial ?? true, condition: l.condition ?? "used", conditionGrade: l.conditionGrade ?? "", conditionNote: l.conditionNote ?? "", initialStatus: l.initialStatus ?? "in_stock", locationId: l.locationId ?? "", listPrice: l.listPrice ?? null }),
          unitPrice: l.unitPrice, rebuy: l.rebuyUnitId ? { id: l.rebuyUnitId, label: "Chiếc nhập lại" } : null, note: l.note ?? "",
        }
      : { key: nk(), kind: "part" as const, partId: l.partId ?? "", qty: String(l.qty), unitPrice: l.unitPrice, note: l.note ?? "" },
  );
}

function RebuyPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (u: UnitDto) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const res = useSWR<{ items: UnitDto[] }>(open && dq.length >= 2 ? `/api/v1/catalog/units?status=sold&q=${encodeURIComponent(dq)}&pageSize=8` : null, swrFetcher);
  return (
    <Modal open={open} onClose={onClose} title="Nhập lại chiếc đã bán">
      <p className="wf-mute" style={{ marginBottom: 8 }}>Tìm theo mã nội bộ hoặc serial của chiếc cửa hàng đã bán, khách bán lại.</p>
      <SearchBar value={q} onChange={setQ} placeholder="Mã nội bộ, serial…" />
      {res.data && res.data.items.length === 0 && <p className="wf-mute">Không có chiếc đã bán nào khớp.</p>}
      {res.data && res.data.items.length > 0 && (
        <InsetList>
          {res.data.items.map((u) => <InsetRow key={u.id} title={unitTitle(u)} subtitle={`${u.assetCode}${u.serialNo ? ` · ${u.serialNo}` : ""}`} end={<StatusChip kind="unit" status={u.status} />} onClick={() => onPick(u)} />)}
        </InsetList>
      )}
    </Modal>
  );
}

export function PurchaseForm({ initial, onSaved }: { initial?: PurchaseDetail; onSaved?: () => void }) {
  const { can } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [kind, setKind] = useState<string>(initial?.kind ?? "purchase");
  const [source, setSource] = useState(initial?.sourceName ?? "");
  const [seller, setSeller] = useState<PickedCustomer | null>(initial?.sellerCustomerId ? { id: initial.sellerCustomerId, fullName: initial.sellerName ?? "Người bán", phone: initial.sellerPhone } : null);
  const [docDate, setDocDate] = useState(initial?.docDate ?? "");
  const [backReason, setBackReason] = useState("");
  const [payNote, setPayNote] = useState(initial?.paymentNote ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<Line[]>(initial ? fromDetail(initial) : []);
  const [costs, setCosts] = useState<Cost[]>((initial?.costs ?? []).map((c) => ({ key: nk(), kind: c.kind, description: c.description ?? "", amount: c.amount, method: c.allocateMethod })));
  const [detail, setDetail] = useState<PurchaseDetail | null>(initial ?? null);
  const [busy, setBusy] = useState<"" | "save" | "confirm">("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseConfirmResult | null>(null);
  const [rebuyFor, setRebuyFor] = useState<string | null>(null);
  const [askConfirm, setAskConfirm] = useState(false);
  const createKey = useRef(newIdempotencyKey());
  const confirmKey = useRef(newIdempotencyKey());
  const parts = useSWR<{ items: Part[] }>(can("part.view") ? "/api/v1/parts?pageSize=100" : null, swrFetcher);

  const touch = () => {
    confirmKey.current = newIdempotencyKey(); // nội dung đổi ⇒ khóa mới; giữ nguyên khi chỉ bấm lại
  };
  const upd = (key: string, p: Partial<WLine> | Partial<PLine>) => {
    touch();
    setLines((l) => l.map((x) => (x.key === key ? ({ ...x, ...p } as Line) : x)));
  };
  const updW = (key: string, p: Partial<WatchValue>) => {
    touch();
    setLines((l) => l.map((x) => (x.key === key && x.kind === "watch" ? { ...x, w: { ...x.w, ...p } } : x)));
  };

  const body = useMemo(
    () => ({
      kind,
      sourceName: kind === "purchase" ? source.trim() || null : null,
      sellerCustomerId: kind === "customer_buyback" ? (seller?.id ?? null) : null,
      ...(docDate ? { docDate } : {}),
      backdateReason: backReason.trim() || null,
      paymentNote: payNote.trim() || null,
      note: note.trim() || null,
      lines: lines.map((l) =>
        l.kind === "watch"
          ? { lineType: "watch" as const, ...watchBody(l.w), unitPrice: l.unitPrice ?? 0, rebuyUnitId: l.rebuy?.id ?? null, note: l.note.trim() || null }
          : { lineType: "part" as const, partId: l.partId, qty: Number(l.qty) || 0, unitPrice: l.unitPrice ?? 0, note: l.note.trim() || null },
      ),
      costs: costs.filter((c) => c.amount).map((c) => ({ kind: c.kind, description: c.description.trim() || null, amount: c.amount ?? 0, allocateMethod: c.method })),
    }),
    [kind, source, seller, docDate, backReason, payNote, note, lines, costs],
  );

  const lastSaved = useRef(JSON.stringify(initial ? null : ""));
  const reload = async (pid: string) => {
    const d = await sapi<PurchaseDetail>(`/api/v1/purchases/${pid}`);
    setDetail(d);
    return d;
  };

  /** Lưu nháp (tạo mới hoặc ghi đè); trả id */
  const save = async (quiet = false): Promise<string | null> => {
    if (!quiet) setErr(null);
    lastSaved.current = JSON.stringify(body);
    try {
      let pid = id;
      if (!pid) {
        pid = (await sapi<{ id: string }>("/api/v1/purchases", { body, idempotencyKey: createKey.current })).id;
        setId(pid);
        window.history.replaceState(null, "", `/nhap-hang/${pid}`);
      } else {
        await sapi(`/api/v1/purchases/${pid}`, { method: "PATCH", ifMatch: detail?.version, body });
      }
      await reload(pid);
      onSaved?.();
      return pid;
    } catch (x) {
      const f = fieldErrors(x);
      setErr(Object.keys(f).length ? Object.entries(f).map(([p, m]) => `${p}: ${m}`).join(" · ") : errMsg(x));
      return null;
    }
  };

  const doSave = async () => {
    setBusy("save");
    const pid = await save();
    setBusy("");
    if (pid) toast.success("Đã lưu nháp");
  };
  const doConfirm = async () => {
    setBusy("confirm");
    const pid = await save();
    if (pid) {
      try {
        const r = await sapi<PurchaseConfirmResult>(`/api/v1/purchases/${pid}/confirm`, { method: "POST", idempotencyKey: confirmKey.current });
        setResult(r);
        toast.success(`Đã xác nhận phiếu ${r.code ?? ""}`);
      } catch (x) {
        confirmKey.current = newIdempotencyKey();
        setErr(errMsg(x));
      }
    }
    setBusy("");
  };

  // Tự lưu nháp mỗi khi có thay đổi ngưng 2 giây (chỉ khi đã có id nháp — tạo lần đầu bấm "Lưu nháp")
  const dbody = useDebounced(JSON.stringify(body), 2000);
  useEffect(() => {
    if (!id || busy || result || dbody === lastSaved.current) return;
    lastSaved.current = dbody;
    void save(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbody]);

  // Lỗi máy chủ nằm cuối trang, dễ khuất sau thanh hành động dính đáy ⇒ báo thêm bằng toast
  useEffect(() => {
    if (err) toast.error("Chưa thực hiện được", err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err]);

  // Còn thay đổi chưa lưu ⇒ cảnh báo khi đóng tab/bấm sang trang khác. Phiếu mới chưa có nháp: có nhập gì là tính;
  // đã có nháp: chỉ khi thay đổi chưa kịp tự lưu (đợi 2 giây) hoặc lần lưu gần nhất lỗi.
  const dirtyNow = !result && (id ? JSON.stringify(body) !== dbody || !!err : lines.length > 0 || !!source.trim() || !!note.trim() || costs.length > 0);
  const guard = useDirtyGuard(dirtyNow);
  const sourceNames = useSourceNames(kind === "purchase");

  if (result) {
    return (
      <div className="wf-stack">
        <section className="g wf-pad" style={{ textAlign: "center" }}>
          <StatusChip tone="ok">Đã xác nhận</StatusChip>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 4px" }}>Phiếu {result.code}</h2>
          <p className="wf-mute">{result.units?.length ?? 0} chiếc mới đã vào kho. In tem QR để dán lên từng chiếc.</p>
        </section>
        {result.units && result.units.length > 0 && (
          <InsetList label="Chiếc mới nhập">
            {result.units.map((u) => (
              <InsetRow key={u.unitId} title={u.assetCode} subtitle={`Dòng ${u.lineNo}${u.rebuy ? " · nhập lại" : ""}`} end={<span className="wf-dev-row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}><Button sm href={`/dong-ho/${u.unitId}`}>Mở</Button><Button sm variant="primary" href={`/dong-ho/${u.unitId}/tem`}>In tem</Button></span>} />
            ))}
          </InsetList>
        )}
        <div className="wf-dev-row">
          <Button href={`/nhap-hang/${result.id}`}>Xem phiếu</Button>
          <Button variant="primary" href="/nhap-hang/moi" onClick={() => window.location.assign("/nhap-hang/moi")}>Nhập phiếu khác</Button>
        </div>
      </div>
    );
  }

  const today = todayVn();
  const showCost = can("cost.view");
  const buyback = kind === "customer_buyback";
  const needsPhoto = lines.some((l) => l.kind === "watch" && l.w.condition !== "new" && l.w.initialStatus === "in_stock");
  const canNext0 = kind === "purchase" ? !!source.trim() : buyback ? !!seller : true;
  const sellerMissing = step === 0 && buyback && !seller;
  const sourceMissing = step === 0 && kind === "purchase" && !source.trim();
  const gradeOk = (w: WatchValue) => w.condition === "new" || w.initialStatus !== "in_stock" || !!w.conditionGrade.trim();
  const photoMissing = needsPhoto && !(detail && detail.files.length > 0);
  const linesOk = lines.length > 0 && lines.every((l) => (l.kind === "watch" ? !!l.w.modelId && !!l.w.locationId && l.unitPrice !== null && gradeOk(l.w) : !!l.partId && Number(l.qty) > 0 && l.unitPrice !== null));

  return (
    <div className="wf-stack">
      <WizardSteps steps={STEPS} current={step} onStep={setStep} label="Các bước lập phiếu nhập" />

      {step === 0 && (
        <section className="g wf-pad" aria-label="Loại phiếu">
          <SegmentedControl ariaLabel="Loại phiếu nhập" value={kind} onChange={(v) => { touch(); setKind(v); }} options={KINDS.map((x) => ({ ...x }))} />
          <div style={{ marginTop: 14 }}>
            {kind === "purchase" && <Field label="Nguồn hàng" required hint="Ghi chữ, ví dụ: Anh Hùng — Chợ Lớn, nhập lô tháng 10. Gõ vài chữ để chọn nguồn đã dùng."><Combobox value={source} options={sourceNames} heading="Nguồn đã dùng gần đây" onChange={(v) => { touch(); setSource(v); }} /></Field>}
            {buyback && (
              <>
                <CustomerPicker label="Người bán (khách)" value={seller} onChange={(c) => { touch(); setSeller(c); }} />
                <div style={{ height: 12 }} />
                <Field label="Cách trả tiền cho khách" hint="Ghi chú, vd. Chuyển khoản 12/10"><TextInput value={payNote} onChange={(e) => { touch(); setPayNote(e.target.value); }} /></Field>
              </>
            )}
            {kind === "opening" && <p className="wf-mute">Tồn đầu kỳ dùng để đưa hàng đang có vào hệ thống. Giá nhập là giá vốn ghi sổ.</p>}
            <Field label="Ngày chứng từ" hint="Để trống = hôm nay">
              <DateInput clearable={false} value={docDate} max={today} onChange={(v) => { touch(); setDocDate(v); }} />
            </Field>
            {docDate && docDate < today && <Field label="Lý do ghi lùi ngày" hint="Cần khi lùi quá số ngày cho phép"><TextInput value={backReason} onChange={(e) => setBackReason(e.target.value)} /></Field>}
            <Field label="Ghi chú"><Textarea rows={2} value={note} onChange={(e) => { touch(); setNote(e.target.value); }} /></Field>
          </div>
        </section>
      )}

      {step === 1 && (
        <>
          {lines.length === 0 && <div className="g wf-pad"><p className="wf-mute">Chưa có dòng nào. Thêm đồng hồ hoặc linh kiện bên dưới.</p></div>}
          {lines.map((l, i) => (
            <section key={l.key} className="g wf-pad" aria-label={`Dòng ${i + 1}`}>
              <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <b>Dòng {i + 1} · {l.kind === "watch" ? "Đồng hồ" : "Linh kiện"}</b>
                <span className="wf-dev-row" style={{ gap: 6 }}>
                  {l.kind === "watch" && <Button sm iconOnly aria-label="Nhân bản dòng" onClick={() => { touch(); setLines((a) => [...a.slice(0, i + 1), { ...l, key: nk(), w: { ...l.w, serialNo: "" }, rebuy: null }, ...a.slice(i + 1)]); }}><Copy size={16} aria-hidden="true" /></Button>}
                  <Button sm iconOnly aria-label="Xóa dòng" onClick={() => { touch(); setLines((a) => a.filter((x) => x.key !== l.key)); }}><Trash2 size={16} aria-hidden="true" /></Button>
                </span>
              </div>
              {l.kind === "watch" ? (
                <>
                  {l.rebuy && <div style={{ marginBottom: 8 }}><StatusChip tone="info">Nhập lại: {l.rebuy.label}</StatusChip></div>}
                  <WatchFields value={l.w} onChange={(p) => updW(l.key, p)} locationRequired />
                  <Field label="Giá nhập" required><MoneyInput value={l.unitPrice} onChange={(v) => upd(l.key, { unitPrice: v })} /></Field>
                  {kind === "customer_buyback" && !l.rebuy && <Button sm icon={<History size={14} aria-hidden="true" />} onClick={() => setRebuyFor(l.key)}>Nhập lại chiếc đã bán</Button>}
                </>
              ) : (
                <>
                  <Field label="Linh kiện" required>
                    <Select placeholder="Chọn linh kiện" value={l.partId} onChange={(e) => upd(l.key, { partId: e.target.value })} options={(parts.data?.items ?? []).filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                    <Field label="Số lượng" required><TextInput inputMode="numeric" value={l.qty} onChange={(e) => upd(l.key, { qty: e.target.value.replace(/\D/g, "") })} /></Field>
                    <Field label="Đơn giá nhập" required><MoneyInput value={l.unitPrice} onChange={(v) => upd(l.key, { unitPrice: v })} /></Field>
                  </div>
                </>
              )}
            </section>
          ))}
          <div className="wf-dev-row">
            <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => { touch(); setLines((a) => [...a, { key: nk(), kind: "watch", w: emptyWatch(), unitPrice: null, rebuy: null, note: "" }]); }}>Thêm đồng hồ</Button>
            {can("part.view") && <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => { touch(); setLines((a) => [...a, { key: nk(), kind: "part", partId: "", qty: "1", unitPrice: null, note: "" }]); }}>Thêm linh kiện</Button>}
          </div>
        </>
      )}

      {step === 2 && (
        <section className="g wf-pad" aria-label="Chi phí">
          <p className="wf-mute" style={{ marginBottom: 8 }}>Chi phí phát sinh (vận chuyển, kiểm định…) được phân bổ vào giá vốn từng dòng.</p>
          {costs.map((c) => (
            <div key={c.key} className="wf-cart-line">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Loại chi phí"><Select value={c.kind} onChange={(e) => { touch(); setCosts((a) => a.map((x) => (x.key === c.key ? { ...x, kind: e.target.value } : x))); }} options={COST_KINDS.map((x) => ({ value: x, label: COST_LABELS[x] }))} /></Field>
                <Field label="Phân bổ"><Select value={c.method} onChange={(e) => { touch(); setCosts((a) => a.map((x) => (x.key === c.key ? { ...x, method: e.target.value as Cost["method"] } : x))); }} options={[{ value: "by_value", label: "Theo giá trị" }, { value: "equal", label: "Chia đều" }]} /></Field>
              </div>
              <Field label="Số tiền"><MoneyInput value={c.amount} onChange={(v) => { touch(); setCosts((a) => a.map((x) => (x.key === c.key ? { ...x, amount: v } : x))); }} /></Field>
              <Field label="Ghi chú"><TextInput value={c.description} onChange={(e) => { touch(); setCosts((a) => a.map((x) => (x.key === c.key ? { ...x, description: e.target.value } : x))); }} /></Field>
              <Button sm icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => { touch(); setCosts((a) => a.filter((x) => x.key !== c.key)); }}>Xóa chi phí</Button>
            </div>
          ))}
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => { touch(); setCosts((a) => [...a, { key: nk(), kind: "shipping", description: "", amount: null, method: "by_value" }]); }}>Thêm chi phí</Button>
        </section>
      )}

      {step === 3 && (
        <>
          <section className="g wf-pad" aria-label="Tóm tắt phiếu">
            <KeyValue
              items={[
                { label: "Loại phiếu", value: KINDS.find((x) => x.value === kind)?.label ?? kind },
                { label: kind === "customer_buyback" ? "Người bán" : "Nguồn", value: kind === "customer_buyback" ? (seller?.fullName ?? "—") : source || "—" },
                { label: "Số dòng", value: `${lines.length} (${lines.filter((l) => l.kind === "watch").length} đồng hồ)` },
                { label: "Chi phí", value: costs.filter((c) => c.amount).length ? `${costs.filter((c) => c.amount).length} khoản` : "Không có" },
                ...(detail ? [{ label: "Tiền hàng", value: formatVnd(detail.subtotal) }, { label: "Chi phí phát sinh", value: formatVnd(detail.extraCostTotal) }, { label: "Tổng phiếu", value: <b>{formatVnd(detail.grandTotal)}</b> }] : []),
              ]}
            />
            {!detail && <p className="wf-mute">Bấm “Lưu nháp” để máy chủ tính tổng và phân bổ chi phí.</p>}
          </section>
          {detail && showCost && detail.lines.length > 0 && (
            <section className="g wf-pad" aria-label="Giá vốn sau phân bổ">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Giá vốn sau phân bổ chi phí</h3>
              <InsetList noInset>
                {detail.lines.map((l, i) => (
                  <InsetRow key={l.id ?? i} title={l.lineType === "watch" ? joinTitle(l.brandName, l.modelName) : (l.partName ?? "Linh kiện")} subtitle={`Nhập ${formatVnd(l.unitPrice)}${l.qty > 1 ? ` × ${l.qty}` : ""} + phân bổ ${formatVnd(l.allocatedCost ?? 0)}`} end={formatVnd(Math.round(l.unitCost ?? 0))} endSub={l.lineType === "part" ? "giá vốn/đơn vị" : "giá vốn"} />
                ))}
              </InsetList>
              <LockNote />
            </section>
          )}
          {id && (buyback || needsPhoto) && (
            <section className="g wf-pad" aria-label="Ảnh chứng từ">
              {buyback && (
                <>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Ảnh giấy tờ người bán</h3>
                  <ImageUpload kind="id_document" entityTable="purchase_receipts" entityId={id} onUploaded={() => void reload(id)} />
                </>
              )}
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: buyback ? "14px 0 6px" : "0 0 6px" }}>Ảnh tình trạng máy</h3>
              {needsPhoto && <p className="wf-mute" style={{ marginBottom: 6 }}>Hàng cũ/đã sửa cần ảnh tình trạng trước khi bán (hoặc để trạng thái “Chờ kiểm tra”).</p>}
              <ImageUpload kind="condition" entityTable="purchase_receipts" entityId={id} onUploaded={() => void reload(id)} />
              {detail && detail.files.length > 0 && <p className="wf-mute" style={{ marginTop: 8 }}>Đã tải {detail.files.length} ảnh.</p>}
            </section>
          )}
          {buyback && !id && <p className="wf-mute">Lưu nháp trước để tải ảnh giấy tờ và ảnh máy.</p>}
        </>
      )}

      {err && <div className="wf-lock" role="alert" style={{ background: "var(--wf-bad-t)" }}>{err}</div>}

      {(step === 3 && photoMissing && can("purchase.confirm")) && <p className="wf-mute" role="status" style={{ fontSize: 13, textAlign: "center" }}>Hàng cũ/đã sửa cần ít nhất một ảnh tình trạng (tải ở khung “Ảnh tình trạng máy”) hoặc đặt trạng thái “Chờ kiểm tra”.</p>}
      {(sellerMissing || sourceMissing || (step === 1 && !linesOk)) && (
        <p className="wf-mute" role="status" style={{ fontSize: 13, textAlign: "center" }}>
          {sourceMissing ? "Ghi nguồn hàng (ví dụ: tên người bán, chợ) để tiếp tục." : sellerMissing ? "Chọn người bán (khách) để tiếp tục." : lines.length === 0 ? "Thêm ít nhất một dòng hàng." : "Mỗi dòng cần đủ loại/linh kiện, vị trí kho, giá nhập; hàng cũ muốn “Sẵn sàng bán” cần thêm hạng tình trạng."}
        </p>
      )}
      <div className="wf-sticky-save g" role="region" aria-label="Thao tác phiếu nhập">
        <Button sm disabled={step === 0} onClick={() => setStep(step - 1)}>Quay lại</Button>
        <span className="wf-dev-row" style={{ flexWrap: "nowrap", gap: 8 }}>
          {step >= 1 && <Button sm loading={busy === "save"} disabled={!!busy || !linesOk} onClick={() => void doSave()}>Lưu nháp</Button>}
          {step < 3 ? (
            <Button sm variant="primary" disabled={step === 0 ? !canNext0 : step === 1 ? !linesOk : false} onClick={() => setStep(step + 1)}>Tiếp</Button>
          ) : can("purchase.confirm") ? (
            <Button sm variant="primary" guard loading={busy === "confirm"} disabled={!!busy || !linesOk || photoMissing} onClick={() => setAskConfirm(true)}>Xác nhận phiếu</Button>
          ) : (
            <span className="wf-mute" style={{ fontSize: 13 }}>Chủ cửa hàng sẽ xác nhận</span>
          )}
        </span>
      </div>
      <ConfirmDialog
        open={askConfirm}
        title="Xác nhận phiếu nhập?"
        message={<>Phiếu có {lines.length} dòng ({lines.filter((l) => l.kind === "watch").length} đồng hồ). Sau khi xác nhận, hàng vào kho và phiếu không sửa được nữa (chỉ hủy kèm lý do).</>}
        confirmLabel="Xác nhận phiếu"
        loading={busy === "confirm"}
        onCancel={() => setAskConfirm(false)}
        onConfirm={async () => { await doConfirm(); setAskConfirm(false); }}
      />
      {guard.dialog}
      <RebuyPicker open={!!rebuyFor} onClose={() => setRebuyFor(null)} onPick={(u) => { if (rebuyFor) updW(rebuyFor, { modelId: u.model.id, serialNo: u.serialNo ?? "", hasSerial: u.hasSerial }); if (rebuyFor) upd(rebuyFor, { rebuy: { id: u.id, label: `${u.assetCode} · ${unitTitle(u)}` } }); setRebuyFor(null); }} />
    </div>
  );
}
