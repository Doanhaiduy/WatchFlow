import { api } from "@/server/http";

// Lịch sử trạng thái + giá + di chuyển của chiếc (FR-UNIT-10/11)
export const GET = api({ perm: "catalog.view" }, async ({ params, db }) => {
  return db(async (tx) => ({
    status: await tx.q(
      `SELECT h.id, h.from_status AS "from", h.to_status AS "to", h.at, h.reason, h.ref_table AS "refTable", h.ref_id AS "refId",
              app.user_display_name(h.actor_id) AS "actorName"
       FROM public.unit_status_history h WHERE h.unit_id = $1 ORDER BY h.at DESC`, [params.id]),
    prices: await tx.q(
      `SELECT h.id, h.field, h.old_value AS "oldValue", h.new_value AS "newValue", h.at, h.reason, app.user_display_name(h.actor_id) AS "actorName"
       FROM public.unit_price_history h WHERE h.unit_id = $1 ORDER BY h.at DESC`, [params.id]),
    movements: await tx.q(
      `SELECT m.id, fl.name AS "fromName", tl.name AS "toName", m.at, m.note, app.user_display_name(m.actor_id) AS "actorName"
       FROM public.unit_movements m LEFT JOIN public.storage_locations fl ON fl.id = m.from_location_id
       LEFT JOIN public.storage_locations tl ON tl.id = m.to_location_id WHERE m.unit_id = $1 ORDER BY m.at DESC`, [params.id]),
  }));
});
