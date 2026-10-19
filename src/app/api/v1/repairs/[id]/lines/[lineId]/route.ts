import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

const PatchLine = z.object({ description: z.string().trim().max(300).nullable().optional(), unitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional() });

export const PATCH = api({ perm: "repair.update", body: PatchLine }, async ({ params, body, db, can }) => {
  if (body.unitPrice !== undefined && !can("repair.price.edit")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền sửa giá.");
  const r = await db((tx) =>
    tx.one(`UPDATE public.repair_lines SET description = coalesce($3, description), unit_price_vnd = coalesce($4, unit_price_vnd)
            WHERE id = $2 AND order_id = $1 RETURNING id`, [params.id, params.lineId, body.description ?? null, body.unitPrice ?? null]),
  );
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy dòng.");
  return { ok: true };
});

export const DELETE = api({ perm: "repair.update" }, async ({ params, db }) => {
  const r = await db((tx) => tx.one("DELETE FROM public.repair_lines WHERE id = $2 AND order_id = $1 RETURNING id", [params.id, params.lineId]));
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy dòng.");
  return { ok: true };
});
