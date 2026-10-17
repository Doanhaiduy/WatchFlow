import "server-only";
// Thanh toán: ghi nhiều dòng (tiền mặt/chuyển khoản/kết hợp) trong CÙNG transaction của request — mỗi dòng gọi app.fn_record_payment
// (khóa chứng từ, kiểm không vượt phải thu). Một dòng lỗi ⇒ rollback cả lô.
import type { Tx } from "./db";
import type { z } from "zod";
import type { RecordPaymentBody } from "@/lib/types/payments";

export async function recordPayments(tx: Tx, docType: string, docId: string, purpose: string, body: z.infer<typeof RecordPaymentBody>) {
  const out: { id: string; code: string; amount: number; change: number }[] = [];
  for (const l of body.lines) {
    out.push(
      await tx.fn("app.fn_record_payment", [docType, docId, purpose, l.method, l.amount, body.docDate ?? null, body.note ?? null, l.cashTendered ?? null, body.backdateReason ?? null]),
    );
  }
  return { payments: out, total: out.reduce((a, p) => a + p.amount, 0), change: out.reduce((a, p) => a + p.change, 0) };
}

export const PAYMENT_SELECT = `
  SELECT p.id, p.code, p.direction, p.purpose, p.method, p.amount_vnd AS amount, p.doc_date AS "docDate", p.doc_type AS "docType", p.doc_id AS "docId",
         p.customer_id AS "customerId", p.note, p.cash_tendered_vnd AS "cashTendered", p.status, p.voided_at AS "voidedAt", p.void_reason AS "voidReason",
         p.created_at AS "createdAt", app.user_display_name(p.created_by) AS "createdByName"
  FROM public.payments p`;
