import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { PartBody } from "@/lib/types/catalog";

export const GET = api({ perm: "part.view" }, async ({ params, db, can }) => {
  const withCost = can("cost.view");
  return db(async (tx) => {
    const part = await tx.one(
      `SELECT p.id, p.code, p.name, p.category_id AS "categoryId", pc.name AS "categoryName", p.uom, p.specs, p.sale_price_vnd AS "salePrice",
              p.reorder_level AS "reorderLevel", p.qty_on_hand AS "qtyOnHand", p.is_active AS "isActive", p.version
              ${withCost ? `, (SELECT round(c.avg_cost, 4)::text FROM public.part_costs c WHERE c.part_id = p.id) AS "avgCost"` : ""}
       FROM public.parts p JOIN public.part_categories pc ON pc.id = p.category_id WHERE p.id = $1`, [params.id]);
    if (!part) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy linh kiện.");
    const compatibility = await tx.q(
      `SELECT c.id, c.brand_id AS "brandId", b.name AS "brandName", c.model_id AS "modelId", m.name AS "modelName", c.note
       FROM public.part_compatibility c JOIN public.brands b ON b.id = c.brand_id LEFT JOIN public.watch_models m ON m.id = c.model_id
       WHERE c.part_id = $1 ORDER BY b.name, m.name`, [params.id]);
    return { ...part, compatibility };
  });
});

const COLS: Record<string, string> = { code: "code", name: "name", categoryId: "category_id", uom: "uom", specs: "specs", salePrice: "sale_price_vnd",
  reorderLevel: "reorder_level", isActive: "is_active" };

export const PATCH = api({ perm: "part.manage", body: PartBody.partial() }, async ({ req, params, body, db }) => {
  return db(async (tx) => {
    const sets: string[] = [];
    const p: unknown[] = [params.id];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || !COLS[k]) continue;
      p.push(v);
      sets.push(`${COLS[k]} = $${p.length}`);
    }
    if (sets.length) {
      const ver = req.headers.get("if-match");
      p.push(ver ? Number(ver) : null);
      const r = await tx.one(`UPDATE public.parts SET ${sets.join(", ")} WHERE id = $1 AND ($${p.length}::int IS NULL OR version = $${p.length}) RETURNING id`, p);
      if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Linh kiện vừa được người khác sửa hoặc không tồn tại. Hãy tải lại.");
    }
    if (body.compatibility) {
      await tx.q("DELETE FROM public.part_compatibility WHERE part_id = $1", [params.id]);
      for (const x of body.compatibility) {
        await tx.q("INSERT INTO public.part_compatibility (part_id, brand_id, model_id, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [params.id, x.brandId, x.modelId ?? null, x.note ?? null]);
      }
    }
    return { ok: true };
  });
});
