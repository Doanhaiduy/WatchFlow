import { api } from "@/server/http";
import { ConfirmClaimBody } from "@/lib/types/collab";

// Xác nhận CTV bán được: tạo đơn bán (giá mặc định = giá niêm yết, sửa được), chiếc → đã bán, các CTV khác mất quyền
export const POST = api({ perm: "sale.confirm", body: ConfirmClaimBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_confirm_claim", [params.id, body.price ?? null, body.docDate ?? null, body.warrantyMonths ?? null, body.backdateReason ?? null]));
});
