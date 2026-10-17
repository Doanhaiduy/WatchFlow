import { z } from "zod";
import { api } from "@/server/http";

// Bỏ dùng linh kiện ⇒ hoàn kho theo giá vốn đã chốt
export const POST = api({ perm: "repair.update", body: z.object({ reason: z.string().trim().max(300).optional() }) }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_unuse_repair_part", [params.lineId, body.reason ?? null]));
});
