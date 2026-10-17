// M1 — Danh mục & kho: ma trận trạng thái (state-machines §1), status không UPDATE trực tiếp (B1), giá vốn chỉ cost.view (PT-01 phần catalog),
// tìm kiếm không dấu/gõ sai nhẹ (FR-UNIT-09), giá & lịch sử (BR-UNIT-05), vị trí (BR-UNIT-08), release BR-UNIT-10, writeoff/restore,
// linh kiện: điều chỉnh tồn có lý do, không âm (BR-PART-01/05), giá vốn bình quân ẩn với người không quyền.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, asUser, userOf, expectWf } from "./_lib.mjs";

const idem = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv;

test("đăng nhập các vai trò", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
});

test("ma trận chuyển trạng thái (DB) khớp state-machines §1", async () => {
  const ok = [["in_stock", "reserved"], ["reserved", "sold"], ["with_collaborator", "sold"], ["sold", "with_collaborator"], ["inspecting", "in_stock"],
    ["in_repair", "inspecting"], ["with_collaborator", "written_off"], ["written_off", "in_stock"], ["inspecting", "cancelled"]];
  const bad = [["reserved", "in_repair"], ["reserved", "with_collaborator"], ["reserved", "written_off"], ["sold", "written_off"],
    ["with_collaborator", "reserved"], ["with_collaborator", "in_repair"], ["cancelled", "in_stock"], ["sold", "reserved"]];
  for (const [a, b] of ok) assert.equal((await ownerSql("SELECT app.unit_transition_allowed($1,$2) v", [a, b]))[0].v, true, `${a}→${b}`);
  for (const [a, b] of bad) assert.equal((await ownerSql("SELECT app.unit_transition_allowed($1,$2) v", [a, b]))[0].v, false, `${a}→${b}`);
});

test("B1: wf_app không UPDATE status/held_by/giá/vị trí; superuser ngoài fn_* cũng bị trigger chặn", async () => {
  const [u] = await ownerSql("SELECT id FROM public.watch_units WHERE status='in_stock' LIMIT 1");
  const o = userOf("owner");
  for (const sql of ["UPDATE public.watch_units SET status='sold' WHERE id=$1", "UPDATE public.watch_units SET held_by_collaborator_id=app.current_user_id() WHERE id=$1",
    "UPDATE public.watch_units SET list_price_vnd=1 WHERE id=$1", "UPDATE public.watch_units SET location_id=NULL WHERE id=$1", "UPDATE public.watch_units SET cost_cycle=9 WHERE id=$1"]) {
    await assert.rejects(asUser(o.id, (c) => c.query(sql, [u.id])), /permission denied/, sql);
  }
  await assert.rejects(ownerSql("UPDATE public.watch_units SET status='sold' WHERE id=$1", [u.id]), /WF-UNIT-INVALID-TRANSITION/);
  await assert.rejects(ownerSql(`INSERT INTO public.watch_units (asset_code, model_id, brand_id, condition, status, location_id)
    SELECT 'DH-X', m.id, m.brand_id, 'new', 'in_stock', (SELECT id FROM public.storage_locations LIMIT 1) FROM public.watch_models m LIMIT 1`), /WF-UNIT-INVALID-TRANSITION/);
});

test("danh sách chiếc: sales KHÔNG có trường cost; owner/warehouse có", async () => {
  const s = await sales.get("/api/v1/catalog/units?status=stock");
  assert.equal(s.status, 200);
  assert.ok(s.body.items.length > 0);
  for (const it of s.body.items) assert.ok(!("cost" in it), "sales thấy cost");
  assert.ok(!JSON.stringify(s.body).match(/"cost/i));
  const o = await owner.get("/api/v1/catalog/units?status=stock");
  assert.ok(o.body.items.every((it) => "cost" in it) && o.body.items.some((it) => it.cost > 0));
  const w = await wh.get("/api/v1/catalog/units");
  assert.ok(w.body.items.some((it) => it.cost > 0));
  const id = s.body.items[0].id;
  assert.equal((await sales.get(`/api/v1/catalog/units/${id}/cost`)).status, 403);
  const oc = await owner.get(`/api/v1/catalog/units/${id}/cost`);
  assert.equal(oc.status, 200);
  assert.ok(oc.body.total > 0);
  // RLS lớp 2: dưới wf_app, sales đọc trực tiếp unit_cost_entries ⇒ 0 dòng
  const r = await asUser(userOf("sales").id, (c) => c.query("SELECT count(*)::int n FROM public.unit_cost_entries"));
  assert.equal(r.rows[0].n, 0);
  const r2 = await asUser(userOf("sales").id, (c) => c.query("SELECT count(*)::int n FROM public.v_unit_costs"));
  assert.equal(r2.rows[0].n, 0);
});

test("CTV không xem được danh mục chiếc của cửa hàng (403) và 0 dòng ở DB", async () => {
  assert.equal((await ctv.get("/api/v1/catalog/units")).status, 403);
  const r = await asUser(userOf("collaborator").id, (c) => c.query("SELECT count(*)::int n FROM public.watch_units"));
  assert.equal(r.rows[0].n, 0);
});

test("tìm kiếm: không dấu, mã nội bộ, serial có gạch/khoảng trắng, gõ sai nhẹ", async () => {
  const q = async (s) => (await sales.get("/api/v1/catalog/units?q=" + encodeURIComponent(s))).body.items;
  assert.ok((await q("bambino")).length >= 1);
  assert.ok((await q("BAMBIN0")).length >= 0); // không lỗi với ký tự lạ
  assert.ok((await q("tissot prx")).some((u) => u.brand.name === "Tissot"));
  assert.ok((await q("tisot")).some((u) => u.brand.name === "Tissot"), "gõ sai nhẹ");
  assert.equal((await q("ctz 551200"))[0]?.serialNo, "CTZ-551200");
  const [one] = await ownerSql("SELECT asset_code FROM public.watch_units ORDER BY asset_code LIMIT 1");
  assert.equal((await q(one.asset_code.toLowerCase()))[0].assetCode, one.asset_code);
  const lk = await sales.get("/api/v1/catalog/units/lookup?code=" + encodeURIComponent(`https://x/units/${one.asset_code}`));
  assert.equal(lk.body.items[0].assetCode, one.asset_code);
});

test("sửa giá: cần unit.price.edit; ghi lịch sử; khuyến mãi theo khoảng ngày", async () => {
  const [u] = await ownerSql("SELECT id, list_price_vnd FROM public.watch_units WHERE status='in_stock' ORDER BY asset_code LIMIT 1");
  assert.equal((await sales.post(`/api/v1/catalog/units/${u.id}/price`, { listPrice: 1 })).status, 403);
  const bad = await owner.post(`/api/v1/catalog/units/${u.id}/price`, { listPrice: 1_000_000, promoPrice: 2_000_000, promoFrom: "2026-01-01", promoTo: "2026-01-31" });
  assert.equal(bad.status, 422);
  const ok = await owner.post(`/api/v1/catalog/units/${u.id}/price`, { listPrice: 9_000_000, promoPrice: 8_500_000, promoFrom: "2000-01-01", promoTo: "2099-12-31", reason: "Điều chỉnh theo giá thị trường" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const d = await sales.get(`/api/v1/catalog/units/${u.id}`);
  assert.equal(d.body.listPrice, 9_000_000);
  assert.equal(d.body.effectivePrice, 8_500_000);
  const h = await sales.get(`/api/v1/catalog/units/${u.id}/history`);
  assert.ok(h.body.prices.some((p) => p.field === "list_price" && p.newValue === "9000000"));
});

test("đổi vị trí: cần location.manage; ghi unit_movements; vị trí không tồn tại ⇒ 422", async () => {
  const [u] = await ownerSql("SELECT id, location_id FROM public.watch_units WHERE status='in_stock' ORDER BY asset_code DESC LIMIT 1");
  const [l] = await ownerSql("SELECT id FROM public.storage_locations WHERE id <> $1 LIMIT 1", [u.location_id]);
  assert.equal((await sales.post(`/api/v1/catalog/units/${u.id}/move`, { locationId: l.id })).status, 403);
  assert.equal((await wh.post(`/api/v1/catalog/units/${u.id}/move`, { locationId: crypto.randomUUID() })).status, 422);
  assert.equal((await wh.post(`/api/v1/catalog/units/${u.id}/move`, { locationId: l.id, note: "Chuyển trưng bày" })).status, 200);
  const h = await wh.get(`/api/v1/catalog/units/${u.id}/history`);
  assert.equal(h.body.movements.length >= 1, true);
});

test("release BR-UNIT-10: hàng cũ thiếu hạng ⇒ WF-UNIT-GRADE-REQUIRED; thiếu ảnh ⇒ WF-UNIT-PHOTO-REQUIRED; đủ ⇒ in_stock", async () => {
  const [u] = await ownerSql("SELECT id FROM public.watch_units WHERE status='inspecting' LIMIT 1");
  const r1 = await wh.post(`/api/v1/catalog/units/${u.id}/release`, {}, idem());
  assert.equal(r1.body.code, "WF-UNIT-GRADE-REQUIRED");
  assert.equal((await wh.patch(`/api/v1/catalog/units/${u.id}`, { conditionGrade: "90%", conditionNote: "Trầy nhẹ mặt kính" })).status, 200);
  const r2 = await wh.post(`/api/v1/catalog/units/${u.id}/release`, {}, idem());
  assert.equal(r2.body.code, "WF-UNIT-PHOTO-REQUIRED");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const f = new FormData();
  f.set("kind", "condition"); f.set("entityTable", "watch_units"); f.set("entityId", u.id);
  f.set("file", new Blob([png], { type: "image/png" }), "tinh-trang.png");
  assert.equal((await wh.post("/api/v1/files", f)).status, 200);
  const r3 = await wh.post(`/api/v1/catalog/units/${u.id}/release`, { note: "Kiểm tra máy chạy tốt" }, idem());
  assert.equal(r3.status, 200, JSON.stringify(r3.body));
  const [s] = await ownerSql("SELECT status, stock_since FROM public.watch_units WHERE id=$1", [u.id]);
  assert.equal(s.status, "in_stock");
  assert.ok(s.stock_since);
  const [h] = await ownerSql("SELECT from_status, to_status, reason FROM public.unit_status_history WHERE unit_id=$1 ORDER BY at DESC LIMIT 1", [u.id]);
  assert.deepEqual([h.from_status, h.to_status], ["inspecting", "in_stock"]);
  // gọi lại ⇒ sai trạng thái
  assert.equal((await wh.post(`/api/v1/catalog/units/${u.id}/release`, {}, idem())).body.code, "WF-UNIT-INVALID-TRANSITION");
});

test("ghi mất/khôi phục: cần stock.writeoff + reauth + lý do ≥ 10; có lịch sử", async () => {
  const [u] = await ownerSql("SELECT id, location_id FROM public.watch_units WHERE status='in_stock' ORDER BY asset_code LIMIT 1 OFFSET 2");
  assert.equal((await wh.post(`/api/v1/catalog/units/${u.id}/writeoff`, { reason: "Mất khi trưng bày" }, idem())).status, 403);
  await ownerSql("UPDATE public.auth_sessions SET reauth_at = NULL WHERE user_id=$1", [userOf("owner").id]);
  const r0 = await owner.post(`/api/v1/catalog/units/${u.id}/writeoff`, { reason: "Mất khi trưng bày" }, idem());
  assert.equal(r0.body.code, "WF-SEC-REAUTH");
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/catalog/units/${u.id}/writeoff`, { reason: "ngắn" }, idem())).status, 422);
  assert.equal((await owner.post(`/api/v1/catalog/units/${u.id}/writeoff`, { reason: "Mất khi trưng bày ngày hội chợ" }, idem())).status, 200);
  assert.equal((await owner.post(`/api/v1/catalog/units/${u.id}/restore`, { locationId: u.location_id, reason: "Tìm thấy trong kho sau kiểm kê" }, idem())).status, 200);
  const h = (await owner.get(`/api/v1/catalog/units/${u.id}/history`)).body.status.map((x) => x.to);
  assert.deepEqual(h.slice(0, 2), ["in_stock", "written_off"]);
});

test("sửa serial trùng ⇒ WF-UNIT-SERIAL-DUPLICATE (BR-UNIT-02, chuẩn hóa gạch/khoảng trắng)", async () => {
  const [a, b] = await ownerSql(`SELECT u.id, u.model_id, u.serial_no FROM public.watch_units u JOIN public.watch_models m ON m.id=u.model_id
                                 WHERE m.code='SEIKO-5-SRPD55' AND u.serial_no IS NOT NULL ORDER BY u.asset_code LIMIT 2`);
  const r = await owner.post(`/api/v1/catalog/units/${b.id}/identity`, { modelId: b.model_id, serialNo: a.serial_no.toLowerCase().replace("-", " "), hasSerial: true });
  assert.equal(r.body.code, "WF-UNIT-SERIAL-DUPLICATE");
});

test("danh mục: sales không tạo thương hiệu; warehouse tạo loại + vị trí; mã loại trùng ⇒ 409", async () => {
  assert.equal((await sales.post("/api/v1/catalog/brands", { name: "Rolex" })).status, 403);
  const b = await wh.post("/api/v1/catalog/brands", { name: "Rolex", country: "Thụy Sĩ" });
  assert.equal(b.status, 200);
  const m = await wh.post("/api/v1/catalog/models", { code: "ROLEX-126610", brandId: b.body.id, name: "Rolex Submariner Date", movementType: "automatic" });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal((await wh.post("/api/v1/catalog/models", { code: "rolex-126610", brandId: b.body.id, name: "Trùng" })).status, 409);
  assert.equal((await wh.post("/api/v1/catalog/locations", { name: "Tủ kính 3", kind: "cabinet" })).status, 200);
});

test("linh kiện: sales xem không có avgCost; điều chỉnh cần lý do + quyền; không âm; ghi movement; avg giữ nguyên", async () => {
  const s = await sales.get("/api/v1/parts");
  assert.equal(s.status, 200);
  assert.ok(s.body.items.length >= 3);
  assert.ok(!JSON.stringify(s.body).includes("avgCost"));
  const o = await owner.get("/api/v1/parts?q=kinh sapphire");
  const p = o.body.items.find((x) => x.code === "LK-0002");
  assert.equal(p.avgCost, "250000.0000");
  assert.equal((await sales.post(`/api/v1/parts/${p.id}/adjust`, { delta: -1, reason: "Hỏng khi lắp thử máy" }, idem())).status, 403);
  assert.equal((await wh.post(`/api/v1/parts/${p.id}/adjust`, { delta: -1, reason: "ngắn" }, idem())).status, 422);
  const tooMuch = await wh.post(`/api/v1/parts/${p.id}/adjust`, { delta: -999, reason: "Kiểm đếm thiếu nhiều" }, idem());
  assert.equal(tooMuch.body.code, "WF-SALE-STOCK-INSUFFICIENT");
  const ok = await wh.post(`/api/v1/parts/${p.id}/adjust`, { delta: -1, reason: "Vỡ khi lắp thử máy khách" }, idem());
  assert.equal(ok.status, 200);
  assert.equal(ok.body.qtyOnHand, 4);
  const mv = await wh.get(`/api/v1/parts/${p.id}/movements`);
  assert.equal(mv.body.items[0].qtyDelta, -1);
  assert.equal(mv.body.items[0].unitCost, "250000.0000");
  const [c] = await ownerSql("SELECT avg_cost::text a FROM public.part_costs WHERE part_id=$1", [p.id]);
  assert.equal(c.a, "250000.0000");
  // I7: qty = Σ movements
  const [i7] = await ownerSql("SELECT p.qty_on_hand = (SELECT sum(qty_delta) FROM public.part_stock_movements m WHERE m.part_id=p.id) ok FROM public.parts p WHERE id=$1", [p.id]);
  assert.equal(i7.ok, true);
  // qty không đổi ngoài fn_*
  await assert.rejects(ownerSql("UPDATE public.parts SET qty_on_hand = 100 WHERE id=$1", [p.id]), /WF-IMMUTABLE/);
  // dưới wf_app: không đọc cột unit_cost, part_costs ⇒ 0 dòng với sales
  await assert.rejects(asUser(userOf("warehouse").id, (cn) => cn.query("SELECT unit_cost FROM public.part_stock_movements")), /permission denied/);
  const r = await asUser(userOf("sales").id, (cn) => cn.query("SELECT count(*)::int n FROM public.part_costs"));
  assert.equal(r.rows[0].n, 0);
  await expectWf(asUser(userOf("sales").id, (cn) => cn.query("SELECT * FROM app.fn_part_movement_costs($1)", [p.id])), "WF-AUTH-FORBIDDEN");
});

test("PT-08: unit_status_history / price_history / movements / cost entries bất biến", async () => {
  for (const t of ["unit_status_history", "unit_price_history", "unit_movements", "unit_cost_entries", "part_stock_movements"]) {
    await assert.rejects(ownerSql(`UPDATE public.${t} SET id = id`), /WF-IMMUTABLE/, t);
    await assert.rejects(ownerSql(`DELETE FROM public.${t}`), /WF-IMMUTABLE|violates foreign key/, t);
    await assert.rejects(ownerSql(`TRUNCATE public.${t} CASCADE`), /WF-IMMUTABLE/, t);
  }
});
