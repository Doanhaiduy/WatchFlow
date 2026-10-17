"use client";
import { useEffect, useRef, useState } from "react";
import { errMsg, sapi } from "../auth/helpers";
import { unitTitle, type UnitDto } from "../catalog/types";
import { CustomerPicker, type PickedCustomer } from "../customers/CustomerPicker";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal, ModalClose } from "../ui/Modal";
import { TransferQr } from "../payments/TransferQr";
import { MoneyInput } from "../ui/MoneyInput";
import { SegmentedControl } from "../ui/SegmentedControl";
import { DateInput } from "../ui/DateInput";
import { TextInput } from "../ui/TextInput";
import { useToast } from "../ui/Toast";
import { UnitSearch } from "./UnitSearch";
import { newIdempotencyKey } from "@/lib/api-client";
import { addDays, todayVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";

type Props = { open: boolean; onClose: () => void; onDone: (id: string) => void | Promise<unknown>; unit?: UnitDto | null; customer?: PickedCustomer | null };

/** Giữ hàng + nhận cọc (BR-RSV-01/02). Mức cọc tối thiểu do máy chủ kiểm (WF-RSV-DEPOSIT-TOO-LOW). */
export function ReservationModal({ open, onClose, onDone, unit: unit0, customer: cus0 }: Props) {
  const toast = useToast();
  const [unit, setUnit] = useState<UnitDto | null>(unit0 ?? null);
  const [cus, setCus] = useState<PickedCustomer | null>(cus0 ?? null);
  const [until, setUntil] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [deposit, setDeposit] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  useEffect(() => {
    if (open) {
      setUnit(unit0 ?? null); setCus(cus0 ?? null); setUntil(""); setMethod("cash"); setDeposit(null); setNote(""); setErr(null);
      key.current = newIdempotencyKey();
    }
  }, [open, unit0, cus0]);

  // Có chọn/nhập gì ngoài giá trị khởi tạo ⇒ đóng sẽ hỏi "Bỏ thay đổi chưa lưu?"
  const dirty = open && (unit?.id !== unit0?.id || cus?.id !== cus0?.id || !!until || deposit !== null || !!note.trim() || method !== "cash");
  const submit = async () => {
    if (!unit || !cus || !deposit) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<{ id: string; code: string }>("/api/v1/reservations", {
        body: { unitId: unit.id, customerId: cus.id, holdUntil: until || null, method, deposit, note: note.trim() || null, ...(method === "cash" ? { cashTendered: null } : {}) },
        idempotencyKey: key.current,
      });
      toast.success(`Đã giữ hàng ${r.code}`, `Cọc ${formatVnd(deposit)}`);
      await onDone(r.id);
    } catch (x) {
      key.current = newIdempotencyKey();
      const m = errMsg(x); // WF-RSV-DEPOSIT-TOO-LOW… do máy chủ nêu cụ thể
      setErr(m);
      toast.error("Không giữ được hàng", m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dirty={dirty}
      busy={busy}
      title="Giữ hàng / đặt cọc"
      footer={<><ModalClose disabled={busy}>Hủy</ModalClose><Button variant="primary" guard loading={busy} disabled={!unit || !cus || !deposit} onClick={() => void submit()}>Giữ hàng</Button></>}
    >
      {unit ? (
        <div className="g g-flat" style={{ padding: "12px 16px", borderRadius: 20, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span><b style={{ display: "block" }}>{unitTitle(unit)}</b><span className="wf-mute" style={{ fontSize: 12 }}>{unit.assetCode}</span></span>
          <span style={{ textAlign: "right" }}><b>{formatVnd(unit.effectivePrice)}</b>{!unit0 && <><br /><button type="button" className="wf-mute" style={{ fontSize: 12, textDecoration: "underline" }} onClick={() => setUnit(null)}>Đổi chiếc</button></>}</span>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p className="wf-fld-label">Chọn chiếc cần giữ</p>
          <UnitSearch onPick={setUnit} />
        </div>
      )}
      <CustomerPicker value={cus} onChange={setCus} />
      <div style={{ height: 12 }} />
      <Field label="Giữ đến ngày" hint="Để trống = theo cài đặt (hạn giữ mặc định)"><DateInput value={until} min={addDays(todayVn(), 1)} onChange={(v) => setUntil(v)} /></Field>
      <Field label="Hình thức nhận cọc"><SegmentedControl ariaLabel="Hình thức nhận cọc" value={method} onChange={setMethod} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank_transfer", label: "Chuyển khoản" }]} /></Field>
      <Field label="Số tiền cọc" required hint={unit ? `Giá hiện tại ${formatVnd(unit.effectivePrice)}; cọc tối thiểu theo cài đặt của cửa hàng` : undefined}>
        <MoneyInput value={deposit} onChange={setDeposit} quickAdds={[500_000, 1_000_000, 5_000_000]} />
      </Field>
      {method === "bank_transfer" && !!deposit && <TransferQr amount={deposit} fallbackRef={`COC ${unit?.assetCode ?? "GIU HANG"}`} />}
      <Field label="Ghi chú"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      {(!unit || !cus || !deposit) && <p className="wf-mute" role="status" style={{ fontSize: 13 }}>Còn thiếu: {[!unit && "chiếc cần giữ", !cus && "khách", !deposit && "số tiền cọc"].filter(Boolean).join(", ")}.</p>}
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}
