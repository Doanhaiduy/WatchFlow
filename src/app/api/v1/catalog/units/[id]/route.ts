import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getUnit } from "@/server/catalog";
import { UnitInfoBody } from "@/lib/types/catalog";

// Chi tiết chiếc (id hoặc mã nội bộ) + phụ kiện + ảnh. Giá vốn chỉ khi cost.view.
export const GET = api({ perm: ["catalog.view", "collab.view_own"] }, async ({ params, db, can }) => {
  return db(async (tx) => {
    const unit = await getUnit(tx, params.id!, can("cost.view"));
    if (!unit) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy chiếc đồng hồ hoặc bạn không có quyền xem.");
    const model = await tx.one(
      `SELECT caliber, movement_type AS "movementType", case_size_mm::float AS "caseSizeMm", case_material AS "caseMaterial", strap_type AS "strapType",
              dial_color AS "dialColor", glass_type AS "glassType", water_resistance_m AS "waterResistanceM", gender, origin_country AS "originCountry", description
       FROM public.watch_models WHERE id = $1`, [unit.model.id]);
    const extra = await tx.one<{ manufacturer_warranty_until: string | null; note: string | null; created_at: string }>(
      `SELECT manufacturer_warranty_until::text, note, created_at FROM public.watch_units WHERE id = $1`, [unit.id]);
    const accessories = await tx.q(`SELECT id, kind, present, note FROM public.unit_accessories WHERE unit_id = $1 ORDER BY created_at`, [unit.id]);
    const photos = await tx.q(
      `SELECT id, kind, width, height, taken_at AS "takenAt", '/api/v1/files/' || id AS url, '/api/v1/files/' || id || '/thumb' AS "thumbUrl"
       FROM public.files WHERE entity_table = 'watch_units' AND entity_id = $1 AND kind IN ('product','condition') AND NOT is_deleted ORDER BY created_at`, [unit.id]);
    return { ...unit, specs: model, manufacturerWarrantyUntil: extra?.manufacturer_warranty_until ?? null, note: extra?.note ?? null, createdAt: extra?.created_at, accessories, photos };
  });
});

// Sửa thông tin phi tài chính (GRANT cột hạn chế) + phụ kiện
export const PATCH = api({ perm: "catalog.manage", body: UnitInfoBody }, async ({ req, params, body, db }) => {
  const ver = req.headers.get("if-match");
  return db(async (tx) => {
    const sets: string[] = [];
    const p: unknown[] = [params.id];
    const map: [keyof typeof body, string][] = [["condition", "condition"], ["conditionGrade", "condition_grade"], ["conditionNote", "condition_note"],
      ["note", "note"], ["manufacturerWarrantyUntil", "manufacturer_warranty_until"]];
    for (const [k, col] of map) {
      if (body[k] === undefined) continue;
      p.push(body[k]);
      sets.push(`${col} = $${p.length}`);
    }
    if (sets.length) {
      p.push(ver ? Number(ver) : null);
      const r = await tx.one(`UPDATE public.watch_units SET ${sets.join(", ")} WHERE id = $1 AND ($${p.length}::int IS NULL OR version = $${p.length}) RETURNING id`, p);
      if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Chiếc đồng hồ vừa được người khác cập nhật hoặc không sửa được. Hãy tải lại.");
    }
    if (body.accessories) {
      await tx.q("DELETE FROM public.unit_accessories WHERE unit_id = $1", [params.id]);
      for (const a of body.accessories) {
        await tx.q("INSERT INTO public.unit_accessories (unit_id, kind, present, note, created_by) VALUES ($1,$2,$3,$4, app.current_user_id())",
          [params.id, a.kind, a.present, a.note ?? null]);
      }
    }
    return { ok: true };
  });
});
