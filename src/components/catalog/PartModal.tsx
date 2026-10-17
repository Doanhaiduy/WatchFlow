"use client";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "../auth/helpers";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Checkbox";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { MoneyInput } from "../ui/MoneyInput";
import { Select, Textarea, TextInput } from "../ui/TextInput";
import { useToast } from "../ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import type { Part, PartCategory } from "./types";
import { useBrands, useModels } from "./useLists";

type Compat = { brandId: string; modelId: string };

function CompatRow({ value, onChange, onRemove }: { value: Compat; onChange: (c: Compat) => void; onRemove: () => void }) {
  const brands = useBrands();
  const models = useModels(value.brandId || undefined, !!value.brandId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 44px", gap: 6, marginBottom: 6 }}>
      <Select aria-label="Thương hiệu" placeholder="Thương hiệu" value={value.brandId} onChange={(e) => onChange({ brandId: e.target.value, modelId: "" })} options={(brands.data?.items ?? []).filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))} />
      <Select aria-label="Loại (tùy chọn)" placeholder="Mọi loại" disabled={!value.brandId} value={value.modelId} onChange={(e) => onChange({ ...value, modelId: e.target.value })} options={(models.data?.items ?? []).map((m) => ({ value: m.id, label: m.name }))} />
      <Button iconOnly aria-label="Bỏ dòng tương thích" onClick={onRemove}>
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Tạo/sửa linh kiện (part.manage), kèm tương thích thương hiệu/loại */
export function PartModal({ part, open, onClose, onDone }: { part: Part | null; open: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const cats = useSWR<{ items: PartCategory[] }>(open ? "/api/v1/part-categories" : null, swrFetcher);
  const [f, setF] = useState({ code: "", name: "", categoryId: "", uom: "cái", specs: "", reorder: "0" });
  const [price, setPrice] = useState<number | null>(0);
  const [active, setActive] = useState(true);
  const [compat, setCompat] = useState<Compat[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF({ code: part?.code ?? "", name: part?.name ?? "", categoryId: part?.categoryId ?? "", uom: part?.uom ?? "cái", specs: part?.specs ?? "", reorder: String(part?.reorderLevel ?? 0) });
    setPrice(part?.salePrice ?? 0);
    setActive(part?.isActive ?? true);
    setCompat((part?.compatibility ?? []).map((c) => ({ brandId: c.brandId, modelId: c.modelId ?? "" })));
    setErrs({});
  }, [open, part]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    const body = {
      code: f.code, name: f.name, categoryId: f.categoryId, uom: f.uom || "cái", specs: f.specs.trim() || null, salePrice: price ?? 0, reorderLevel: Number(f.reorder) || 0,
      compatibility: compat.filter((c) => c.brandId).map((c) => ({ brandId: c.brandId, modelId: c.modelId || null })),
    };
    try {
      if (part) await sapi(`/api/v1/parts/${part.id}`, { method: "PATCH", ifMatch: part.version, body: { ...body, isActive: active } });
      else await sapi("/api/v1/parts", { body });
      toast.success(part ? "Đã lưu linh kiện" : "Đã thêm linh kiện");
      await onDone();
    } catch (x) {
      const er = fieldErrors(x);
      setErrs(Object.keys(er).length ? er : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} title={part ? "Sửa linh kiện" : "Thêm linh kiện"}>
      <form onSubmit={submit} noValidate>
        <Field label="Mã linh kiện" required hint="Chữ, số, . _ / -" error={errs.code}><TextInput data-autofocus value={f.code} onChange={set("code")} autoCapitalize="characters" /></Field>
        <Field label="Tên linh kiện" required error={errs.name}><TextInput value={f.name} onChange={set("name")} /></Field>
        <Field label="Loại linh kiện" required error={errs.categoryId}><Select placeholder="Chọn loại" value={f.categoryId} onChange={set("categoryId")} options={(cats.data?.items ?? []).filter((c) => c.isActive || c.id === part?.categoryId).map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="Đơn vị tính" error={errs.uom}><TextInput value={f.uom} onChange={set("uom")} /></Field>
        <Field label="Giá bán" error={errs.salePrice}><MoneyInput value={price} onChange={setPrice} /></Field>
        <Field label="Mức đặt hàng lại" hint="Tồn ≤ mức này thì báo sắp hết" error={errs.reorderLevel}><TextInput inputMode="numeric" value={f.reorder} onChange={set("reorder")} /></Field>
        <Field label="Thông số"><Textarea rows={2} value={f.specs} onChange={set("specs")} /></Field>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
          <legend className="wf-fld-label">Tương thích với</legend>
          {compat.map((c, i) => (
            <CompatRow key={i} value={c} onChange={(n) => setCompat((l) => l.map((x, j) => (j === i ? n : x)))} onRemove={() => setCompat((l) => l.filter((_, j) => j !== i))} />
          ))}
          <Button sm icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCompat((l) => [...l, { brandId: "", modelId: "" }])}>
            Thêm thương hiệu/loại
          </Button>
        </fieldset>
        {part && <Switch checked={active} onChange={setActive} label="Đang dùng" />}
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!f.code.trim() || !f.name.trim() || !f.categoryId}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}
