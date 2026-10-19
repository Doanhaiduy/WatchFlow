import { z } from "zod";
import { api } from "@/server/http";
import { statsRange } from "@/server/collab";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Q = z.object({ period: z.enum(["day", "month", "quarter", "year"]).default("month"), from: isoDate.optional(), to: isoDate.optional() });

// Thống kê CTV mang về (chỉ chủ — collab.view): theo kỳ + từng CTV, số chiếc và doanh thu. CTV dùng /collab/me/stats (chỉ số chiếc).
export const GET = api({ perm: "collab.view", query: Q }, async ({ query, db }) => {
  const { from, to } = statsRange(query);
  const data = await db(async (tx) => (await tx.one<{ r: unknown }>("SELECT app.rpt_collab_sales($1,$2,$3) AS r", [from, to, query.period]))!.r);
  return { from, to, period: query.period, ...(data as object) };
});
