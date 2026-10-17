import { api } from "@/server/http";

// Giá vốn (= giá thu của cửa hàng) theo chu kỳ — CHỈ cost.view (BR-SEC-02, FR-UNIT-06). RLS unit_cost_entries chặn lần hai.
export const GET = api({ perm: "cost.view" }, async ({ params, db }) => {
  return db(async (tx) => {
    const u = await tx.one<{ cost_cycle: number }>("SELECT cost_cycle FROM public.watch_units WHERE id = $1", [params.id]);
    const entries = await tx.q(
      `SELECT e.id, e.cycle, e.kind, e.amount_vnd AS amount, e.ref_table AS "refTable", e.ref_id AS "refId", e.reason, e.created_at AS "createdAt",
              app.user_display_name(e.created_by) AS "actorName"
       FROM public.unit_cost_entries e WHERE e.unit_id = $1 ORDER BY e.cycle DESC, e.created_at`, [params.id]);
    const total = entries.filter((e) => e.cycle === u?.cost_cycle).reduce((a, e) => a + (e.amount as number), 0);
    return { cycle: u?.cost_cycle ?? 1, total, entries };
  });
});
