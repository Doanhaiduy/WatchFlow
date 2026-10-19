"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { UnitThumb } from "@/components/catalog/UnitArt";
import { unitTitle, type UnitDto } from "@/components/catalog/types";
import { CustomerField, emptyCustomer, type CustomerValue } from "@/components/customers/CustomerField";
import { UnitSearch } from "@/components/trade/UnitSearch";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, Textarea } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { api, newIdempotencyKey } from "@/lib/api-client";
import { todayVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";

type Line = { unit: UnitDto; price: number | null; warranty: string };
const WARRANTY = [{ value: "", label: "Mặc định (hàng mới 12 tháng, hàng cũ 3 tháng)" }, { value: "0", label: "Không bảo hành" }, { value: "1", label: "1 tháng" }, { value: "3", label: "3 tháng" }, { value: "6", label: "6 tháng" }, { value: "12", label: "12 tháng" }, { value: "24", label: "24 tháng" }];

// Ghi đơn bán (CF-13): chọn chiếc → nhập khách → giá và ngày → Lưu. Không thanh toán/nợ/giảm giá/thu cũ.
export default function RecordSalePage() {
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<CustomerValue>(emptyCustomer());
  const [docDate, setDocDate] = useState(todayVn());
  const [note, setNote] = useState("");
  const [backdateReason, setBackdateReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const key = useRef(newIdempotencyKey());
  const done = useRef(false);

  // /ban-hang/moi?chiec=<id>: mở sẵn với một chiếc (nút "Bán chiếc này" ở trang đồng hồ)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("chiec");
    if (!id) return;
    void api<UnitDto>(`/api/v1/catalog/units/${id}`, { noRedirect: true })
      .then((u) => u.status === "in_stock" && setLines((ls) => (ls.some((l) => l.unit.id === u.id) ? ls : [...ls, { unit: u, price: u.effectivePrice || null, warranty: "" }])))
      .catch(() => undefined);
  }, []);

  const dirty = !done.current && (lines.length > 0 || !!customer.fullName.trim() || !!customer.phone || !!note.trim());
  const guard = useDirtyGuard(dirty);
  const total = useMemo(() => lines.reduce((a, l) => a + (l.price ?? 0), 0), [lines]);
  const daysBack = useMemo(() => Math.round((Date.parse(todayVn()) - Date.parse(docDate)) / 86_400_000), [docDate]);
  const missing = [lines.length === 0 && "chọn chiếc đã bán", lines.some((l) => l.price === null) && "giá bán từng chiếc", !customer.fullName.trim() && "họ tên khách", !docDate && "ngày bán"].filter(Boolean) as string[];
  const touch = () => { key.current = newIdempotencyKey(); setErr(null); };

  const submit = async () => {
    if (busy || missing.length) return;
    setBusy(true);
    setErr(null);
    setErrs({});
    try {
      const body = {
        ...(customer.id ? { customerId: customer.id } : { customer: { fullName: customer.fullName.trim(), phone: customer.phone || null } }),
        docDate,
        backdateReason: backdateReason.trim() || null,
        note: note.trim() || null,
        lines: lines.map((l) => ({ unitId: l.unit.id, price: l.price ?? 0, warrantyMonths: l.warranty === "" ? null : Number(l.warranty) })),
      };
      const r = await sapi<{ id: string; code: string }>("/api/v1/sales", { body, idempotencyKey: key.current });
      done.current = true;
      toast.success(`Đã ghi đơn ${r.code}`);
      router.replace(`/ban-hang/${r.id}`);
    } catch (x) {
      key.current = newIdempotencyKey();
      const f = fieldErrors(x);
      setErrs(f);
      setErr(Object.keys(f).length ? Object.values(f).join(" · ") : errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {guard.dialog}
      <PageHeader title="Ghi đơn bán" description="Khách mua chiếc nào, giá bao nhiêu — lưu lại để tra cứu" />
      <RequirePerm perm="sale.confirm">
        <div className="wf-stack">
          <section className="g wf-pad" aria-label="Chiếc đã bán">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>1. Chiếc khách mua</h3>
            {lines.length > 0 && (
              <InsetList label="Chiếc đã chọn">
                {lines.map((l) => (
                  <InsetRow key={l.unit.id} wrap thumb={<UnitThumb u={l.unit} />} title={unitTitle(l.unit)} subtitle={`${l.unit.assetCode}${l.unit.serialNo ? ` · ${l.unit.serialNo}` : ""} · niêm yết ${formatVnd(l.unit.effectivePrice)}`}
                    end={<Button sm iconOnly aria-label={`Bỏ ${l.unit.assetCode}`} onClick={() => { touch(); setLines((ls) => ls.filter((x) => x.unit.id !== l.unit.id)); }}><Trash2 size={16} aria-hidden="true" /></Button>} />
                ))}
              </InsetList>
            )}
            {lines.map((l) => (
              <div key={l.unit.id} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
                <Field label={`Giá bán ${l.unit.assetCode}`} required hint={l.price !== null && l.price !== l.unit.effectivePrice ? `Khác giá niêm yết ${formatVnd(l.unit.effectivePrice)}` : undefined}>
                  <MoneyInput value={l.price} onChange={(v) => { touch(); setLines((ls) => ls.map((x) => (x.unit.id === l.unit.id ? { ...x, price: v } : x))); }} />
                </Field>
                <Field label={`Bảo hành ${l.unit.assetCode}`}>
                  <Select value={l.warranty} onChange={(e) => { touch(); setLines((ls) => ls.map((x) => (x.unit.id === l.unit.id ? { ...x, warranty: e.target.value } : x))); }} options={WARRANTY} />
                </Field>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <UnitSearch exclude={lines.map((l) => l.unit.id)} placeholder={lines.length ? "Thêm chiếc khác…" : "Tìm mã nội bộ, serial, tên đồng hồ… hoặc quét QR"} onPick={(u) => { touch(); setLines((ls) => [...ls, { unit: u, price: u.effectivePrice || null, warranty: "" }]); }} />
            </div>
          </section>

          <section className="g wf-pad" aria-label="Khách hàng">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>2. Khách mua</h3>
            <CustomerField value={customer} onChange={(v) => { touch(); setCustomer(v); }} errors={errs} />
          </section>

          <section className="g wf-pad" aria-label="Ngày và ghi chú">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Ngày bán & ghi chú</h3>
            <Field label="Ngày bán" required error={errs.docDate}><DateInput value={docDate} max={todayVn()} clearable={false} onChange={(v) => { touch(); setDocDate(v); }} /></Field>
            {daysBack > 7 && (
              <Field label="Lý do ghi lùi ngày" hint="Chỉ người có quyền ghi lùi mới lưu được đơn quá 7 ngày">
                <Textarea rows={2} value={backdateReason} onChange={(e) => { touch(); setBackdateReason(e.target.value); }} />
              </Field>
            )}
            <Field label="Ghi chú (tùy chọn)"><Textarea rows={2} value={note} maxLength={1000} onChange={(e) => { touch(); setNote(e.target.value); }} placeholder="Ví dụ: khách hẹn lấy dây da, tặng kèm hộp…" /></Field>
          </section>

          {err && <p className="wf-fld-err" role="alert">{err}</p>}
          <Button variant="primary" block guard loading={busy} disabled={missing.length > 0} onClick={() => void submit()}>
            Lưu đơn{lines.length > 0 ? ` · ${formatVnd(total)}` : ""}
          </Button>
          {missing.length > 0 && <p className="wf-mute" style={{ textAlign: "center", fontSize: 13 }}>Còn thiếu: {missing.join(", ")}</p>}
        </div>
      </RequirePerm>
    </>
  );
}
