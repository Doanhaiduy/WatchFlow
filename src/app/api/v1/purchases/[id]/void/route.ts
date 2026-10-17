import { api } from "@/server/http";
import { VoidBody } from "@/lib/types/purchases";

// Hủy phiếu nhập (BR-PUR-07): chỉ khi chưa phát sinh giao dịch phụ thuộc; lý do ≥ 10; xác thực lại.
export const POST = api({ perm: "purchase.void", body: VoidBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_void_purchase", [params.id, body.reason]));
});
