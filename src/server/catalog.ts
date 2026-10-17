import "server-only";
// Truy vấn đọc module catalog: DTO chiếc đồng hồ. Trường giá vốn CHỈ có khi người gọi có cost.view (BR-SEC-02) —
// không "xóa ở client": SQL không chọn cột khi không có quyền, RLS unit_cost_entries là lớp chặn thứ hai.
import type { Tx } from "./db";
import type { z } from "zod";
import type { UnitListQuery } from "@/lib/types/catalog";

export type UnitDto = {
  id: string;
  assetCode: string;
  status: string;
  condition: string;
  conditionGrade: string | null;
  conditionNote?: string | null;
  serialNo: string | null;
  hasSerial: boolean;
  model: { id: string; code: string; name: string; referenceNo: string | null };
  brand: { id: string; name: string };
  location: { id: string; name: string } | null;
  heldBy: { id: string; name: string | null } | null;
  listPrice: number;
  promoPrice: number | null;
  promoFrom: string | null;
  promoTo: string | null;
  effectivePrice: number;
  stockSince: string | null;
  daysInStock: number | null;
  thumbUrl: string | null;
  version: number;
  cost?: number | null;
};

const SELECT_UNIT = (withCost: boolean) => `
  SELECT u.id, u.asset_code, u.status, u.condition, u.condition_grade, u.condition_note, u.serial_no, u.has_serial,
         u.list_price_vnd, u.promo_price_vnd, u.promo_from::text, u.promo_to::text, u.stock_since::text, u.version,
         app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS effective_price,
         CASE WHEN u.status = 'in_stock' AND u.stock_since IS NOT NULL THEN app.today_vn() - u.stock_since END AS days_in_stock,
         m.id AS model_id, m.code AS model_code, m.name AS model_name, m.reference_no,
         b.id AS brand_id, b.name AS brand_name, l.id AS location_id, l.name AS location_name,
         u.held_by_collaborator_id, CASE WHEN u.held_by_collaborator_id IS NOT NULL THEN app.user_display_name(u.held_by_collaborator_id) END AS holder_name,
         (SELECT f.id FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted
            ORDER BY f.created_at LIMIT 1) AS photo_id
         ${withCost ? ", (SELECT c.cost_vnd FROM public.v_unit_costs c WHERE c.unit_id = u.id) AS cost_vnd" : ""}
  FROM public.watch_units u
  JOIN public.watch_models m ON m.id = u.model_id
  JOIN public.brands b ON b.id = u.brand_id
  LEFT JOIN public.storage_locations l ON l.id = u.location_id`;

type Row = Record<string, unknown>;
export function toUnitDto(r: Row, withCost: boolean): UnitDto {
  const d: UnitDto = {
    id: r.id as string,
    assetCode: r.asset_code as string,
    status: r.status as string,
    condition: r.condition as string,
    conditionGrade: (r.condition_grade as string) ?? null,
    conditionNote: (r.condition_note as string) ?? null,
    serialNo: (r.serial_no as string) ?? null,
    hasSerial: r.has_serial as boolean,
    model: { id: r.model_id as string, code: r.model_code as string, name: r.model_name as string, referenceNo: (r.reference_no as string) ?? null },
    brand: { id: r.brand_id as string, name: r.brand_name as string },
    location: r.location_id ? { id: r.location_id as string, name: r.location_name as string } : null,
    heldBy: r.held_by_collaborator_id ? { id: r.held_by_collaborator_id as string, name: (r.holder_name as string) ?? null } : null,
    listPrice: r.list_price_vnd as number,
    promoPrice: (r.promo_price_vnd as number) ?? null,
    promoFrom: (r.promo_from as string) ?? null,
    promoTo: (r.promo_to as string) ?? null,
    effectivePrice: r.effective_price as number,
    stockSince: (r.stock_since as string) ?? null,
    daysInStock: (r.days_in_stock as number) ?? null,
    thumbUrl: r.photo_id ? `/api/v1/files/${r.photo_id}/thumb` : null,
    version: r.version as number,
  };
  if (withCost) d.cost = (r.cost_vnd as number) ?? null;
  return d;
}

export const STOCK_STATUSES = ["in_stock", "reserved", "with_collaborator", "in_repair", "inspecting"];

export async function listUnits(tx: Tx, q: z.infer<typeof UnitListQuery>, withCost: boolean) {
  const conds: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, ...vals: unknown[]) => {
    let s = sql;
    for (const v of vals) { p.push(v); s = s.replace("?", "$" + p.length); }
    conds.push(s);
  };
  if (q.status) {
    const sts = q.status === "stock" ? STOCK_STATUSES : q.status.split(",").map((s) => s.trim()).filter(Boolean);
    add("u.status = ANY(?)", sts);
  }
  if (q.brandId) add("u.brand_id = ?", q.brandId);
  if (q.modelId) add("u.model_id = ?", q.modelId);
  if (q.locationId) add("u.location_id = ?", q.locationId);
  if (q.condition) add("u.condition = ?", q.condition);
  if (q.aging) conds.push("u.status = 'in_stock' AND app.today_vn() - u.stock_since > app.setting_int('inventory.aging_days', 90)");
  let order = { "-created_at": "u.created_at DESC", price: "effective_price ASC", "-price": "effective_price DESC", asset_code: "u.asset_code",
    "-stock_since": "u.stock_since DESC NULLS LAST", stock_since: "u.stock_since ASC NULLS LAST" }[q.sort];
  if (q.q) {
    // Tìm không dấu + gõ sai nhẹ (pg_trgm word_similarity); mã nội bộ/serial khớp đầu được ưu tiên
    p.push(q.q);
    const i = p.length;
    conds.push(`(u.search_text LIKE '%' || app.norm_text($${i}) || '%' OR app.norm_text($${i}) <% u.search_text
                 OR u.serial_norm = app.norm_serial($${i}))`);
    order = `coalesce(upper(u.asset_code) = upper($${i}) OR u.serial_norm = app.norm_serial($${i}), false) DESC,word_similarity(app.norm_text($${i}), u.search_text) DESC, ${order}`;
  }
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  const rows = await tx.q(`${SELECT_UNIT(withCost)} ${where} ORDER BY ${order} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`, p);
  const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.watch_units u ${where}`, p))?.n ?? 0;
  const counts = await tx.q<{ status: string; n: number }>("SELECT status, count(*)::int n FROM public.watch_units GROUP BY status");
  return { items: rows.map((r) => toUnitDto(r, withCost)), page: q.page, pageSize: q.pageSize, total, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
}

export async function getUnit(tx: Tx, idOrCode: string, withCost: boolean): Promise<UnitDto | null> {
  const isId = /^[0-9a-f-]{36}$/i.test(idOrCode);
  const r = await tx.one(`${SELECT_UNIT(withCost)} WHERE ${isId ? "u.id = $1" : "upper(u.asset_code) = upper($1)"}`, [idOrCode]);
  return r ? toUnitDto(r, withCost) : null;
}

/** Tra cứu theo mã nội bộ / serial / nội dung QR (QR chứa mã nội bộ hoặc URL /units/<mã>) */
export async function lookupUnit(tx: Tx, code: string, withCost: boolean) {
  const raw = code.trim();
  const m = /\/units\/([^/?#]+)/.exec(raw);
  const key = m ? decodeURIComponent(m[1]!) : raw;
  const rows = await tx.q(
    `${SELECT_UNIT(withCost)} WHERE upper(u.asset_code) = upper($1) OR u.id::text = $1 OR (u.serial_norm IS NOT NULL AND u.serial_norm = app.norm_serial($1))
     ORDER BY (upper(u.asset_code) = upper($1)) DESC, u.created_at DESC LIMIT 5`,
    [key],
  );
  return rows.map((r) => toUnitDto(r, withCost));
}

export const MODEL_COLS = `m.id, m.code, m.brand_id AS "brandId", b.name AS "brandName", m.name, m.reference_no AS "referenceNo", m.caliber,
  m.movement_type AS "movementType", m.case_size_mm::float AS "caseSizeMm", m.case_material AS "caseMaterial", m.strap_type AS "strapType",
  m.dial_color AS "dialColor", m.glass_type AS "glassType", m.water_resistance_m AS "waterResistanceM", m.gender, m.origin_country AS "originCountry",
  m.description, m.is_active AS "isActive", m.version`;
