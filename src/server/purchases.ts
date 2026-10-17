import "server-only";
// Phiếu nhập: lưu nháp (đầu + dòng + chi phí, ghi trực tiếp theo RLS), đọc chi tiết + xem trước phân bổ (costing §3 — cùng thuật toán với SQL).
import type { z } from "zod";
import type { Tx } from "./db";
import { ApiError } from "./errors";
import { allocate } from "@/lib/money";
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

export async function getPurchase(tx: Tx, id: string) {
  const r = await tx.one<Record<string, unknown>>(
    `SELECT r.id, r.code, r.kind, r.source_name AS "sourceName", r.seller_customer_id AS "sellerCustomerId", r.seller_name AS "sellerName",
            r.seller_phone AS "sellerPhone", r.doc_date AS "docDate", r.status, r.subtotal_vnd AS subtotal, r.extra_cost_total_vnd AS "extraCostTotal",
            r.grand_total_vnd AS "grandTotal", r.payment_note AS "paymentNote", r.note, r.confirmed_at AS "confirmedAt", r.voided_at AS "voidedAt",
            r.void_reason AS "voidReason", r.version, r.created_at AS "createdAt", app.user_display_name(r.created_by) AS "createdByName",
            app.user_display_name(r.received_by) AS "receivedByName", app.user_display_name(r.confirmed_by) AS "confirmedByName"
     FROM public.purchase_receipts r WHERE r.id::text = $1 OR r.code = upper($1)`, [id]);
  if (!r) return null;
  const lines = await tx.q<Record<string, unknown>>(
    `SELECT l.id, l.line_no AS "lineNo", l.line_type AS "lineType", l.model_id AS "modelId", m.code AS "modelCode", m.name AS "modelName",
            b.name AS "brandName", l.serial_no AS "serialNo", l.has_serial AS "hasSerial", l.condition, l.condition_grade AS "conditionGrade",
            l.condition_note AS "conditionNote", l.initial_status AS "initialStatus", l.location_id AS "locationId", sl.name AS "locationName",
            l.list_price_vnd AS "listPrice", l.rebuy_unit_id AS "rebuyUnitId", l.part_id AS "partId", p.code AS "partCode", p.name AS "partName",
            l.qty, l.unit_price_vnd AS "unitPrice", l.line_total_vnd AS "lineTotal", l.allocated_cost_vnd AS "allocatedCost",
            l.unit_id AS "unitId", u.asset_code AS "assetCode", l.note
     FROM public.purchase_lines l LEFT JOIN public.watch_models m ON m.id = l.model_id LEFT JOIN public.brands b ON b.id = m.brand_id
     LEFT JOIN public.storage_locations sl ON sl.id = l.location_id LEFT JOIN public.parts p ON p.id = l.part_id
     LEFT JOIN public.watch_units u ON u.id = l.unit_id WHERE l.receipt_id = $1 ORDER BY l.line_no`, [r.id]);
  const costs = await tx.q<{ amount: number; allocateMethod: "by_value" | "equal" }>(
    `SELECT id, kind, description, amount_vnd AS amount, allocate_method AS "allocateMethod" FROM public.purchase_costs WHERE receipt_id = $1 ORDER BY created_at, id`, [r.id]);
  // Xem trước phân bổ cho nháp (đã xác nhận ⇒ dùng số đã chốt)
  if (r.status === "draft" && lines.length) {
    const w = lines.map((l) => l.lineTotal as number);
    const tot = lines.map(() => 0);
    for (const c of costs) allocate(c.amount, w, { method: c.allocateMethod }).forEach((x, i) => (tot[i]! += x));
    lines.forEach((l, i) => (l.allocatedCost = tot[i]));
  }
  for (const l of lines) l.unitCost = l.lineType === "watch" ? (l.lineTotal as number) + (l.allocatedCost as number)
    : Math.round((((l.lineTotal as number) + (l.allocatedCost as number)) / (l.qty as number)) * 10000) / 10000;
  const files = await tx.q(
    `SELECT id, kind, '/api/v1/files/' || id || '/thumb' AS "thumbUrl" FROM public.files WHERE entity_table='purchase_receipts' AND entity_id=$1 AND NOT is_deleted ORDER BY created_at`, [r.id]);
  return { ...r, lines, costs, files };
}
