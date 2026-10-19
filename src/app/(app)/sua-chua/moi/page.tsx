"use client";
import { Check, Printer } from "lucide-react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Customer } from "@/components/catalog/types";
import { CustomerField, emptyCustomer, type CustomerValue } from "@/components/customers/CustomerField";
import { ImageUpload } from "@/components/lucian/ImageUpload";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";

type Warranty = { id: string; code: string; endDate: string; assetCode: string; serialNo: string | null; modelName: string };

// Nhận máy sửa (chỉ chủ): khách (tên + SĐT) → máy → lỗi → hẹn trả. Một trang, không cọc/thu tiền (CF-16).
export default function NewRepairPage() {
  const [cus, setCus] = useState<CustomerValue>(emptyCustomer());
  const [watchId, setWatchId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [warrantyId, setWarrantyId] = useState<string | null>(null);
  const [cond, setCond] = useState("");
  const [complaint, setComplaint] = useState("");
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ id: string; code?: string } | null>(null);
  const key = useRef(newIdempotencyKey());
  const full = useSWR<Customer>(cus.id ? `/api/v1/customers/${cus.id}` : null, swrFetcher);
  const wars = useSWR<{ items: Warranty[] }>(cus.id ? `/api/v1/warranties?customerId=${cus.id}` : null, swrFetcher);
  const touch = () => { key.current = newIdempotencyKey(); setErr(null); };
  const guard = useDirtyGuard(!res && (!!cus.id || !!cus.fullName.trim() || !!watchId || !!(brand.trim() || model.trim() || serial.trim() || cond.trim() || complaint.trim() || expected)));

  const hasWatch = !!watchId || !!(brand.trim() || model.trim() || serial.trim());
  const missing = [!cus.fullName.trim() && "họ tên khách", cus.phone.replace(/\D/g, "").length < 8 && "số điện thoại khách", !hasWatch && "thông tin đồng hồ", !complaint.trim() && "lỗi / yêu cầu"].filter(Boolean) as string[];

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setErrs({});
    try {
      const body = {
        ...(cus.id ? { customerId: cus.id } : { customer: { fullName: cus.fullName.trim(), phone: cus.phone } }),
        customerWatchId: watchId, brandText: watchId ? null : brand.trim() || null, modelText: watchId ? null : model.trim() || null, serialNo: watchId ? null : serial.trim() || null,
        intakeCondition: cond.trim() || null, complaint: complaint.trim(), expectedDate: expected || null, warrantyId,
      };
      setRes(await sapi<{ id: string; code?: string }>("/api/v1/repairs", { body, idempotencyKey: key.current }));
    } catch (e) {
      key.current = newIdempotencyKey();
      const f = fieldErrors(e);
      setErrs({ fullName: f["customer.fullName"] ?? "", phone: f["customer.phone"] ?? "" });
      setErr(Object.keys(f).length ? Object.values(f).join(" · ") : errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (res) {
    return (
      <>
        <PageHeader title="Nhận máy sửa" />
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
      </>
    );
  }

  return (
    <>
      {guard.dialog}
      <PageHeader title="Nhận máy sửa" description="Khách → máy → lỗi → hẹn trả" />
      <RequirePerm perm="repair.create">
        <div className="wf-stack">
          <section className="g wf-pad" aria-label="Khách hàng">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>1. Khách mang máy đến</h3>
            <CustomerField value={cus} onChange={(v) => { touch(); setCus(v); setWatchId(null); setWarrantyId(null); }} errors={errs} phoneRequired />
          </section>

          <section className="g wf-pad" aria-label="Đồng hồ cần sửa">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>2. Đồng hồ cần sửa</h3>
            {full.data?.watches && full.data.watches.length > 0 && (
              <>
                <p className="wf-fld-label">Đồng hồ khách đã có trong hồ sơ</p>
                <InsetList>{full.data.watches.map((w) => <InsetRow key={w.id} title={`${w.brandText ?? ""} ${w.modelText ?? ""}`.trim() || "Đồng hồ"} subtitle={w.serialNo ? `SN ${w.serialNo}` : "Không serial"} end={watchId === w.id ? "Đã chọn" : undefined} onClick={() => { touch(); setWatchId(watchId === w.id ? null : w.id); }} />)}</InsetList>
                <p className="wf-mute" style={{ margin: "10px 0" }}>Hoặc nhập máy mới:</p>
              </>
            )}
            <Field label="Thương hiệu"><TextInput disabled={!!watchId} value={brand} onChange={(e) => { touch(); setBrand(e.target.value); }} placeholder="Seiko, Casio, Rolex…" /></Field>
            <Field label="Loại / tên"><TextInput disabled={!!watchId} value={model} onChange={(e) => { touch(); setModel(e.target.value); }} /></Field>
            <Field label="Serial"><TextInput disabled={!!watchId} value={serial} onChange={(e) => { touch(); setSerial(e.target.value); }} autoComplete="off" /></Field>
            {wars.data && wars.data.items.length > 0 && (
              <>
                <p className="wf-fld-label" style={{ marginTop: 8 }}>Máy còn bảo hành của cửa hàng? Chọn để sửa miễn phí</p>
                <InsetList>{wars.data.items.map((w) => <InsetRow key={w.id} title={`${w.modelName} · ${w.assetCode}`} subtitle={`Bảo hành đến ${formatDateVn(w.endDate)}`} end={warrantyId === w.id ? "Miễn phí" : undefined} onClick={() => { touch(); setWarrantyId(warrantyId === w.id ? null : w.id); }} />)}</InsetList>
              </>
            )}
          </section>

          <section className="g wf-pad" aria-label="Tình trạng và lỗi">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Lỗi & hẹn trả</h3>
            <Field label="Lỗi / yêu cầu của khách" required error={errs.complaint}><Textarea rows={3} value={complaint} onChange={(e) => { touch(); setComplaint(e.target.value); }} placeholder="Ví dụ: chạy sai giờ, thay pin, đánh bóng vỏ…" /></Field>
            <Field label="Tình trạng lúc nhận (tùy chọn)" hint="Xước, móp, thiếu dây, ẩm…"><Textarea rows={2} value={cond} onChange={(e) => { touch(); setCond(e.target.value); }} /></Field>
            <Field label="Hẹn trả máy (tùy chọn)"><DateInput value={expected} onChange={(v) => { touch(); setExpected(v); }} /></Field>
          </section>

          {err && <p className="wf-fld-err" role="alert">{err}</p>}
          <Button variant="primary" block guard loading={busy} disabled={missing.length > 0} onClick={() => void submit()}>Nhận máy & lập phiếu</Button>
          {missing.length > 0 && <p className="wf-mute" style={{ textAlign: "center", fontSize: 13 }}>Còn thiếu: {missing.join(", ")}</p>}
        </div>
      </RequirePerm>
    </>
  );
}
