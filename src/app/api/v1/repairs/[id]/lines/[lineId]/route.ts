import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { RepairLineBody } from "@/lib/types/repairs";

export const PATCH = api({ perm: "repair.update", body: RepairLineBody.partial() }, async ({ params, body, db, can }) => {
  if (body.unitPrice !== undefined && body.unitPrice !== null && !can("repair.price.edit")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền sửa giá.");
  const r = await db((tx) =>
    tx.one(`UPDATE public.repair_lines SET description = coalesce($3, description), qty = coalesce($4, qty), unit_price_vnd = coalesce($5, unit_price_vnd)
            WHERE id = $2 AND order_id = $1 RETURNING id`, [params.id, params.lineId, body.description ?? null, body.qty ?? null, body.unitPrice ?? null]),
  );
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy dòng.");
  return { ok: true };
});

export const DELETE = api({ perm: "repair.update" }, async ({ params, db }) => {
  const r = await db((tx) => tx.one("DELETE FROM public.repair_lines WHERE id = $2 AND order_id = $1 RETURNING id", [params.id, params.lineId]));
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy dòng.");
  return { ok: true };
});
