// Seed demo danh mục & kho (khớp F0 của golden-scenarios): thương hiệu/loại, vị trí, 3 linh kiện F0; từ M4 chiếc demo và tồn
// linh kiện đầu kỳ được tạo QUA PHIẾU NHẬP THẬT (`opening` → app.fn_confirm_purchase) — build-plan M4 "seed demo chuyển sang qua phiếu nhập thật".
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BRANDS = [["Seiko", "Nhật Bản"], ["Casio", "Nhật Bản"], ["Orient", "Nhật Bản"], ["Citizen", "Nhật Bản"], ["Tissot", "Thụy Sĩ"]];
const MODELS = [
  ["SEIKO-5-SRPD55", "Seiko", "Seiko 5 Sports SRPD55", "SRPD55K1", "4R36", "automatic", 42.5, "Thép không gỉ", "Thép", "Đen", "Hardlex", 100, "male"],
  ["CASIO-MTP-V001", "Casio", "Casio MTP-V001L", "MTP-V001L-1B", "—", "quartz", 38, "Thép", "Da", "Đen", "Khoáng", 30, "male"],
  ["ORIENT-BAMBINO-V2", "Orient", "Orient Bambino Version 2", "FAC00009N0", "F6724", "automatic", 40.5, "Thép không gỉ", "Da", "Trắng", "Khoáng cong", 30, "male"],
  ["CITIZEN-NH8350", "Citizen", "Citizen NH8350-83L", "NH8350-83L", "8200", "automatic", 40, "Thép không gỉ", "Thép", "Xanh", "Khoáng", 50, "male"],
  ["TISSOT-PRX-40", "Tissot", "Tissot PRX 40mm", "T137.410.11.051.00", "ETA F06.115", "quartz", 40, "Thép không gỉ", "Thép", "Xanh", "Sapphire", 100, "male"],
  ["CASIO-LTP-1302", "Casio", "Casio LTP-1302D", "LTP-1302D-7A1", "—", "quartz", 25, "Thép", "Thép", "Trắng", "Khoáng", 30, "female"],
];
const LOCATIONS = [["Tủ trưng bày 1", "display"], ["Két", "safe"], ["Tủ trưng bày 2", "display"], ["Xưởng", "workshop"]];
// [mã loại, serial, tình trạng, hạng, trạng thái ban đầu, vị trí, giá niêm yết, giá vốn]
const UNITS = [
  ["SEIKO-5-SRPD55", "S5D-100001", "new", null, "in_stock", "Tủ trưng bày 1", 8_200_000, 6_000_000],
  ["SEIKO-5-SRPD55", "S5D-100002", "new", null, "in_stock", "Tủ trưng bày 1", 8_200_000, 6_000_000],
  ["CASIO-MTP-V001", "CMT-220011", "new", null, "in_stock", "Tủ trưng bày 2", 1_200_000, 800_000],
  ["ORIENT-BAMBINO-V2", "ORB-778899", "new", null, "in_stock", "Tủ trưng bày 1", 4_900_000, 3_600_000],
  ["CITIZEN-NH8350", "CTZ-551200", "used", "A", "in_stock", "Két", 5_500_000, 3_900_000],
  ["TISSOT-PRX-40", "TPX-990001", "new", null, "in_stock", "Két", 11_500_000, 8_900_000],
  ["CASIO-LTP-1302", "CLT-130201", "new", null, "in_stock", "Tủ trưng bày 2", 900_000, 600_000],
  ["SEIKO-5-SRPD55", null, "used", null, "inspecting", "Xưởng", 6_500_000, 4_200_000],
  ["ORIENT-BAMBINO-V2", "ORB-112233", "refurbished", "B", "in_stock", "Tủ trưng bày 2", 3_900_000, 2_700_000],
];
// F0: tồn đầu kỳ 3 linh kiện (CQ-008: tổng 2.750.000)
const PARTS = [
  ["LK-0001", "Dây da 20mm", "Dây", "sợi", 150_000, 0, 10, 80_000],
  ["LK-0002", "Kính sapphire 36mm", "Kính sapphire", "cái", 450_000, 2, 5, 250_000],
  ["LK-0003", "Ron chống nước", "Ron", "cái", 0, 0, 20, 35_000],
];
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export default async function (c, ctx) {
  const owner = ctx.accounts.users.find((u) => u.role === "owner").id;
  await c.query("SELECT set_config('app.current_user_id',$1,true)", [owner]);
  const brand = {}, model = {}, loc = {};
  for (const [name, country] of BRANDS) {
    const r = await c.query(`INSERT INTO public.brands (name, country) VALUES ($1,$2) ON CONFLICT (lower(name)) DO UPDATE SET country = EXCLUDED.country RETURNING id`, [name, country]);
    brand[name] = r.rows[0].id;
  }
  for (const [code, b, name, ref, cal, mv, size, mat, strap, dial, glass, wr, gender] of MODELS) {
    const r = await c.query(`INSERT INTO public.watch_models (code, brand_id, name, reference_no, caliber, movement_type, case_size_mm, case_material, strap_type, dial_color, glass_type, water_resistance_m, gender, origin_country)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Nhật Bản') ON CONFLICT (upper(code)) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [code, brand[b], name, ref, cal, mv, size, mat, strap, dial, glass, wr, gender]);
    model[code] = r.rows[0].id;
  }
  for (const [name, kind] of LOCATIONS) {
    const r = await c.query(`INSERT INTO public.storage_locations (name, kind) VALUES ($1,$2) ON CONFLICT (lower(name)) DO UPDATE SET kind = EXCLUDED.kind RETURNING id`, [name, kind]);
    loc[name] = r.rows[0].id;
  }
  const cat = Object.fromEntries((await c.query("SELECT name, id FROM public.part_categories")).rows.map((r) => [r.name, r.id]));
  const partIds = {};
  for (const [code, name, catName, uom, sale, reorder] of PARTS) {
    const r = await c.query(`INSERT INTO public.parts (code, name, category_id, uom, sale_price_vnd, reorder_level) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (upper(code)) DO UPDATE SET name = EXCLUDED.name RETURNING id, qty_on_hand`, [code, name, cat[catName], uom, sale, reorder]);
    partIds[code] = r.rows[0];
  }
  if ((await c.query("SELECT count(*)::int n FROM public.purchase_receipts WHERE kind='opening'")).rows[0].n > 0) return;

  // Phiếu tồn đầu kỳ (opening) — linh kiện + chiếc demo; một ảnh tình trạng cho hàng cũ sẵn sàng bán (BR-UNIT-10)
  const rec = (await c.query(`INSERT INTO public.purchase_receipts (kind, note, received_by, created_by) VALUES ('opening','Tồn đầu kỳ (dữ liệu demo)',$1,$1) RETURNING id`, [owner])).rows[0].id;
  let no = 0;
  for (const [code, , , , , , qty, avg] of PARTS) {
    await c.query(`INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, part_id, qty, unit_price_vnd) VALUES ($1,$2,'part',$3,$4,$5)`, [rec, ++no, partIds[code].id, qty, avg]);
  }
  for (const [m, serial, cond, grade, status, l, price, cost] of UNITS) {
    await c.query(`INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, model_id, serial_no, has_serial, condition, condition_grade, initial_status, location_id, list_price_vnd, unit_price_vnd)
      VALUES ($1,$2,'watch',$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [rec, ++no, model[m], serial, serial !== null, cond, grade, status, loc[l], price, cost]);
  }
  const rel = `seed/${crypto.randomUUID()}.png`;
  const dir = path.join(process.cwd(), ".local", "storage", "unit-photos", "seed");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), ".local", "storage", "unit-photos", rel), PNG_1PX);
  await c.query(`INSERT INTO public.files (bucket, path, original_name, mime, size_bytes, sha256, kind, entity_table, entity_id, created_by)
    VALUES ('unit-photos',$1,'tinh-trang-demo.png','image/png',$2,$3,'condition','purchase_receipts',$4,$5)`,
    [rel, PNG_1PX.length, crypto.createHash("sha256").update(PNG_1PX).digest("hex"), rec, owner]);
  const r = await c.query("SELECT app.fn_confirm_purchase($1) AS r", [rec]);
  ctx.log?.(`  phiếu tồn đầu kỳ ${r.rows[0].r.code}: ${r.rows[0].r.units.length} chiếc`);
}
