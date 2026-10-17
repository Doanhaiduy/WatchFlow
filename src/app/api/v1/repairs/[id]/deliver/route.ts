import { api } from "@/server/http";
import { DeliverBody } from "@/lib/types/repairs";

// Giao máy: doanh thu ghi nhận lúc giao, thu tiền/ghi nợ, bảo hành sau sửa (BR-REP-07, BR-WAR-01)
export const POST = api({ perm: "repair.deliver", body: DeliverBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_deliver_repair", [params.id, JSON.stringify(body.payments), body.dueDate ?? null]));
});
