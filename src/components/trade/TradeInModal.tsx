"use client";
import { useEffect, useState } from "react";
import { ImageUpload } from "../lucian/ImageUpload";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { MoneyInput } from "../ui/MoneyInput";
import { emptyWatch, WatchFields, type WatchValue } from "./WatchFields";

export type TradeInValue = { key: string; credit: number | null; v: WatchValue };

/** "Thêm máy cũ" (thu cũ đổi mới): loại, serial, tình trạng, vị trí, giá thu; ảnh giấy tờ/máy gắn vào phiếu bán (entityTable=sales). */
export function TradeInModal({ open, onClose, onSave, saleId, initial }: { open: boolean; onClose: () => void; onSave: (t: TradeInValue) => void; saleId: string | null; initial?: TradeInValue | null }) {
  const [v, setV] = useState<WatchValue>(emptyWatch({ initialStatus: "inspecting" }));
  const [credit, setCredit] = useState<number | null>(null);
  useEffect(() => {
    if (open) {
      setV(initial?.v ?? emptyWatch({ initialStatus: "inspecting" }));
      setCredit(initial?.credit ?? null);
    }
  }, [open, initial]);
  const ok = !!v.modelId && !!v.locationId && !!credit;
  return (
    <Modal open={open} onClose={onClose} title="Thêm máy cũ (thu cũ đổi mới)" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!ok} onClick={() => onSave({ key: initial?.key ?? `t${Date.now()}`, credit, v })}>Thêm vào phiếu</Button></>}>
      <p className="wf-mute" style={{ marginBottom: 8 }}>Máy cũ vào kho ở trạng thái “Chờ kiểm tra”. Cần chọn khách (người bán máy cũ).</p>
      <WatchFields value={v} onChange={(p) => setV((x) => ({ ...x, ...p }))} showStatus={false} locationRequired />
      <Field label="Giá thu máy cũ" required><MoneyInput value={credit} onChange={setCredit} /></Field>
      {saleId ? (
        <>
          <p className="wf-fld-label">Ảnh giấy tờ người bán</p>
          <ImageUpload kind="id_document" entityTable="sales" entityId={saleId} onUploaded={() => undefined} />
          <p className="wf-fld-label" style={{ marginTop: 12 }}>Ảnh máy cũ</p>
          <ImageUpload kind="condition" entityTable="sales" entityId={saleId} onUploaded={() => undefined} />
        </>
      ) : (
        <p className="wf-mute">Thêm ít nhất một chiếc vào phiếu để lưu nháp, sau đó mới tải ảnh được.</p>
      )}
    </Modal>
  );
}
