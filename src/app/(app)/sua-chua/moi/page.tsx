"use client";
import { Check, Printer } from "lucide-react";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { unitTitle, type Customer, type UnitDto } from "@/components/catalog/types";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { ImageUpload } from "@/components/lucian/ImageUpload";
import { WizardSteps } from "@/components/lucian/WizardSteps";
import { UnitSearch } from "@/components/trade/UnitSearch";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { TransferQr } from "@/components/payments/TransferQr";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DateInput } from "@/components/ui/DateInput";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";

const STEPS = ["Khách", "Máy", "Tình trạng & lỗi", "Cọc", "Nhận máy"];
const HINTS = ["Chọn hoặc tạo khách hàng để tiếp tục.", "Chọn máy cần sửa (trong hồ sơ khách hoặc nhập thương hiệu/loại/serial).", "Nhập lỗi hoặc yêu cầu của khách để tiếp tục."];

function Wizard() {
  const sp = useSearchParams();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"customer" | "internal">("customer");
  const [cus, setCus] = useState<PickedCustomer | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [unit, setUnit] = useState<UnitDto | null>(null);
  const [cond, setCond] = useState("");
  const [complaint, setComplaint] = useState("");
  const [expected, setExpected] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [deposit, setDeposit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ id: string; code?: string } | null>(null);
  const key = useRef(newIdempotencyKey());
  const full = useSWR<Customer>(cus ? `/api/v1/customers/${cus.id}` : null, swrFetcher);
  const touch = () => { key.current = newIdempotencyKey(); };
  void sp;
  // Đã chọn/nhập gì mà chưa nhận máy ⇒ rời trang sẽ hỏi "Bỏ thay đổi chưa lưu?"
  const guard = useDirtyGuard(!res && (!!cus || !!unit || !!watchId || !!(brand.trim() || model.trim() || serial.trim() || cond.trim() || complaint.trim() || expected) || deposit !== null));

  const internal = kind === "internal";
  const canNext = [internal || !!cus, internal ? !!unit : !!watchId || !!(brand.trim() || model.trim() || serial.trim()), !!complaint.trim(), true, true][step] ?? false;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        kind, customerId: internal ? null : (cus?.id ?? null), customerWatchId: internal ? null : watchId,
        brandText: !internal && !watchId ? brand.trim() || null : null, modelText: !internal && !watchId ? model.trim() || null : null, serialNo: !internal && !watchId ? serial.trim() || null : null,
        unitId: internal ? (unit?.id ?? null) : null, intakeCondition: cond.trim() || null, complaint: complaint.trim() || null, expectedDate: expected || null,
        deposit: !internal && deposit ? { method, amount: deposit } : null,
      };
      const r = await sapi<{ id: string; code?: string }>("/api/v1/repairs", { body, idempotencyKey: key.current });
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
      <div className="wf-stack">
        <section className="g wf-pad" style={{ textAlign: "center" }}>
          <span className="wf-ib" data-tone="ok" style={{ margin: "0 auto 8px", width: 56, height: 56, borderRadius: 20 }}><Check size={28} aria-hidden="true" /></span>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Đã nhận máy {res.code ?? ""}</h2>
          <p className="wf-mute">In phiếu nhận cho khách và chụp ảnh máy (tùy chọn).</p>
          <div className="wf-dev-row" style={{ justifyContent: "center", marginTop: 10 }}>
            <Button variant="primary" href={`/sua-chua/${res.id}/in?loai=nhan`} icon={<Printer size={16} aria-hidden="true" />}>In phiếu nhận</Button>
            <Button href={`/sua-chua/${res.id}`}>Mở phiếu</Button>
          </div>
        </section>
        <section className="g wf-pad" aria-label="Ảnh máy lúc nhận">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Ảnh máy lúc nhận (tùy chọn)</h3>
          <ImageUpload kind="intake" entityTable="repair_orders" entityId={res.id} onUploaded={() => undefined} />
        </section>
      </div>
    );
  }

  return (
    <div className="wf-stack">
      <WizardSteps steps={STEPS} current={step} onStep={setStep} label="Các bước nhận máy" />
      {step === 0 && (
        <section className="g wf-pad">
          <SegmentedControl ariaLabel="Loại máy" value={kind} onChange={(v) => { touch(); setKind(v); setUnit(null); }} options={[{ value: "customer", label: "Máy của khách" }, { value: "internal", label: "Máy của cửa hàng" }]} />
          <div style={{ marginTop: 14 }}>
            {internal ? <p className="wf-mute">Sửa nội bộ: chọn chiếc của cửa hàng ở bước sau; chi phí sửa được cộng vào giá vốn khi hoàn thành.</p> : <CustomerPicker value={cus} onChange={(c) => { touch(); setCus(c); setWatchId(null); }} />}
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="g wf-pad">
          {internal ? (
            unit ? (
              <div className="wf-dev-row" style={{ justifyContent: "space-between" }}><span><b>{unitTitle(unit)}</b><br /><span className="wf-mute">{unit.assetCode}</span></span><Button sm onClick={() => setUnit(null)}>Đổi</Button></div>
            ) : (
              <><p className="wf-fld-label">Chọn chiếc cần sửa</p><UnitSearch onPick={(u) => { touch(); setUnit(u); }} status="in_stock,inspecting" /></>
            )
          ) : (
            <>
              {full.data?.watches && full.data.watches.length > 0 && (
                <>
                  <p className="wf-fld-label">Đồng hồ khách đã có trong hồ sơ</p>
                  <InsetList>{full.data.watches.map((w) => <InsetRow key={w.id} title={`${w.brandText ?? ""} ${w.modelText ?? ""}`.trim() || "Đồng hồ"} subtitle={w.serialNo ? `SN ${w.serialNo}` : "Không serial"} end={watchId === w.id ? "Đã chọn" : undefined} onClick={() => { touch(); setWatchId(watchId === w.id ? null : w.id); }} />)}</InsetList>
                  <p className="wf-mute" style={{ margin: "10px 0" }}>Hoặc nhập máy mới:</p>
                </>
              )}
              <Field label="Thương hiệu"><TextInput disabled={!!watchId} value={brand} onChange={(e) => { touch(); setBrand(e.target.value); }} /></Field>
              <Field label="Loại / tên"><TextInput disabled={!!watchId} value={model} onChange={(e) => { touch(); setModel(e.target.value); }} /></Field>
              <Field label="Serial"><TextInput disabled={!!watchId} value={serial} onChange={(e) => { touch(); setSerial(e.target.value); }} autoComplete="off" /></Field>
            </>
          )}
        </section>
      )}
      {step === 2 && (
        <section className="g wf-pad">
          <Field label="Tình trạng lúc nhận" hint="Xước, móp, thiếu dây, ẩm…"><Textarea rows={3} value={cond} onChange={(e) => { touch(); setCond(e.target.value); }} /></Field>
          <Field label="Lỗi / yêu cầu của khách" required><Textarea rows={3} value={complaint} onChange={(e) => { touch(); setComplaint(e.target.value); }} /></Field>
          <Field label="Hẹn trả máy"><DateInput value={expected} onChange={(v) => setExpected(v)} /></Field>
        </section>
      )}
      {step === 3 && (
        <section className="g wf-pad">
          {internal ? <p className="wf-mute">Sửa nội bộ không nhận cọc.</p> : (
            <>
              <p className="wf-mute" style={{ marginBottom: 8 }}>Tiền cọc nhận trước (tùy chọn).</p>
              <SegmentedControl ariaLabel="Hình thức nhận cọc" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} />
              <div style={{ height: 10 }} />
              <Field label="Số tiền cọc"><MoneyInput value={deposit} onChange={(v) => { touch(); setDeposit(v); }} quickAdds={[200_000, 500_000, 1_000_000]} /></Field>
              {method === "bank_transfer" && !!deposit && <TransferQr amount={deposit} fallbackRef={`COC SC ${cus?.fullName ?? ""}`} />}
            </>
          )}
        </section>
      )}
      {step === 4 && (
        <section className="g wf-pad">
          <KeyValue items={[
            { label: "Loại", value: internal ? "Sửa nội bộ (máy cửa hàng)" : "Máy của khách" },
            { label: "Khách", value: internal ? "—" : (cus?.fullName ?? "—") },
            { label: "Máy", value: internal ? (unit ? `${unitTitle(unit)} · ${unit.assetCode}` : "—") : watchId ? "Đồng hồ trong hồ sơ khách" : [brand, model, serial && `SN ${serial}`].filter(Boolean).join(" ") || "—" },
            { label: "Lỗi", value: complaint || "—" },
            { label: "Hẹn trả", value: expected ? formatDateVn(expected) : "—" },
            { label: "Cọc", value: deposit && !internal ? formatVnd(deposit) : "Không" },
          ]} />
          {err && <p className="wf-fld-err" role="alert">{err}</p>}
        </section>
      )}
      {guard.dialog}
      {step < 4 && !canNext && <p className="wf-mute" role="status" style={{ margin: "0 6px", fontSize: 12.5 }}>{HINTS[step]}</p>}
      <div className="wf-sticky-save g">
        <Button disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Quay lại</Button>
        {step < 4 ? <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Tiếp</Button> : <Button variant="primary" guard loading={busy} onClick={() => void submit()}>Nhận máy & lập phiếu</Button>}
      </div>
    </div>
  );
}

export default function NewRepairPage() {
  return (
    <>
      <PageHeader title="Nhận máy sửa" description="Khách → Máy → Tình trạng & lỗi → Cọc" />
      <RequirePerm perm="repair.create"><Suspense fallback={null}><Wizard /></Suspense></RequirePerm>
    </>
  );
}
