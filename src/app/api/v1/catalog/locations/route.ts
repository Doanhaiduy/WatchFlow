import { api } from "@/server/http";
import { LocationBody } from "@/lib/types/catalog";

export const GET = api({ perm: ["catalog.view", "location.manage"] }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT l.id, l.name, l.kind, l.note, l.is_active AS "isActive", l.version,
                 (SELECT count(*)::int FROM public.watch_units u WHERE u.location_id = l.id AND u.status IN ('in_stock','reserved','inspecting','in_repair')) AS "unitCount"
          FROM public.storage_locations l ORDER BY l.is_active DESC, l.name`),
  );
  return { items };
});

export const POST = api({ perm: "location.manage", body: LocationBody }, async ({ body, db }) => {
  const r = await db((tx) =>
    tx.one<{ id: string }>("INSERT INTO public.storage_locations (name, kind, note, created_by) VALUES ($1,$2,$3, app.current_user_id()) RETURNING id",
      [body.name, body.kind, body.note ?? null]),
  );
  return { id: r!.id };
});
