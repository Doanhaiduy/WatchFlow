import { api } from "@/server/http";
import { CompleteBody } from "@/lib/types/repairs";

// Hoàn thành: khóa dòng, trừ nốt linh kiện; sửa nội bộ vốn hóa vào giá vốn chiếc (BR-COST-04)
export const POST = api({ perm: "repair.update", body: CompleteBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_complete_repair", [params.id, body.unitStatus, body.condition ?? null, body.grade ?? null, body.findings ?? null]));
});
