import { api } from "@/server/http";
import { VoidPaymentBody } from "@/lib/types/payments";

// Hủy thanh toán (payment.void + lý do + xác thực lại). Thanh toán bất biến: sai ⇒ hủy rồi ghi lại.
export const POST = api({ perm: "payment.void", body: VoidPaymentBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_void_payment", [params.id, body.reason]));
});
