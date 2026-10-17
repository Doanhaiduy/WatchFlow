import { z } from "zod";
import { api } from "@/server/http";

// Ghi nhận khách đồng ý báo giá (khi bật repair.require_quote_approval — BR-REP-04)
export const POST = api({ perm: "repair.update", body: z.object({ channel: z.string().trim().max(60).optional() }) }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_approve_quote", [params.id, body.channel ?? null]));
});
