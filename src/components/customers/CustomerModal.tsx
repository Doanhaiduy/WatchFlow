"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { ApiClientError, api, newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { errMsg, fieldErrors, sapi } from "../auth/helpers";
import type { Customer, CustomerGroup } from "../catalog/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal, ModalClose } from "../ui/Modal";
import { normalizePhone, PhoneInput } from "../ui/PhoneInput";
import { Select, Textarea, TextInput } from "../ui/TextInput";
import { useToast } from "../ui/Toast";

type Dup = { id: string; fullName: string; code: string };

/**
 * Tạo nhanh / sửa khách (BottomSheet). Trùng SĐT ⇒ API trả 409 WF-CUS-PHONE-DUPLICATE (errors[].message là id khách trùng):
 * hiện khách đó cho chọn "Mở khách đó" hoặc "Vẫn tạo" (gửi lại với force=true).
 */
export function CustomerModal({ customer, open, onClose, onDone }: { customer: Customer | null; open: boolean; onClose: () => void; onDone: (id?: string) => Promise<unknown> | void }) {
  const toast = useToast();
  const groups = useSWR<{ items: CustomerGroup[] }>(open ? "/api/v1/customer-groups" : null, swrFetcher);
  const [f, setF] = useState({ fullName: "", email: "", address: "", groupId: "", note: "", idNumber: "" });
  const [phone, setPhone] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [dups, setDups] = useState<Dup[]>([]);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setF({ fullName: customer?.fullName ?? "", email: customer?.email ?? "", address: customer?.address ?? "", groupId: customer?.groupId ?? "", note: customer?.note ?? "", idNumber: "" });
    setPhone(normalizePhone(customer?.phone ?? ""));
    setErrs({});
    setDups([]);
    setKey(newIdempotencyKey());
  }, [open, customer]);
  // Đã sửa so với lúc mở (khách mới: có nhập gì là tính) ⇒ đóng sẽ hỏi "Bỏ thay đổi chưa lưu?"
  const dirty = open && (f.fullName !== (customer?.fullName ?? "") || f.email !== (customer?.email ?? "") || f.address !== (customer?.address ?? "") || f.groupId !== (customer?.groupId ?? "") || f.note !== (customer?.note ?? "") || f.idNumber !== "" || phone !== normalizePhone(customer?.phone ?? ""));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (force = false) => {
    setBusy(true);
    setErrs({});
    const body = {
      fullName: f.fullName, phone: phone || null, email: f.email.trim() || null, address: f.address.trim() || null, groupId: f.groupId || null, note: f.note.trim() || null,
      ...(f.idNumber.trim() ? { idNumber: f.idNumber.trim() } : {}), ...(force ? { force: true } : {}),
    };
    try {
      let id = customer?.id;
      if (customer) await sapi(`/api/v1/customers/${customer.id}`, { method: "PATCH", ifMatch: customer.version, body });
      else id = (await sapi<{ id: string }>("/api/v1/customers", { body, idempotencyKey: key })).id;
      toast.success(customer ? "Đã lưu khách hàng" : "Đã thêm khách hàng");
      await onDone(id);
    } catch (x) {
      if (x instanceof ApiClientError && x.code === "WF-CUS-PHONE-DUPLICATE") {
        const ids = [...new Set((x.errors ?? []).map((e) => e.message))];
        const found = await Promise.all(ids.map((i) => api<Customer>(`/api/v1/customers/${i}`, { noRedirect: true }).then((c): Dup => ({ id: c.id, fullName: c.fullName, code: c.code })).catch((): Dup => ({ id: i, fullName: "Khách đã có", code: "" }))));
        setDups(found);
      } else {
        const er = fieldErrors(x);
        setErrs(Object.keys(er).length ? er : { form: errMsg(x) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} dirty={dirty} busy={busy} title={customer ? "Sửa khách hàng" : "Thêm khách hàng"}>
      {dups.length > 0 && (
        <div className="wf-lock" role="alert" style={{ display: "block", marginBottom: 12 }}>
          <b>Số điện thoại này đã có khách:</b>
          <ul style={{ margin: "6px 0", paddingLeft: 18, listStyle: "disc" }}>
            {dups.map((d) => (
              <li key={d.id}>
                {d.fullName}
                {d.code ? ` (${d.code})` : ""} —{" "}
                <Link href={`/khach-hang/${d.id}`} onClick={onClose} style={{ color: "var(--wf-accent)", fontWeight: 700 }}>
                  Mở khách đó
                </Link>
              </li>
            ))}
          </ul>
          <Button sm loading={busy} onClick={() => void submit(true)}>Vẫn tạo khách mới</Button>
        </div>
      )}
      <form onSubmit={(e: FormEvent) => (e.preventDefault(), void submit())} noValidate>
        <Field label="Họ tên" required error={errs.fullName}><TextInput data-autofocus value={f.fullName} onChange={set("fullName")} autoComplete="off" /></Field>
        <Field label="Số điện thoại" error={errs.phone}><PhoneInput value={phone} onChange={(v) => { setPhone(v); setDups([]); }} /></Field>
        <Field label="Email" error={errs.email}><TextInput type="email" inputMode="email" autoCapitalize="none" value={f.email} onChange={set("email")} /></Field>
        <Field label="Nhóm khách" error={errs.groupId}><Select placeholder="Không thuộc nhóm" value={f.groupId} onChange={set("groupId")} options={(groups.data?.items ?? []).filter((g) => g.isActive).map((g) => ({ value: g.id, label: g.name }))} /></Field>
        <Field label="Địa chỉ" error={errs.address}><TextInput value={f.address} onChange={set("address")} /></Field>
        <Field label={customer?.hasIdNumber ? "CCCD/giấy tờ (để trống nếu không đổi)" : "CCCD/giấy tờ (tùy chọn)"} hint="Lưu mã hóa; chỉ người có quyền mới xem được đầy đủ" error={errs.idNumber}>
          <TextInput value={f.idNumber} onChange={set("idNumber")} autoComplete="off" inputMode="text" />
        </Field>
        <Field label="Ghi chú" error={errs.note}><Textarea rows={2} value={f.note} onChange={set("note")} /></Field>
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <ModalClose disabled={busy}>Hủy</ModalClose>
          <Button type="submit" variant="primary" loading={busy && dups.length === 0} disabled={!f.fullName.trim() || dups.length > 0}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}
