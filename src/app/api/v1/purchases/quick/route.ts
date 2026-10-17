import { api } from "@/server/http";
import { saveDraft } from "@/server/purchases";
import { PurchaseBody } from "@/lib/types/purchases";

// "Nhập nhanh một chiếc" (FR-UNIT-01): phiếu nhập 1 dòng tạo + xác nhận trong cùng transaction (giá vốn luôn có nguồn — ADR-020)
export const POST = api({ perm: ["purchase.create"], body: PurchaseBody, idempotent: "required" }, async ({ body, db, can }) => {
  return db(async (tx) => {
    const id = await saveDraft(tx, null, body);
    if (!can("purchase.confirm")) return { id, status: "draft" };
    return tx.fn("app.fn_confirm_purchase", [id]);
  });
});
