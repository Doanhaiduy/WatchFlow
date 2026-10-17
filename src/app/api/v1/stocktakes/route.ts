import { z } from "zod";
import { api } from "@/server/http";

export const GET = api({ perm: "stocktake.manage" }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT s.id, s.code, s.scope, s.status, s.location_id AS "locationId", l.name AS "locationName", s.started_at AS "startedAt", s.reconciled_at AS "reconciledAt",
                 app.user_display_name(s.started_by) AS "startedByName", s.note,
                 (SELECT count(*)::int FROM public.stocktake_lines x WHERE x.stocktake_id = s.id) AS "lineCount",
                 (SELECT count(*)::int FROM public.stocktake_lines x WHERE x.stocktake_id = s.id AND x.counted_qty IS NOT NULL) AS "countedCount",
                 (SELECT coalesce(sum(loss_vnd),0)::bigint FROM public.stocktake_lines x WHERE x.stocktake_id = s.id) AS loss
          FROM public.stocktakes s LEFT JOIN public.storage_locations l ON l.id = s.location_id ORDER BY s.started_at DESC LIMIT 100`),
  );
  return { items };
});

const Body = z.object({ scope: z.enum(["all_units", "location", "parts", "all"]), locationId: z.string().uuid().nullable().optional(), note: z.string().trim().max(300).optional() });
export const POST = api({ perm: "stocktake.manage", body: Body, idempotent: "optional" }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_start_stocktake", [body.scope, body.locationId ?? null, body.note ?? null]));
});
