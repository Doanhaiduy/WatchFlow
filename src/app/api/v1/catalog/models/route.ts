import { z } from "zod";
import { api } from "@/server/http";
import { ModelBody } from "@/lib/types/catalog";
import { MODEL_COLS } from "@/server/catalog";

const Q = z.object({ q: z.string().trim().max(100).optional(), brandId: z.string().uuid().optional(), active: z.enum(["1", "0"]).optional() });


export const GET = api({ perm: ["catalog.view", "part.view"], query: Q }, async ({ query, db }) => {
  const p: unknown[] = [];
  const c: string[] = [];
  if (query.brandId) { p.push(query.brandId); c.push(`m.brand_id = $${p.length}`); }
  if (query.active) { p.push(query.active === "1"); c.push(`m.is_active = $${p.length}`); }
  if (query.q) { p.push(query.q); c.push(`(m.search_text LIKE '%' || app.norm_text($${p.length}) || '%' OR app.norm_text($${p.length}) <% m.search_text)`); }
  const items = await db((tx) =>
    tx.q(`SELECT ${MODEL_COLS}, (SELECT count(*)::int FROM public.watch_units u WHERE u.model_id = m.id AND u.status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting')) AS "stockCount"
          FROM public.watch_models m JOIN public.brands b ON b.id = m.brand_id ${c.length ? "WHERE " + c.join(" AND ") : ""}
          ORDER BY b.name, m.name LIMIT 500`, p),
  );
  return { items };
});

export const POST = api({ perm: "catalog.manage", body: ModelBody }, async ({ body: b, db }) => {
  const r = await db((tx) =>
    tx.one<{ id: string }>(
      `INSERT INTO public.watch_models (code, brand_id, name, reference_no, caliber, movement_type, case_size_mm, case_material, strap_type,
         dial_color, glass_type, water_resistance_m, gender, origin_country, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, app.current_user_id()) RETURNING id`,
      [b.code, b.brandId, b.name, b.referenceNo ?? null, b.caliber ?? null, b.movementType ?? null, b.caseSizeMm ?? null, b.caseMaterial ?? null,
       b.strapType ?? null, b.dialColor ?? null, b.glassType ?? null, b.waterResistanceM ?? null, b.gender ?? null, b.originCountry ?? null, b.description ?? null],
    ),
  );
  return { id: r!.id };
});
