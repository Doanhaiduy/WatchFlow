"use client";
import { Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import type { Customer } from "../catalog/types";
import { useDebounced } from "../trade/useDebounced";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { InsetList, InsetRow } from "../ui/InsetList";
import { PhoneInput } from "../ui/PhoneInput";
import { TextInput } from "../ui/TextInput";

/** Khách của đơn: chọn người đã có (id) hoặc nhập mới (tên + SĐT — máy chủ dùng lại khách trùng SĐT, chưa có thì tạo). */
export type CustomerValue = { id: string | null; fullName: string; phone: string };
export const emptyCustomer = (): CustomerValue => ({ id: null, fullName: "", phone: "" });

/**
 * Hai cách, cùng một khối: gõ tìm khách đã có (tên/SĐT) rồi bấm chọn, hoặc nhập thẳng họ tên + SĐT khách mới. Không mở hộp thoại phụ.
 * `phoneRequired`: bắt buộc SĐT (mặc định không — đơn bán chỉ bắt buộc họ tên).
 */
export function CustomerField({ value, onChange, errors = {}, phoneRequired }: { value: CustomerValue; onChange: (v: CustomerValue) => void; errors?: Record<string, string>; phoneRequired?: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const res = useSWR<{ items: Customer[] }>(!value.id && dq.length >= 2 ? `/api/v1/customers?pageSize=5&q=${encodeURIComponent(dq)}&active=1` : null, swrFetcher, { keepPreviousData: true });

  if (value.id) {
    return (
      <div className="g g-flat" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 20 }}>
        <span className="wf-ib" data-tone="info" style={{ width: 40, height: 40 }} aria-hidden="true"><UserRound size={18} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block" }}>{value.fullName}</b>
          <span className="wf-mute" style={{ fontSize: 12 }}>{value.phone || "Chưa có SĐT"}</span>
        </span>
        <Button sm iconOnly aria-label="Đổi khách" onClick={() => onChange(emptyCustomer())}><X size={16} aria-hidden="true" /></Button>
      </div>
    );
  }
  return (
    <div className="wf-stack">
      <div>
        <label className="wf-fld-label" htmlFor="cus-find">Khách đã mua trước đây? Tìm tên hoặc SĐT</label>
        <TextInput id="cus-find" type="search" enterKeyHint="search" icon={<Search size={18} />} placeholder="Gõ tên hoặc số điện thoại…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {dq.length >= 2 && res.data && (
          res.data.items.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <InsetList label="Khách tìm được">
                {res.data.items.map((c) => (
                  <InsetRow key={c.id} icon={<UserRound size={18} />} tone="info" title={c.fullName} subtitle={c.phone ?? c.code} onClick={() => { onChange({ id: c.id, fullName: c.fullName, phone: c.phone ?? "" }); setQ(""); }} />
                ))}
              </InsetList>
            </div>
          ) : <p className="wf-mute" style={{ marginTop: 6 }}>Chưa có khách “{dq}” — nhập khách mới ở dưới.</p>
        )}
      </div>
      <Field label="Họ tên khách" required error={errors.fullName}>
        <TextInput value={value.fullName} onChange={(e) => onChange({ ...value, fullName: e.target.value })} autoComplete="off" placeholder="Nguyễn Văn A" />
      </Field>
      <Field label="Số điện thoại" required={phoneRequired} error={errors.phone} hint="Để tra cứu lại và gọi khi cần bảo hành">
        <PhoneInput value={value.phone} onChange={(v) => onChange({ ...value, phone: v })} />
      </Field>
    </div>
  );
}
