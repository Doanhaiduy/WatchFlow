"use client";
import { Plus, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";
import type { Customer } from "../catalog/types";
import { Button } from "../ui/Button";
import { InsetList, InsetRow } from "../ui/InsetList";
import { TextInput } from "../ui/TextInput";
import { CustomerModal } from "./CustomerModal";

export type PickedCustomer = { id: string; fullName: string; phone: string | null };

function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** Chọn khách: tìm theo tên/SĐT (không dấu), chọn một, hoặc tạo nhanh (dùng lại sheet khách). */
export function CustomerPicker({ value, onChange, label = "Khách hàng", optional }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void; label?: string; optional?: boolean }) {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [creating, setCreating] = useState(false);
  const res = useSWR<{ items: Customer[] }>(!value && dq.length >= 2 ? `/api/v1/customers?pageSize=6&q=${encodeURIComponent(dq)}&active=1` : null, swrFetcher);

  if (value) {
    return (
      <div className="g g-flat" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 20 }}>
        <span className="wf-ib" data-tone="info" style={{ width: 40, height: 40 }} aria-hidden="true">
          <UserRound size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block" }}>{value.fullName}</b>
          <span className="wf-mute" style={{ fontSize: 12 }}>{value.phone ?? "Chưa có SĐT"}</span>
        </span>
        <Button sm iconOnly aria-label="Đổi khách" onClick={() => onChange(null)}>
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
    );
  }
  return (
    <div>
      <label className="wf-fld-label" htmlFor="cus-search">{label}{optional ? " (tùy chọn)" : ""}</label>
      <TextInput id="cus-search" type="search" enterKeyHint="search" icon={<Search size={18} />} placeholder="Tìm tên hoặc số điện thoại…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {dq.length >= 2 && (
        <div style={{ marginTop: 8 }}>
          {res.data && res.data.items.length > 0 && (
            <InsetList label="Kết quả tìm khách">
              {res.data.items.map((c) => (
                <InsetRow key={c.id} icon={<UserRound size={18} />} tone="info" title={c.fullName} subtitle={c.phone ?? c.code} onClick={() => onChange({ id: c.id, fullName: c.fullName, phone: c.phone })} />
              ))}
            </InsetList>
          )}
          {res.data && res.data.items.length === 0 && <p className="wf-mute">Không thấy khách “{dq}”.</p>}
        </div>
      )}
      {can("customer.create") && (
        <div style={{ marginTop: 8 }}>
          <Button sm icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>Tạo khách mới</Button>
        </div>
      )}
      <CustomerModal
        customer={null}
        open={creating}
        onClose={() => setCreating(false)}
        onDone={async (id) => {
          setCreating(false);
          if (id) {
            const c = await api<Customer>(`/api/v1/customers/${id}`, { noRedirect: true }).catch(() => null);
            if (c) onChange({ id: c.id, fullName: c.fullName, phone: c.phone });
          }
        }}
      />
    </div>
  );
}
