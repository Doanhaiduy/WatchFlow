import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { CategoryBody } from "@/lib/types/catalog";

export const PATCH = api({ perm: "part.manage", body: CategoryBody.partial() }, async ({ params, body, db }) => {
  const r = await db((tx) =>
    tx.one("UPDATE public.part_categories SET name = coalesce($2, name), is_active = coalesce($3, is_active) WHERE id = $1 RETURNING id",
      [params.id, body.name ?? null, body.isActive ?? null]),
  );
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy loại linh kiện.");
  return { ok: true };
});
