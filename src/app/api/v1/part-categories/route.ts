import { api } from "@/server/http";
import { CategoryBody } from "@/lib/types/catalog";

export const GET = api({ perm: "part.view" }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT c.id, c.name, c.is_active AS "isActive", c.version, (SELECT count(*)::int FROM public.parts p WHERE p.category_id = c.id) AS "partCount"
          FROM public.part_categories c ORDER BY c.is_active DESC, c.name`),
  );
  return { items };
});

export const POST = api({ perm: "part.manage", body: CategoryBody }, async ({ body, db }) => {
  const r = await db((tx) => tx.one<{ id: string }>("INSERT INTO public.part_categories (name) VALUES ($1) RETURNING id", [body.name]));
  return { id: r!.id };
});
