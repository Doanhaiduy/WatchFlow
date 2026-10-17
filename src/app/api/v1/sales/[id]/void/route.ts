import { api } from "@/server/http";
import { VoidBody } from "@/lib/types/purchases";

// Hủy phiếu bán trong cửa sổ [sales.void_window_hours] (BR-SALE-10) — sale.void + lý do + xác thực lại
export const POST = api({ perm: "sale.void", body: VoidBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_void_sale", [params.id, body.reason]));
});
