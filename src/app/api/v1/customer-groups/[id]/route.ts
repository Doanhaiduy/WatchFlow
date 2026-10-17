import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { GroupBody } from "@/lib/types/customers";

export const PATCH = api({ perm: "customer.manage", body: GroupBody.partial() }, async ({ params, body, db }) => {
  const r = await db((tx) =>
    tx.one("UPDATE public.customer_groups SET name = coalesce($2, name), note = coalesce($3, note), is_active = coalesce($4, is_active) WHERE id = $1 RETURNING id",
      [params.id, body.name ?? null, body.note ?? null, body.isActive ?? null]),
  );
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy nhóm khách.");
  return { ok: true };
});
