import { api } from "@/server/http";
import { BrandBody } from "@/lib/types/catalog";

export const GET = api({ perm: ["catalog.view", "part.view"] }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT b.id, b.name, b.country, b.is_active AS "isActive", b.version,
                 (SELECT count(*)::int FROM public.watch_models m WHERE m.brand_id = b.id) AS "modelCount"
          FROM public.brands b ORDER BY b.is_active DESC, b.name`),
  );
  return { items };
});

export const POST = api({ perm: "catalog.manage", body: BrandBody }, async ({ body, db }) => {
  const r = await db((tx) =>
    tx.one<{ id: string }>("INSERT INTO public.brands (name, country, created_by) VALUES ($1,$2, app.current_user_id()) RETURNING id", [body.name, body.country ?? null]),
  );
  return { id: r!.id };
});
