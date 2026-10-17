import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { ModelBody } from "@/lib/types/catalog";
import { MODEL_COLS } from "@/server/catalog";

export const GET = api({ perm: ["catalog.view", "part.view"] }, async ({ params, db }) => {
  const m = await db((tx) => tx.one(`SELECT ${MODEL_COLS} FROM public.watch_models m JOIN public.brands b ON b.id = m.brand_id WHERE m.id = $1`, [params.id]));
  if (!m) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy loại đồng hồ.");
  return m;
});

const COLS: Record<string, string> = {
  code: "code", brandId: "brand_id", name: "name", referenceNo: "reference_no", caliber: "caliber", movementType: "movement_type",
  caseSizeMm: "case_size_mm", caseMaterial: "case_material", strapType: "strap_type", dialColor: "dial_color", glassType: "glass_type",
  waterResistanceM: "water_resistance_m", gender: "gender", originCountry: "origin_country", description: "description", isActive: "is_active",
};

export const PATCH = api({ perm: "catalog.manage", body: ModelBody.partial() }, async ({ req, params, body, db }) => {
  const sets: string[] = [];
  const p: unknown[] = [params.id];
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || !COLS[k]) continue;
    p.push(v);
    sets.push(`${COLS[k]} = $${p.length}`);
  }
  if (!sets.length) return { ok: true };
  const ver = req.headers.get("if-match");
  p.push(ver ? Number(ver) : null);
  const r = await db((tx) =>
    tx.one(`UPDATE public.watch_models SET ${sets.join(", ")} WHERE id = $1 AND ($${p.length}::int IS NULL OR version = $${p.length}) RETURNING id`, p),
  );
  if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Loại đồng hồ vừa được người khác sửa hoặc không tồn tại. Hãy tải lại.");
  return { ok: true };
});
