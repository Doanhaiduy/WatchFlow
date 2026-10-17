import { api } from "@/server/http";
import { ConfirmSaleBody } from "@/lib/types/sales";

// Xác nhận phiếu bán (BR-SALE-08): một transaction — khóa chiếc, giá vốn, thu cũ, cọc, thanh toán, bảo hành. Idempotency-Key bắt buộc (CT-07).
export const POST = api({ perm: "sale.confirm", body: ConfirmSaleBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_confirm_sale", [params.id, JSON.stringify(body.payments), body.cashTendered ?? null]));
});
