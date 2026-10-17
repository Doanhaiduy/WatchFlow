import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { LocationBody } from "@/lib/types/catalog";

export const PATCH = api({ perm: "location.manage", body: LocationBody.partial() }, async ({ req, params, body, db }) => {
  const v = req.headers.get("if-match");
  const r = await db((tx) =>
    tx.one(
      `UPDATE public.storage_locations SET name = coalesce($2, name), kind = coalesce($3, kind), note = coalesce($4, note), is_active = coalesce($5, is_active)
       WHERE id = $1 AND ($6::int IS NULL OR version = $6) RETURNING id`,
      [params.id, body.name ?? null, body.kind ?? null, body.note ?? null, body.isActive ?? null, v ? Number(v) : null],
    ),
  );
  if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Vị trí vừa được người khác sửa hoặc không tồn tại. Hãy tải lại.");
  return { ok: true };
});
