// M4 — Nhập hàng & giá vốn: SC-01 (phân bổ vận chuyển → giá vốn), SC-11 e (bình quân linh kiện), SC-17 a/d/e (hủy phiếu, điều chỉnh giá vốn),
// CT-07 (xác nhận 2 lần cùng khóa), CT-09 (hai phiếu cùng serial song song), PT-01 phần phiếu nhập, BR-PUR-09 (thu mua cần giấy tờ), BR-PUR-01.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, asUser, userOf, expectWf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, wh, sales, ids;
const DAY = "2026-11-02";

test("chuẩn bị", async () => {
  [owner, wh, sales] = await Promise.all([login("owner"), login("warehouse"), login("sales")]);
  for (const c of [owner, wh, sales]) c.today = DAY;
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  const p = await ownerSql("SELECT code, id FROM public.parts");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])), p: Object.fromEntries(p.map((r) => [r.code, r.id])) };
});

const watch = (model, serial, price, extra = {}) => ({ lineType: "watch", modelId: ids.m[model], serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], unitPrice: price, ...extra });

test("SC-01: 3 chiếc + vận chuyển 120.000 ⇒ phân bổ 60.000/12.000/48.000; giá vốn 6.060.000/1.212.000/4.848.000", async () => {
  const body = { kind: "purchase", sourceName: "Cửa hàng ABC", docDate: DAY, lines: [watch("SEIKO-5-SRPD55", "SK-A-001", 6_000_000), watch("CASIO-MTP-V001", "CS-B-001", 1_200_000), watch("ORIENT-BAMBINO-V2", "OR-C-001", 4_800_000)],
    costs: [{ kind: "shipping", amount: 120_000, allocateMethod: "by_value" }] };
  const d = await wh.post("/api/v1/purchases", body);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const draft = await wh.get(`/api/v1/purchases/${d.body.id}`);
  assert.equal(draft.body.grandTotal, 12_120_000);
  assert.deepEqual(draft.body.lines.map((l) => l.allocatedCost), [60_000, 12_000, 48_000]);
  const key = K();
  const [c1, c2] = await Promise.all([wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, key), wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, key)]);
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.equal(c2.status, 200, JSON.stringify(c2.body));
  assert.deepEqual(c1.body.units, c2.body.units, "CT-07: cùng khóa ⇒ cùng kết quả");
  assert.match(c1.body.code, /^PN-2026-\d{4}$/);
  const units = c1.body.units;
  assert.equal(units.length, 3);
  const costs = [];
  for (const u of units) costs.push((await owner.get(`/api/v1/catalog/units/${u.unitId}/cost`)).body.total);
  assert.deepEqual(costs, [6_060_000, 1_212_000, 4_848_000]);
  for (const u of units) {
    const [s] = await ownerSql("SELECT status, cost_cycle, (SELECT count(*)::int FROM public.unit_status_history h WHERE h.unit_id=u.id AND h.from_status IS NULL AND h.to_status='in_stock') h FROM public.watch_units u WHERE id=$1", [u.unitId]);
    assert.deepEqual([s.status, s.cost_cycle, s.h], ["in_stock", 1, 1]);
  }
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments WHERE doc_id=$1", [d.body.id]))[0].n, 0, "không thanh toán (BR-PUR-06)");
  // Phủ định
  assert.equal((await sales.get(`/api/v1/catalog/units/${units[0].unitId}/cost`)).status, 403);
  assert.equal((await sales.get(`/api/v1/purchases/${d.body.id}`)).status, 403);
  const dup = await wh.post("/api/v1/purchases", { ...body, lines: [watch("SEIKO-5-SRPD55", "sk a 001", 1)], costs: [] });
  assert.equal((await wh.post(`/api/v1/purchases/${dup.body.id}/confirm`, {}, K())).body.code, "WF-UNIT-SERIAL-DUPLICATE");
  const noSrc = await wh.post("/api/v1/purchases", { ...body, sourceName: "", lines: [watch("CASIO-MTP-V001", "CS-NEW-9", 1)], costs: [] });
  assert.equal((await wh.post(`/api/v1/purchases/${noSrc.body.id}/confirm`, {}, K())).body.code, "WF-VALIDATION");
});

test("CT-09: hai phiếu cùng serial xác nhận song song ⇒ đúng 1 thành công", async () => {
  const mk = () => wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Nguồn X", docDate: DAY, lines: [watch("TISSOT-PRX-40", "CT09-SERIAL", 9_000_000)], costs: [] });
  const [a, b] = await Promise.all([mk(), mk()]);
  const [ra, rb] = await Promise.all([wh.post(`/api/v1/purchases/${a.body.id}/confirm`, {}, K()), owner.post(`/api/v1/purchases/${b.body.id}/confirm`, {}, K())]);
  const codes = [ra, rb].map((r) => (r.status === 200 ? "OK" : r.body.code)).sort();
  assert.deepEqual(codes, ["OK", "WF-UNIT-SERIAL-DUPLICATE"]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.watch_units WHERE serial_norm='CT09SERIAL'"))[0].n, 1);
});

test("SC-11 e + SC-17 e: linh kiện bình quân; hủy phiếu khi chưa xuất ⇒ về SL & avg cũ (prev_qty/prev_avg)", async () => {
  // LK-0001: SL 10 @80.000; nhập 10 @90.000 ⇒ avg 85.000, SL 20
  const d = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Kho phụ kiện", docDate: DAY, lines: [{ lineType: "part", partId: ids.p["LK-0001"], qty: 10, unitPrice: 90_000 }], costs: [] });
  const c = await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  let [p] = await ownerSql("SELECT p.qty_on_hand q, pc.avg_cost::text a FROM public.parts p JOIN public.part_costs pc ON pc.part_id=p.id WHERE p.code='LK-0001'");
  assert.deepEqual([p.q, p.a], [20, "85000.0000"]);
  await reauth(owner);
  const v = await owner.post(`/api/v1/purchases/${d.body.id}/void`, { reason: "Nhập nhầm số lượng lô dây da" }, K());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  [p] = await ownerSql("SELECT p.qty_on_hand q, pc.avg_cost::text a FROM public.parts p JOIN public.part_costs pc ON pc.part_id=p.id WHERE p.code='LK-0001'");
  assert.deepEqual([p.q, p.a], [10, "80000.0000"]);
  // SC-11 e: SL 10 @30.000 (LK mới), nhập 10 @36.000 + vận chuyển phân bổ 20.000 ⇒ avg 34.000; xuất 5 ⇒ giá vốn 170.000
  const [cat] = await ownerSql("SELECT id FROM public.part_categories LIMIT 1");
  const np = await wh.post("/api/v1/parts", { code: "LK-SC11E", name: "Kim giây thử", categoryId: cat.id, uom: "cái", salePrice: 0, reorderLevel: 0 });
  const o1 = await wh.post("/api/v1/purchases", { kind: "opening", docDate: DAY, lines: [{ lineType: "part", partId: np.body.id, qty: 10, unitPrice: 30_000 }], costs: [] });
  await wh.post(`/api/v1/purchases/${o1.body.id}/confirm`, {}, K());
  const o2 = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "NCC chữ", docDate: DAY, lines: [{ lineType: "part", partId: np.body.id, qty: 10, unitPrice: 36_000 }], costs: [{ kind: "shipping", amount: 20_000, allocateMethod: "by_value" }] });
  await wh.post(`/api/v1/purchases/${o2.body.id}/confirm`, {}, K());
  [p] = await ownerSql("SELECT p.qty_on_hand q, pc.avg_cost::text a, app.round_vnd(5 * pc.avg_cost) out FROM public.parts p JOIN public.part_costs pc ON pc.part_id=p.id WHERE p.id=$1", [np.body.id]);
  assert.deepEqual([p.q, p.a, p.out], [20, "34000.0000", 170_000]);
  // đã có xuất sau lô ⇒ hủy lô o2 bị chặn
  await wh.post(`/api/v1/parts/${np.body.id}/adjust`, { delta: -5, reason: "Xuất thử cho kiểm tra" }, K());
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/purchases/${o2.body.id}/void`, { reason: "Thử hủy khi đã xuất" }, K())).body.code, "WF-PUR-HAS-DEPENDENTS");
});

test("SC-17 a: hủy phiếu 1 chiếc J ⇒ cancelled, giá vốn đảo về 0, mã không tái dùng; ghi mất trước ⇒ HAS-DEPENDENTS", async () => {
  const d = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Nguồn J", docDate: DAY, lines: [watch("CITIZEN-NH8350", "J-0001", 2_000_000)], costs: [{ kind: "shipping", amount: 40_000 }] });
  const c = await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K());
  const j = c.body.units[0];
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/void`, { reason: "Kho không có quyền hủy" }, K())).status, 403);
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/purchases/${d.body.id}/void`, { reason: "ngắn" }, K())).status, 422);
  const v = await owner.post(`/api/v1/purchases/${d.body.id}/void`, { reason: "Nhập nhầm chiếc không có thật" }, K());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const [u] = await ownerSql("SELECT status, (SELECT sum(amount_vnd) FROM public.unit_cost_entries e WHERE e.unit_id=w.id)::bigint s FROM public.watch_units w WHERE id=$1", [j.unitId]);
  assert.deepEqual([u.status, u.s], ["cancelled", 0]);
  // mã nội bộ không tái dùng: chiếc mới nhận mã lớn hơn
  const d2 = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Nguồn J2", docDate: DAY, lines: [watch("CITIZEN-NH8350", "J-0001", 2_000_000)], costs: [] });
  const c2 = await wh.post(`/api/v1/purchases/${d2.body.id}/confirm`, {}, K());
  assert.equal(c2.status, 200, "serial của chiếc đã hủy được nhập lại");
  assert.ok(c2.body.units[0].assetCode > j.assetCode);
  // chiếc đã ghi mất ⇒ phụ thuộc
  await reauth(owner);
  await owner.post(`/api/v1/catalog/units/${c2.body.units[0].unitId}/writeoff`, { reason: "Mất trong kho khi kiểm" }, K());
  assert.equal((await owner.post(`/api/v1/purchases/${d2.body.id}/void`, { reason: "Thử hủy khi đã ghi mất" }, K())).body.code, "WF-PUR-HAS-DEPENDENTS");
});

test("SC-17 d: điều chỉnh giá vốn +200.000 (owner, lý do); warehouse 403; không âm", async () => {
  const d = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Nguồn M", docDate: DAY, lines: [watch("TISSOT-PRX-40", "M-0001", 5_000_000)], costs: [] });
  const m = (await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).body.units[0];
  assert.equal((await wh.post(`/api/v1/catalog/units/${m.unitId}/cost-adjust`, { amount: 200_000, reason: "phí kiểm định bổ sung" }, K())).status, 403);
  await reauth(owner);
  const r = await owner.post(`/api/v1/catalog/units/${m.unitId}/cost-adjust`, { amount: 200_000, reason: "phí kiểm định bổ sung" }, K());
  assert.equal(r.body.cost, 5_200_000);
  assert.equal((await owner.post(`/api/v1/catalog/units/${m.unitId}/cost-adjust`, { amount: -9_000_000, reason: "thử làm âm giá vốn" }, K())).status, 422);
  const cost = (await owner.get(`/api/v1/catalog/units/${m.unitId}/cost`)).body;
  assert.ok(cost.entries.some((e) => e.kind === "adjustment" && e.reason === "phí kiểm định bổ sung"));
});

test("BR-PUR-09: thu mua từ khách thiếu CCCD/ảnh giấy tờ ⇒ WF-PUR-SELLER-ID-REQUIRED; đủ ⇒ xác nhận", async () => {
  const [binh] = await ownerSql("SELECT id FROM public.customers WHERE full_name='Trần Thị Bình'");
  const body = { kind: "customer_buyback", sellerCustomerId: binh.id, docDate: DAY, lines: [watch("ORIENT-BAMBINO-V2", "BUY-0001", 2_500_000, { condition: "used", initialStatus: "inspecting" })], costs: [] };
  const d = await wh.post("/api/v1/purchases", body);
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).body.code, "WF-PUR-SELLER-ID-REQUIRED");
  await owner.patch(`/api/v1/customers/${binh.id}`, { idNumber: "079188000456" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const up = async (kind) => { const f = new FormData(); f.set("kind", kind); f.set("entityTable", "purchase_receipts"); f.set("entityId", d.body.id); f.set("file", new Blob([png], { type: "image/png" }), "a.png"); return wh.post("/api/v1/files", f); };
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).body.code, "WF-PUR-SELLER-ID-REQUIRED");
  assert.equal((await up("id_document")).status, 200);
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).body.code, "WF-UNIT-PHOTO-REQUIRED");
  assert.equal((await up("condition")).status, 200);
  const ok = await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K());
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const r = (await wh.get(`/api/v1/purchases/${d.body.id}`)).body;
  assert.equal(r.sellerName, "Trần Thị Bình");
});

test("nháp: chỉ người có purchase.create sửa; đã xác nhận không sửa/xóa (WF-DOC-NOT-DRAFT); ngày tương lai ⇒ WF-DOC-FUTURE", async () => {
  const d = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Nháp", docDate: "2026-11-05", lines: [watch("CASIO-LTP-1302", "DR-1", 500_000)], costs: [] });
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).body.code, "WF-DOC-FUTURE");
  assert.equal((await sales.post("/api/v1/purchases", { kind: "purchase", sourceName: "x", lines: [], costs: [] })).status, 403);
  await wh.patch(`/api/v1/purchases/${d.body.id}`, { kind: "purchase", sourceName: "Nháp", docDate: DAY, lines: [watch("CASIO-LTP-1302", "DR-1", 500_000)], costs: [] });
  assert.equal((await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K())).status, 200);
  assert.equal((await wh.patch(`/api/v1/purchases/${d.body.id}`, { kind: "purchase", sourceName: "Sửa", lines: [], costs: [] })).status, 412);
  assert.equal((await wh.del(`/api/v1/purchases/${d.body.id}`)).status, 409);
  await assert.rejects(ownerSql("UPDATE public.purchase_lines SET unit_price_vnd = 1 WHERE receipt_id = $1", [d.body.id]), /WF-DOC-NOT-DRAFT/);
  await assert.rejects(ownerSql("UPDATE public.purchase_receipts SET note = 'x' WHERE id = $1", [d.body.id]), /WF-DOC-NOT-DRAFT/);
});

test("nhập nhanh một chiếc (FR-UNIT-01) + danh sách + xuất Excel (FR-PUR-09/10)", async () => {
  const q = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Khách lẻ mang tới", docDate: DAY, lines: [watch("SEIKO-5-SRPD55", "QUICK-1", 3_000_000, { listPrice: 4_500_000 })], costs: [] }, K());
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.status, "confirmed");
  const list = await wh.get("/api/v1/purchases?status=confirmed&q=khach le");
  assert.ok(list.body.items.some((r) => r.id === q.body.id));
  const x = await wh.req("GET", "/api/v1/purchases/export");
  assert.equal(x.status, 200);
  assert.match(x.headers.get("content-type"), /spreadsheetml/);
});

test("I7–I9 sau các phiếu: tồn LK = Σ movement; mỗi dòng đồng hồ confirmed có unit_id; phiếu voided không còn chiếc in_stock", async () => {
  const i7 = await ownerSql("SELECT p.code FROM public.parts p WHERE p.qty_on_hand <> coalesce((SELECT sum(qty_delta) FROM public.part_stock_movements m WHERE m.part_id=p.id),0)");
  assert.deepEqual(i7, []);
  const i9a = await ownerSql("SELECT l.id FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id=l.receipt_id WHERE r.status='confirmed' AND l.line_type='watch' AND l.unit_id IS NULL");
  assert.deepEqual(i9a, []);
  const i9b = await ownerSql("SELECT u.id FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id=l.receipt_id JOIN public.watch_units u ON u.id=l.unit_id WHERE r.status='voided' AND u.status='in_stock'");
  assert.deepEqual(i9b, []);
  const neg = await asUser(userOf("sales").id, (c) => c.query("SELECT count(*)::int n FROM public.purchase_receipts"));
  assert.equal(neg.rows[0].n, 0, "sales không thấy phiếu nhập ở DB");
  await expectWf(asUser(userOf("sales").id, (c) => c.query("SELECT app.fn_adjust_unit_cost(app.uuid_v7(), 1, 'thử không có quyền')")), "WF-AUTH-FORBIDDEN");
});

test("gợi ý nguồn hàng: GET /purchases/sources — gộp hoa/thường/dấu, mới nhất trước, không lộ tiền; người không có quyền nhập hàng bị 403", async () => {
  const a = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Gợi Ý Nguồn Test", docDate: DAY, lines: [watch("SEIKO-5-SRPD55", "GY-001", 1_000_000)], costs: [] });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const b = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "goi y nguon test", docDate: DAY, lines: [watch("CASIO-MTP-V001", "GY-002", 900_000)], costs: [] });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const r = await wh.get("/api/v1/purchases/sources");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const hit = r.body.items.filter((x) => /goi y nguon test/i.test(x.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")));
  assert.equal(hit.length, 1, "hai cách viết khác hoa/thường/dấu phải gộp thành một gợi ý");
  assert.equal(hit[0].count, 2);
  assert.deepEqual(Object.keys(hit[0]).sort(), ["count", "lastDate", "name"], "chỉ tên + số phiếu + ngày, không có tiền/giá vốn");
  assert.equal((await sales.get("/api/v1/purchases/sources")).status, 403);
});
