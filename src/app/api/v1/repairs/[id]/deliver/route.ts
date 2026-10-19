import { api } from "@/server/http";

// Giao máy: doanh thu sửa chữa ghi nhận lúc giao (= tổng các khoản), bắt đầu bảo hành sau sửa (BR-REP-07, BR-WAR-01). Không thu/ghi nợ ở hệ thống (CF-13).
export const POST = api({ perm: "repair.deliver", idempotent: "required" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_deliver_repair", [params.id, "[]", null]));
});
