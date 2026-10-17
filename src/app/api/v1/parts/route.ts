import { api } from "@/server/http";
import { PartBody, PartListQuery } from "@/lib/types/catalog";

// Danh sách linh kiện; giá vốn bình quân chỉ khi cost.view (BR-SEC-02)
export const GET = api({ perm: "part.view", query: PartListQuery }, async ({ query, db, can }) => {
  const withCost = can("cost.view");
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    if (query.categoryId) { p.push(query.categoryId); c.push(`p.category_id = $${p.length}`); }
    if (query.low) c.push("p.is_active AND p.qty_on_hand <= p.reorder_level");
    if (query.q) { p.push(query.q); c.push(`(p.search_text LIKE '%' || app.norm_text($${p.length}) || '%' OR app.norm_text($${p.length}) <% p.search_text)`); }
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const items = await tx.q(
      `SELECT p.id, p.code, p.name, p.category_id AS "categoryId", pc.name AS "categoryName", p.uom, p.specs, p.sale_price_vnd AS "salePrice",
              p.reorder_level AS "reorderLevel", p.qty_on_hand AS "qtyOnHand", p.is_active AS "isActive", p.version,
              (p.qty_on_hand <= p.reorder_level) AS "isLow"
              ${withCost ? `, (SELECT round(c.avg_cost, 4)::text FROM public.part_costs c WHERE c.part_id = p.id) AS "avgCost"` : ""}
       FROM public.parts p JOIN public.part_categories pc ON pc.id = p.category_id ${where}
       ORDER BY p.is_active DESC, p.name LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.parts p ${where}`, p))?.n ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total };
  });
});

export const POST = api({ perm: "part.manage", body: PartBody }, async ({ body: b, db }) => {
  return db(async (tx) => {
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.parts (code, name, category_id, uom, specs, sale_price_vnd, reorder_level, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, app.current_user_id()) RETURNING id`,
      [b.code, b.name, b.categoryId, b.uom, b.specs ?? null, b.salePrice, b.reorderLevel],
    );
    for (const x of b.compatibility ?? []) {
      await tx.q("INSERT INTO public.part_compatibility (part_id, brand_id, model_id, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [r!.id, x.brandId, x.modelId ?? null, x.note ?? null]);
    }
    return { id: r!.id };
  });
});
