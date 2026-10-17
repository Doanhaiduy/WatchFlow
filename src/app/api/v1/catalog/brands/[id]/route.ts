import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { BrandBody } from "@/lib/types/catalog";

export const PATCH = api({ perm: "catalog.manage", body: BrandBody.partial() }, async ({ req, params, body, db }) => {
  const v = req.headers.get("if-match");
  const r = await db((tx) =>
    tx.one<{ id: string }>(
      `UPDATE public.brands SET name = coalesce($2, name), country = coalesce($3, country), is_active = coalesce($4, is_active)
       WHERE id = $1 AND ($5::int IS NULL OR version = $5) RETURNING id`,
      [params.id, body.name ?? null, body.country ?? null, body.isActive ?? null, v ? Number(v) : null],
    ),
  );
  if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Thương hiệu vừa được người khác sửa hoặc không tồn tại. Hãy tải lại.");
  return { ok: true };
});
