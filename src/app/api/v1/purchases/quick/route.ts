import { api } from "@/server/http";
import { saveDraft } from "@/server/purchases";
import { PurchaseBody } from "@/lib/types/purchases";

// "Thêm đồng hồ" (FR-UNIT-01): phiếu nhập 1 dòng tạo + xác nhận trong cùng transaction. Nguồn hàng không bắt buộc ở giao diện — mặc định "Nhập kho".
export const POST = api({ perm: ["purchase.create"], body: PurchaseBody, idempotent: "required" }, async ({ body, db, can }) => {
  return db(async (tx) => {
    const id = await saveDraft(tx, null, { ...body, sourceName: body.sourceName?.trim() || "Nhập kho" });
    if (!can("purchase.confirm")) return { id, status: "draft" };
    return tx.fn("app.fn_confirm_purchase", [id]);
  });
});
