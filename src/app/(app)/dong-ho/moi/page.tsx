"use client";
import { useRef, useState, type FormEvent } from "react";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { emptyWatch, WatchFields, watchBody, type WatchValue } from "@/components/trade/WatchFields";
import type { PurchaseConfirmResult } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { newIdempotencyKey } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";

/** Thêm một chiếc đồng hồ vào kho (FR-UNIT-01): chọn loại, serial, tình trạng, vị trí, giá niêm yết. Hàng cũ vào “Chờ kiểm tra” cho đến khi có ảnh và bấm “Kiểm tra đạt”. */
export default function QuickAddUnitPage() {
  const [w, setW] = useState<WatchValue>(emptyWatch({ initialStatus: "in_stock", condition: "new" }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseConfirmResult | null>(null);
  const key = useRef(newIdempotencyKey());

  // Đã nhập gì mà chưa bấm “Thêm vào kho” ⇒ rời trang sẽ hỏi “Bỏ thay đổi chưa lưu?”
  const guard = useDirtyGuard(!result && (!!w.modelId || !!w.serialNo.trim() || !!w.conditionNote.trim() || w.listPrice !== null));
  const missing = [!w.modelId && "loại đồng hồ", !w.locationId && "vị trí lưu kho"].filter(Boolean) as string[];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || missing.length) return;
    setBusy(true);
    setErr(null);
    try {
      const initialStatus = w.condition === "new" ? "in_stock" : "inspecting";
      const r = await sapi<PurchaseConfirmResult>("/api/v1/purchases/quick", {
        body: { kind: "purchase", lines: [{ lineType: "watch", ...watchBody({ ...w, initialStatus }), unitPrice: 0, rebuyUnitId: null }], costs: [] },
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
  const touch = () => { key.current = newIdempotencyKey(); };

  return (
    <>
      {guard.dialog}
      <PageHeader title="Thêm đồng hồ" description="Thêm một chiếc vào kho" />
      <RequirePerm perm="purchase.create">
        {result ? (
          <section className="g wf-pad" style={{ textAlign: "center" }}>
            {result.status === "confirmed" ? <StatusChip tone="ok">Đã vào kho</StatusChip> : <StatusChip tone="hold">Đã lưu, chờ xác nhận</StatusChip>}
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0" }}>{result.units?.[0]?.assetCode ?? result.code ?? "Đã lưu"}</h2>
            <p className="wf-mute">
              {w.listPrice ? `Giá niêm yết ${formatVnd(w.listPrice)}. ` : "Chưa có giá niêm yết — nhập ở trang chiếc khi cần. "}
              {w.condition !== "new" ? "Hàng cũ đang ở “Chờ kiểm tra”: chụp ảnh tình trạng rồi bấm “Kiểm tra đạt” để bán." : "In tem QR để dán lên chiếc."}
            </p>
            <div className="wf-dev-row" style={{ justifyContent: "center", marginTop: 12 }}>
              {result.units?.[0] && <Button variant="primary" href={`/dong-ho/${result.units[0].unitId}`}>Mở chiếc</Button>}
              {result.units?.[0] && <Button href={`/dong-ho/${result.units[0].unitId}/tem`}>In tem</Button>}
              <Button onClick={() => { setResult(null); setW(emptyWatch({ initialStatus: "in_stock", condition: "new" })); key.current = newIdempotencyKey(); }}>Thêm chiếc khác</Button>
              <Button href="/dong-ho">Về danh sách</Button>
            </div>
          </section>
        ) : (
          <form className="g wf-pad" onSubmit={submit} noValidate>
            <WatchFields locationRequired showStatus={false} value={w} onChange={(p) => { touch(); setW((x) => ({ ...x, ...p, ...(p.condition ? { initialStatus: p.condition === "new" ? "in_stock" : "inspecting" } : {}) })); }} />
            {w.condition !== "new" && <p className="wf-mute" style={{ fontSize: 13 }}>Hàng cũ vào kho ở trạng thái “Chờ kiểm tra”; sau khi chụp ảnh và kiểm tra đạt sẽ chuyển “Sẵn sàng bán”.</p>}
            {err && <p className="wf-fld-err" role="alert">{err}</p>}
            <Button type="submit" variant="primary" block guard loading={busy} disabled={missing.length > 0} aria-describedby={missing.length ? "wf-quick-missing" : undefined}>
              Thêm vào kho
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
