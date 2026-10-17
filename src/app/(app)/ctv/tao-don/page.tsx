"use client";
import { Check, Trash2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import type { CollabUnit } from "@/components/collab/types";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextInput } from "@/components/ui/TextInput";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";

type L = { u: CollabUnit; price: number | null };

function View() {
  const sp = useSearchParams();
  const units = useSWR<{ items: CollabUnit[] }>("/api/v1/collab/me/units", swrFetcher);
  const [lines, setLines] = useState<L[]>([]);
  const [cus, setCus] = useState<PickedCustomer | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const key = useRef(newIdempotencyKey());
  const pre = useRef(false);
  useEffect(() => {
    const id = sp.get("unit");
    if (!pre.current && id && units.data) {
      pre.current = true;
      const u = units.data.items.find((x) => x.id === id);
      if (u) setLines([{ u, price: u.listPrice }]);
    }
  }, [sp, units.data]);
  const touch = () => { key.current = newIdempotencyKey(); };
  const avail = (units.data?.items ?? []).filter((u) => !lines.some((l) => l.u.id === u.id));

  const submit = async () => {
    if (!cus) return;
    setBusy(true);
    setErr(null);
    try {
      await sapi("/api/v1/collab/me/sales", { body: { customerId: cus.id, note: note.trim() || null, lines: lines.map((l) => ({ unitId: l.u.id, unitPrice: l.price ?? 0 })) }, idempotencyKey: key.current });
      setDone(true);
    } catch (e) {
      key.current = newIdempotencyKey();
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="g wf-pad" style={{ textAlign: "center" }}>
        <span className="wf-ib" data-tone="ok" style={{ margin: "0 auto 8px", width: 56, height: 56, borderRadius: 20 }}><Check size={28} aria-hidden="true" /></span>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Đã gửi đơn chờ xác nhận</h2>
        <p className="wf-mute">Cửa hàng sẽ xác nhận đơn. Bạn theo dõi ở “Đơn của tôi”.</p>
        <div className="wf-dev-row" style={{ justifyContent: "center", marginTop: 12 }}><Button variant="primary" href="/ctv/don">Đơn của tôi</Button><Button href="/ctv">Về hàng đang giữ</Button></div>
      </section>
    );
  }
  return (
    <div className="wf-stack">
      <section aria-label="Chọn chiếc">
        <div className="wf-sec"><h3>1. Chọn chiếc đã bán</h3></div>
        {units.data && avail.length === 0 && lines.length === 0 ? <div className="g wf-pad"><p className="wf-mute">Bạn chưa có chiếc nào đang giữ.</p></div> : units.data && avail.length === 0 ? <p className="wf-mute" style={{ margin: "0 6px" }}>Đã chọn hết các chiếc đang giữ.</p> : (
          <InsetList label="Chiếc đang giữ">
            {avail.map((u) => <InsetRow key={u.id} onClick={() => { touch(); setLines((a) => [...a, { u, price: u.listPrice }]); }} title={joinTitle(u.brandName, u.modelName)} subtitle={`${u.assetCode} · giá thu ${formatVnd(u.basePrice)}`} end={formatVnd(u.listPrice)} endSub="niêm yết" />)}
          </InsetList>
        )}
      </section>
      {lines.length > 0 && (
        <section className="wf-stack" aria-label="Giá bán thực">
          <div className="wf-sec"><h3>2. Giá bán thực</h3></div>
          {lines.map((l) => (
            <div key={l.u.id} className="g wf-pad">
              <div className="wf-dev-row" style={{ justifyContent: "space-between" }}>
                <span><b style={{ display: "block" }}>{joinTitle(l.u.brandName, l.u.modelName)}</b><span className="wf-mute" style={{ fontSize: 12 }}>{l.u.assetCode} · giá thu {formatVnd(l.u.basePrice)}</span></span>
                <Button sm iconOnly aria-label="Bỏ chiếc" onClick={() => { touch(); setLines((a) => a.filter((x) => x.u.id !== l.u.id)); }}><Trash2 size={16} aria-hidden="true" /></Button>
              </div>
              <Field label="Giá bán cho khách" required><MoneyInput value={l.price} onChange={(v) => { touch(); setLines((a) => a.map((x) => (x.u.id === l.u.id ? { ...x, price: v } : x))); }} /></Field>
              {l.price !== null && l.price >= l.u.basePrice && <p className="wf-mute" role="status" style={{ marginTop: 6, fontSize: 12.5 }}>Phần bạn hưởng: <b style={{ color: "var(--wf-ink)" }}>{formatVnd(l.price - l.u.basePrice)}</b> (giá bán − giá thu)</p>}
              {l.price !== null && l.price < l.u.basePrice && <p className="wf-fld-err" role="status">Giá bán thấp hơn giá thu {formatVnd(l.u.basePrice)} — bạn sẽ phải bù phần chênh khi nộp.</p>}
            </div>
          ))}
        </section>
      )}
      {lines.length > 0 && (
        <section className="g wf-pad" aria-label="Khách hàng">
          <div className="wf-sec" style={{ margin: "0 0 8px" }}><h3>3. Khách mua</h3></div>
          <CustomerPicker value={cus} onChange={(c) => { touch(); setCus(c); }} />
          <div style={{ height: 12 }} />
          <Field label="Ghi chú"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          {err && <p className="wf-fld-err" role="alert">{err}</p>}
          {(!cus || lines.some((l) => l.price === null)) && <p className="wf-mute" role="status" style={{ marginBottom: 10, fontSize: 12.5 }}>{lines.some((l) => l.price === null) ? "Nhập giá bán cho từng chiếc." : "Chọn hoặc tạo khách mua để gửi đơn."}</p>}
          <Button variant="primary" block loading={busy} disabled={!cus || lines.some((l) => l.price === null)} onClick={() => void submit()}>Gửi chờ xác nhận</Button>
        </section>
      )}
    </div>
  );
}

export default function CtvNewOrderPage() {
  return (
    <>
      <PageHeader title="Tạo đơn bán" description="Chọn chiếc, giá bán thực, khách mua" />
      <RequirePerm perm="collab.view_own"><Suspense fallback={null}><View /></Suspense></RequirePerm>
    </>
  );
}
