"use client";
import { useRef, useState, type FormEvent } from "react";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { emptyWatch, WatchFields, watchBody, type WatchValue } from "@/components/trade/WatchFields";
import type { PurchaseConfirmResult } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { Combobox } from "@/components/ui/Combobox";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { useSourceNames } from "@/components/purchases/useSourceNames";
import { newIdempotencyKey } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";

/** Nhập nhanh một chiếc (FR-UNIT-01): phiếu nhập 1 dòng tạo + xác nhận cùng lúc, giá vốn luôn có nguồn. */
export default function QuickAddUnitPage() {
  const [w, setW] = useState<WatchValue>(emptyWatch({ initialStatus: "inspecting" }));
  const [price, setPrice] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<(PurchaseConfirmResult & { paid?: number }) | null>(null);
  const key = useRef(newIdempotencyKey());

  const sourceNames = useSourceNames();
  // Đã nhập gì mà chưa bấm "Nhập vào kho" ⇒ rời trang sẽ hỏi "Bỏ thay đổi chưa lưu?"
  const guard = useDirtyGuard(!result && (!!source.trim() || !!w.modelId || !!w.serialNo.trim() || !!w.conditionNote.trim() || price !== null));
  const needsPhoto = w.condition !== "new" && w.initialStatus === "in_stock";
  const missing = [needsPhoto && "trạng thái “Chờ kiểm tra” (hàng cũ cần ảnh)", needsPhoto && !w.conditionGrade.trim() && "hạng tình trạng", !source.trim() && "nguồn hàng", !w.modelId && "loại đồng hồ", !w.locationId && "vị trí lưu kho", price === null && "giá nhập"].filter(Boolean) as string[];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<PurchaseConfirmResult>("/api/v1/purchases/quick", {
        body: { kind: "purchase", sourceName: source.trim() || null, lines: [{ lineType: "watch", ...watchBody(w), unitPrice: price ?? 0, rebuyUnitId: null }], costs: [] },
        idempotencyKey: key.current,
      });
      setResult(r);
    } catch (x) {
      key.current = newIdempotencyKey();
      const f = fieldErrors(x);
      setErr(Object.keys(f).length ? Object.entries(f).map(([p, m]) => `${p}: ${m}`).join(" · ") : errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {guard.dialog}
      <PageHeader title="Thêm đồng hồ" description="Nhập nhanh một chiếc" />
      <RequirePerm perm="purchase.create">
        {result ? (
          <section className="g wf-pad" style={{ textAlign: "center" }}>
            {result.status === "confirmed" ? <StatusChip tone="ok">Đã vào kho</StatusChip> : <StatusChip tone="hold">Phiếu nháp chờ xác nhận</StatusChip>}
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0" }}>{result.units?.[0]?.assetCode ?? result.code ?? "Đã lưu"}</h2>
            <p className="wf-mute">Giá nhập {formatVnd(price ?? 0)}. {result.status === "confirmed" ? "In tem QR để dán lên chiếc." : "Chủ cửa hàng cần xác nhận phiếu."}</p>
            <div className="wf-dev-row" style={{ justifyContent: "center", marginTop: 12 }}>
              {result.units?.[0] && <Button variant="primary" href={`/dong-ho/${result.units[0].unitId}/tem`}>In tem</Button>}
              {result.units?.[0] && <Button href={`/dong-ho/${result.units[0].unitId}`}>Mở chiếc</Button>}
              <Button onClick={() => { setResult(null); setW(emptyWatch({ initialStatus: "inspecting" })); setPrice(null); key.current = newIdempotencyKey(); }}>Nhập chiếc khác</Button>
              <Button href="/dong-ho">Về danh sách</Button>
            </div>
          </section>
        ) : (
          <form className="g wf-pad" onSubmit={submit} noValidate>
            <Field label="Nguồn hàng" required hint="Ghi chữ, ví dụ: khách bán lại, anh Hùng…"><Combobox value={source} options={sourceNames} heading="Nguồn đã dùng gần đây" onChange={setSource} /></Field>
            <WatchFields locationRequired value={w} onChange={(p) => { key.current = newIdempotencyKey(); setW((x) => ({ ...x, ...p, ...(p.condition ? { initialStatus: p.condition === "new" ? "in_stock" : "inspecting" } : {}) })); }} />
            <Field label="Giá nhập (giá vốn)" required><MoneyInput value={price} onChange={(v) => { key.current = newIdempotencyKey(); setPrice(v); }} /></Field>
            {err && <p className="wf-fld-err" role="alert">{err}</p>}
            <Button type="submit" variant="primary" block guard loading={busy} disabled={missing.length > 0} aria-describedby={missing.length ? "wf-quick-missing" : undefined}>
              Nhập vào kho
            </Button>
            {missing.length > 0 && (
              <p id="wf-quick-missing" className="wf-mute" style={{ textAlign: "center", marginTop: 8, fontSize: 13 }}>
                Còn thiếu: {missing.join(", ")}
              </p>
            )}
          </form>
        )}
      </RequirePerm>
    </>
  );
}
