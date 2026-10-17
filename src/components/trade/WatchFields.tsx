"use client";
import { useMemo } from "react";
import { useLocations, useModels } from "../catalog/useLists";
import { Checkbox } from "../ui/Checkbox";
import { Field } from "../ui/Field";
import { MoneyInput } from "../ui/MoneyInput";
import { Select, TextInput } from "../ui/TextInput";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/types/catalog";

export type WatchValue = {
  modelId: string; serialNo: string; hasSerial: boolean; condition: string; conditionGrade: string; conditionNote: string;
  initialStatus: string; locationId: string; listPrice: number | null;
};
export const emptyWatch = (over: Partial<WatchValue> = {}): WatchValue => ({
  modelId: "", serialNo: "", hasSerial: true, condition: "used", conditionGrade: "", conditionNote: "", initialStatus: "in_stock", locationId: "", listPrice: null, ...over,
});

/** Nhóm trường nhập một chiếc đồng hồ (dùng ở phiếu nhập, nhập nhanh, thu cũ đổi mới). Giá nhập/giá thu do chỗ dùng tự thêm. */
export function WatchFields({ value, onChange, errors = {}, showStatus = true, locationRequired }: { value: WatchValue; onChange: (p: Partial<WatchValue>) => void; errors?: Record<string, string>; showStatus?: boolean; locationRequired?: boolean }) {
  const models = useModels(undefined, true);
  const locs = useLocations(true);
  const options = useMemo(() => {
    const list = (models.data?.items ?? []).filter((m) => m.isActive || m.id === value.modelId);
    const full = (m: (typeof list)[number]) => (m.name.toLowerCase().startsWith(m.brandName.toLowerCase()) ? m.name : `${m.brandName} ${m.name}`);
    const seen = new Map<string, number>();
    list.forEach((m) => seen.set(full(m), (seen.get(full(m)) ?? 0) + 1));
    // Tên đầy đủ (hãng + loại); chỉ thêm mã khi có hai loại trùng tên
    return list.map((m) => ({ value: m.id, label: (seen.get(full(m)) ?? 0) > 1 ? `${full(m)} (${m.code})` : full(m), keywords: m.code }));
  }, [models.data, value.modelId]);
  return (
    <>
      <Field label="Loại đồng hồ" required error={errors.modelId} hint={models.data && options.length === 0 ? "Chưa có loại nào — thêm ở Đồng hồ → Loại & hãng" : undefined}>
        <Select placeholder="Chọn loại đồng hồ" value={value.modelId} onChange={(e) => onChange({ modelId: e.target.value })} options={options} />
      </Field>
      <Field label="Số serial" error={errors.serialNo}>
        <TextInput value={value.serialNo} disabled={!value.hasSerial} onChange={(e) => onChange({ serialNo: e.target.value })} autoComplete="off" spellCheck={false} placeholder={value.hasSerial ? "Nhập số serial" : "Không có serial"} />
      </Field>
      <Checkbox checked={!value.hasSerial} onChange={(c) => onChange({ hasSerial: !c, serialNo: c ? "" : value.serialNo })} label="Máy không có serial" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label="Tình trạng"><Select value={value.condition} onChange={(e) => onChange({ condition: e.target.value })} options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))} /></Field>
        <Field label="Hạng / % mới" required={value.condition !== "new" && value.initialStatus === "in_stock"} error={errors.conditionGrade}><TextInput value={value.conditionGrade} maxLength={5} onChange={(e) => onChange({ conditionGrade: e.target.value.toUpperCase() })} placeholder="A, B, 95%" /></Field>
      </div>
      <Field label="Ghi chú tình trạng"><TextInput value={value.conditionNote} onChange={(e) => onChange({ conditionNote: e.target.value })} maxLength={500} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: showStatus ? "1fr 1fr" : "1fr", gap: 8 }}>
        {showStatus && (
          <Field label="Trạng thái ban đầu"><Select value={value.initialStatus} onChange={(e) => onChange({ initialStatus: e.target.value })} options={[{ value: "in_stock", label: "Sẵn sàng bán" }, { value: "inspecting", label: "Chờ kiểm tra" }]} /></Field>
        )}
        <Field label="Vị trí lưu kho" required={locationRequired} error={errors.locationId}>
          <Select placeholder="Chưa đặt" value={value.locationId} onChange={(e) => onChange({ locationId: e.target.value })} options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} />
        </Field>
      </div>
      <Field label="Giá niêm yết dự kiến" hint="Gợi ý giá bán; có thể sửa sau" error={errors.listPrice}>
        <MoneyInput value={value.listPrice} onChange={(v) => onChange({ listPrice: v })} />
      </Field>
    </>
  );
}

/** Chuyển giá trị form → thân API (chuỗi rỗng ⇒ null) */
export function watchBody(v: WatchValue) {
  return {
    modelId: v.modelId, serialNo: v.hasSerial ? v.serialNo.trim() || null : null, hasSerial: v.hasSerial, condition: v.condition,
    conditionGrade: v.conditionGrade.trim() || null, conditionNote: v.conditionNote.trim() || null, initialStatus: v.initialStatus,
    locationId: v.locationId || null, listPrice: v.listPrice,
  };
}
