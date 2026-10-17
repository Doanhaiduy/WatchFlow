import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "bank_transfer"] as const;
export const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản" };
export const PURPOSE_LABELS: Record<string, string> = {
  sale_receipt: "Thu tiền bán hàng", repair_receipt: "Thu tiền sửa chữa", deposit_receipt: "Nhận cọc giữ hàng",
  collab_settlement: "CTV nộp tiền (quyết toán)", deposit_refund: "Hoàn cọc", repair_deposit_refund: "Hoàn tiền nhận trước (sửa)",
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Một dòng thanh toán (thanh toán kết hợp = nhiều dòng) */
export const PaymentLine = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  cashTendered: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().nullable(),
});
export const RecordPaymentBody = z.object({
  lines: z.array(PaymentLine).min(1).max(5),
  docDate: isoDate.optional(),
  note: z.string().trim().max(300).optional(),
  backdateReason: z.string().trim().max(500).optional(),
});
export const VoidPaymentBody = z.object({ reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500) });
export const PaymentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  docType: z.enum(["sale", "repair", "reservation", "settlement"]).optional(),
  docId: z.string().uuid().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(["posted", "voided"]).optional(),
});
