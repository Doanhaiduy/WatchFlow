import { api } from "@/server/http";

// Lịch sử xuất nhập linh kiện (FR-PART-06). Cột giá vốn chỉ trả khi cost.view (qua hàm kiểm quyền).
export const GET = api({ perm: ["part.manage", "cost.view"] }, async ({ params, db, can }) => {
  return db(async (tx) => {
    const items = await tx.q<Record<string, unknown>>(
      `SELECT m.id, m.qty_delta AS "qtyDelta", m.kind, m.prev_qty AS "prevQty", m.ref_table AS "refTable", m.ref_id AS "refId", m.reason, m.at,
              app.user_display_name(m.actor_id) AS "actorName"
       FROM public.part_stock_movements m WHERE m.part_id = $1 ORDER BY m.at DESC LIMIT 200`, [params.id]);
    if (can("cost.view")) {
      const costs = await tx.q<{ id: string; unit_cost: string }>("SELECT id, round(unit_cost, 4)::text AS unit_cost FROM app.fn_part_movement_costs($1)", [params.id]);
      const map = new Map(costs.map((c) => [c.id, c.unit_cost]));
      for (const it of items) it.unitCost = map.get(it.id as string) ?? null;
    }
    return { items };
  });
});
