import "server-only";
// Phiếu nhập (nội bộ): lưu nháp (đầu + dòng + chi phí, ghi trực tiếp theo RLS) — dùng cho "Thêm đồng hồ" và Nhập từ Excel.
import type { z } from "zod";
import type { Tx } from "./db";
import { ApiError } from "./errors";
import type { PurchaseBody } from "@/lib/types/purchases";

type Body = z.infer<typeof PurchaseBody>;

export async function saveDraft(tx: Tx, id: string | null, b: Body, version?: number | null): Promise<string> {
  let rid = id;
  if (!rid) {
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.purchase_receipts (kind, source_name, seller_customer_id, doc_date, backdate_reason, payment_note, note, received_by, created_by)
       VALUES ($1,$2,$3, coalesce($4::date, app.today_vn()), $5,$6,$7, app.current_user_id(), app.current_user_id()) RETURNING id`,
      [b.kind, b.sourceName ?? null, b.sellerCustomerId ?? null, b.docDate ?? null, b.backdateReason ?? null, b.paymentNote ?? null, b.note ?? null],
    );
    rid = r!.id;
  } else {
    const r = await tx.one(
      `UPDATE public.purchase_receipts SET kind=$2, source_name=$3, seller_customer_id=$4, doc_date=coalesce($5::date, doc_date), backdate_reason=$6,
              payment_note=$7, note=$8 WHERE id=$1 AND status='draft' AND ($9::int IS NULL OR version=$9) RETURNING id`,
      [rid, b.kind, b.sourceName ?? null, b.sellerCustomerId ?? null, b.docDate ?? null, b.backdateReason ?? null, b.paymentNote ?? null, b.note ?? null, version ?? null],
    );
    if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Phiếu nhập đã được xác nhận hoặc vừa được người khác sửa. Hãy tải lại.");
    await tx.q("DELETE FROM public.purchase_lines WHERE receipt_id=$1", [rid]);
    await tx.q("DELETE FROM public.purchase_costs WHERE receipt_id=$1", [rid]);
  }
  let no = 0;
  for (const l of b.lines) {
    no++;
    if (l.lineType === "watch") {
      await tx.q(
        `INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, model_id, serial_no, has_serial, condition, condition_grade, condition_note,
           initial_status, location_id, list_price_vnd, rebuy_unit_id, qty, unit_price_vnd, note)
         VALUES ($1,$2,'watch',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,$13,$14)`,
        [rid, no, l.modelId, l.hasSerial ? (l.serialNo ?? null) : null, l.hasSerial, l.condition, l.conditionGrade ?? null, l.conditionNote ?? null,
         l.initialStatus, l.locationId ?? null, l.listPrice ?? null, l.rebuyUnitId ?? null, l.unitPrice, l.note ?? null],
      );
    } else {
      await tx.q(
        `INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, part_id, qty, unit_price_vnd, note) VALUES ($1,$2,'part',$3,$4,$5,$6)`,
        [rid, no, l.partId, l.qty, l.unitPrice, l.note ?? null],
      );
    }
  }
  for (const c of b.costs) {
    await tx.q("INSERT INTO public.purchase_costs (receipt_id, kind, description, amount_vnd, allocate_method) VALUES ($1,$2,$3,$4,$5)",
      [rid, c.kind, c.description ?? null, c.amount, c.allocateMethod]);
  }
  return rid!;
}
