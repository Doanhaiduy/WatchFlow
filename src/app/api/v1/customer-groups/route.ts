import { api } from "@/server/http";
import { GroupBody } from "@/lib/types/customers";

export const GET = api({ perm: ["customer.view", "customer.view_own"] }, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT g.id, g.name, g.note, g.is_active AS "isActive", (SELECT count(*)::int FROM public.customers c WHERE c.group_id = g.id) AS "customerCount"
          FROM public.customer_groups g ORDER BY g.is_active DESC, g.name`),
  );
  return { items };
});

export const POST = api({ perm: "customer.manage", body: GroupBody }, async ({ body, db }) => {
  const r = await db((tx) => tx.one<{ id: string }>("INSERT INTO public.customer_groups (name, note) VALUES ($1,$2) RETURNING id", [body.name, body.note ?? null]));
  return { id: r!.id };
});
