import { api } from "@/server/http";

// Xác nhận phiếu nhập (BR-PUR-04): một transaction — sinh chiếc, giá vốn, kho linh kiện. Bắt buộc Idempotency-Key (CT-07).
export const POST = api({ perm: "purchase.confirm", idempotent: "required" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_confirm_purchase", [params.id]));
});
