import { api } from "@/server/http";
import { recordPayments } from "@/server/payments";
import { RecordPaymentBody } from "@/lib/types/payments";

// Nhận thêm tiền / cọc cho phiếu sửa; sau khi giao: thu nợ (BR-REP-05)
export const POST = api({ perm: "payment.create", body: RecordPaymentBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => recordPayments(tx, "repair", params.id!, "repair_receipt", body));
});
