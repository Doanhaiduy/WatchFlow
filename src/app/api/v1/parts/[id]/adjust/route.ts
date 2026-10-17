import { api } from "@/server/http";
import { PartAdjustBody } from "@/lib/types/catalog";

// Điều chỉnh tồn linh kiện (BR-PART-05): lý do bắt buộc, luôn tạo movement
export const POST = api({ perm: "part.stock.adjust", body: PartAdjustBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_adjust_part_stock", [params.id, body.delta, body.reason, "adjustment"]));
});
