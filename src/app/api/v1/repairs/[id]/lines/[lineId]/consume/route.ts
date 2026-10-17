import { api } from "@/server/http";

// Xác nhận dùng linh kiện ⇒ trừ kho (BR-PART-03, CT-04)
export const POST = api({ perm: "repair.update", idempotent: "optional" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_use_repair_part", [params.lineId]));
});
