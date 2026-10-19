import { api } from "@/server/http";
import { CompleteBody } from "@/lib/types/repairs";

// Sửa xong: khóa các dòng, chốt tiền sửa (chờ khách đến lấy máy)
export const POST = api({ perm: "repair.update", body: CompleteBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_complete_repair", [params.id, "in_stock", null, null, body.findings ?? null]));
});
