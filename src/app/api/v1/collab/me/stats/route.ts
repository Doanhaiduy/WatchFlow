import { api } from "@/server/http";
import { statsRange } from "@/server/collab";
import { StatsQuery } from "@/lib/types/collab";

// Thống kê của tôi (CTV): CHỈ số chiếc bán được theo ngày/tháng/quý/năm — không tiền (BR-COL-17)
export const GET = api({ perm: "collab.view_own", query: StatsQuery }, async ({ query, db }) => {
  const { from, to } = statsRange(query);
  const rows = await db((tx) => tx.q<{ period_start: string; units_sold: number }>("SELECT * FROM app.fn_my_collab_stats($1,$2,$3)", [from, to, query.period]));
  return { from, to, period: query.period, rows: rows.map((r) => ({ periodStart: r.period_start, unitsSold: Number(r.units_sold) })), total: rows.reduce((a, r) => a + Number(r.units_sold), 0) };
});
