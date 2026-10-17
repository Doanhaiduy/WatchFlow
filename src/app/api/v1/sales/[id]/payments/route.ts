import { api } from "@/server/http";
import { recordPayments } from "@/server/payments";
import { RecordPaymentBody } from "@/lib/types/payments";

// "Thu thêm" trên phiếu bán (BR-PAY-04): khóa phiếu, không vượt còn nợ (CT-05)
export const POST = api({ perm: "payment.create", body: RecordPaymentBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => recordPayments(tx, "sale", params.id!, "sale_receipt", body));
});
