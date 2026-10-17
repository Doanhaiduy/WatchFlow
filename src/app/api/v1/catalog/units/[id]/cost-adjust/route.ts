import { api } from "@/server/http";
import { CostAdjustBody } from "@/lib/types/purchases";

// Điều chỉnh giá vốn (BR-PUR-08): bút toán adjustment ±, cost.adjust + lý do + xác thực lại; chỉ chiếc còn trong kho
export const POST = api({ perm: "cost.adjust", body: CostAdjustBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_adjust_unit_cost", [params.id, body.amount, body.reason]));
});
