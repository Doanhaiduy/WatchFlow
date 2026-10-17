// M6 — Sửa chữa gọn: SC-07 (bảo hành miễn phí), SC-08 (+8b), SC-09 (sửa nội bộ vốn hóa rồi bán), CT-04 (dùng linh kiện còn 1), PT-04,
// hủy phiếu hoàn linh kiện & cọc (BR-REP-15), lịch sử theo serial (BR-REP-13), I12.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, asUser, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ids, KH, ST;
const partQty = async (code) => (await ownerSql("SELECT qty_on_hand q FROM public.parts WHERE code=$1", [code]))[0].q;

test("chuẩn bị", async () => {
  [owner, sales, wh] = await Promise.all([login("owner"), login("sales"), login("warehouse")]);
  wh.today = "2026-11-01";
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  const p = await ownerSql("SELECT code, id FROM public.parts");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])), p: Object.fromEntries(p.map((r) => [r.code, r.id])) };
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
  ST = Object.fromEntries((await ownerSql("SELECT code, id FROM public.service_types")).map((r) => [r.code, r.id]));
});

const addLine = (oid, body) => owner.post(`/api/v1/repairs/${oid}/lines`, body);

test("PT-04: sales/warehouse/CTV không đọc/ghi phiếu sửa; không có API thợ", async () => {
  assert.equal((await sales.get("/api/v1/repairs")).status, 403);
  assert.equal((await wh.post("/api/v1/repairs", { kind: "customer", customerId: KH["Nguyễn Văn An"], brandText: "Casio", complaint: "x" }, K())).status, 403);
  const r = await asUser(userOf("sales").id, (c) => c.query("SELECT count(*)::int n FROM public.repair_orders"));
  assert.equal(r.rows[0].n, 0);
  assert.equal((await owner.get("/api/v1/technicians")).status, 404);
});

test("SC-08: nhận máy KH-A cọc 200k, không ảnh; 3 dòng 900k; dùng linh kiện; giao 700k CK ⇒ doanh thu 900k, giá vốn LK 330k, lãi 570k, BH 90 ngày", async () => {
  owner.today = "2026-11-04";
  const before = [await partQty("LK-0001"), await partQty("LK-0002")];
  const noPhone = await owner.post("/api/v1/customers", { fullName: "Khách không SĐT", force: true });
  assert.equal((await owner.post("/api/v1/repairs", { customerId: noPhone.body.id, brandText: "Casio", complaint: "chạy chậm" }, K())).body.code, "WF-VALIDATION");
  const r = await owner.post("/api/v1/repairs", { kind: "customer", customerId: KH["Nguyễn Văn An"], brandText: "Casio", serialNo: "CS-9999",
    intakeCondition: "trầy kính, dây mòn", complaint: "chạy chậm", deposit: { method: "cash", amount: 200_000 } }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.code, /^SC-2026-\d{4}$/);
  const oid = r.body.id;
  await owner.post(`/api/v1/repairs/${oid}/status`, { to: "inspecting" });
  await owner.post(`/api/v1/repairs/${oid}/status`, { to: "repairing" });
  assert.equal((await addLine(oid, { lineType: "service", serviceTypeId: ST.bao_duong })).status, 200);
  const l1 = await addLine(oid, { lineType: "part", partId: ids.p["LK-0001"], qty: 1 });
  const l2 = await addLine(oid, { lineType: "part", partId: ids.p["LK-0002"], qty: 1 });
  const d = (await owner.get(`/api/v1/repairs/${oid}`)).body;
  assert.equal(d.linesTotal, 900_000);
  assert.equal(d.held, 200_000);
  assert.equal((await owner.post(`/api/v1/repairs/${oid}/lines/${l1.body.id}/consume`, {})).status, 200);
  assert.equal((await owner.post(`/api/v1/repairs/${oid}/lines/${l2.body.id}/consume`, {})).status, 200);
  assert.deepEqual([await partQty("LK-0001"), await partQty("LK-0002")], [before[0] - 1, before[1] - 1]);
  const c = await owner.post(`/api/v1/repairs/${oid}/complete`, {}, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.finalTotal, 900_000);
  assert.equal((await addLine(oid, { lineType: "other", description: "thêm sau khóa", unitPrice: 0 })).body.code, "WF-REP-LOCKED");
  owner.today = "2026-11-08";
  const dl = await owner.post(`/api/v1/repairs/${oid}/deliver`, { payments: [{ method: "bank_transfer", amount: 700_000 }] }, K());
  assert.equal(dl.status, 200, JSON.stringify(dl.body));
  assert.equal(dl.body.due, 0);
  const f = (await owner.get(`/api/v1/repairs/${oid}`)).body;
  assert.deepEqual([f.status, f.revenue, f.partsCost, f.grossProfit], ["delivered", 900_000, 330_000, 570_000]);
  assert.deepEqual([f.warranty.startDate, f.warranty.endDate], ["2026-11-08", "2027-02-06"]);
  assert.deepEqual(f.payments.map((p) => [p.method, p.amount, p.docDate]), [["cash", 200_000, "2026-11-04"], ["bank_transfer", 700_000, "2026-11-08"]]);
  const hist = (await owner.get("/api/v1/repairs/by-serial?serial=cs 9999")).body.items;
  assert.ok(hist.some((x) => x.id === oid));
});

test("SC-08b: thay pin 100k + pin 40k (bq 15k) ⇒ doanh thu 140k, giá vốn 15k, lãi 125k", async () => {
  owner.today = wh.today = "2026-11-08";
  const [cat] = await ownerSql("SELECT id FROM public.part_categories WHERE name='Pin'");
  const pin = await wh.post("/api/v1/parts", { code: "LK-0004", name: "Pin SR626SW", categoryId: cat.id, uom: "viên", salePrice: 40_000, reorderLevel: 5 });
  const o = await wh.post("/api/v1/purchases", { kind: "opening", docDate: "2026-11-08", lines: [{ lineType: "part", partId: pin.body.id, qty: 50, unitPrice: 15_000 }], costs: [] });
  await wh.post(`/api/v1/purchases/${o.body.id}/confirm`, {}, K());
  const r = await owner.post("/api/v1/repairs", { customerId: KH["Trần Thị Bình"], brandText: "Citizen", complaint: "hết pin" }, K());
  await addLine(r.body.id, { lineType: "service", serviceTypeId: ST.thay_pin });
  await addLine(r.body.id, { lineType: "part", partId: pin.body.id, qty: 1 });
  await owner.post(`/api/v1/repairs/${r.body.id}/complete`, {}, K());   // tự xác nhận dùng linh kiện còn lại
  await owner.post(`/api/v1/repairs/${r.body.id}/deliver`, { payments: [{ method: "cash", amount: 140_000 }] }, K());
  const f = (await owner.get(`/api/v1/repairs/${r.body.id}`)).body;
  assert.deepEqual([f.revenue, f.partsCost, f.grossProfit], [140_000, 15_000, 125_000]);
  assert.equal(await partQty("LK-0004"), 49);
});

test("CT-04: hai phiên dùng linh kiện chỉ còn 1 ⇒ 1 thành công, tồn 0 không âm", async () => {
  owner.today = wh.today = "2026-11-08";
  const [cat] = await ownerSql("SELECT id FROM public.part_categories WHERE name='Khác'");
  const x = await wh.post("/api/v1/parts", { code: "LK-CT04", name: "Chốt hiếm", categoryId: cat.id, uom: "cái", salePrice: 50_000, reorderLevel: 0 });
  const o = await wh.post("/api/v1/purchases", { kind: "opening", docDate: "2026-11-08", lines: [{ lineType: "part", partId: x.body.id, qty: 1, unitPrice: 20_000 }], costs: [] });
  await wh.post(`/api/v1/purchases/${o.body.id}/confirm`, {}, K());
  const mk = async () => { const r = await owner.post("/api/v1/repairs", { customerId: KH["Trần Thị Bình"], brandText: "Orient", complaint: "gãy chốt" }, K());
    const l = await addLine(r.body.id, { lineType: "part", partId: x.body.id, qty: 1 }); return [r.body.id, l.body.id]; };
  const [a, b] = await Promise.all([mk(), mk()]);
  const [r1, r2] = await Promise.all([owner.post(`/api/v1/repairs/${a[0]}/lines/${a[1]}/consume`, {}), owner.post(`/api/v1/repairs/${b[0]}/lines/${b[1]}/consume`, {})]);
  const codes = [r1, r2].map((r) => (r.status === 200 ? "OK" : r.body.code)).sort();
  assert.deepEqual(codes, ["OK", "WF-REP-PART-INSUFFICIENT"]);
  assert.equal(await partQty("LK-CT04"), 0);
});

test("hủy phiếu (BR-REP-15): hoàn linh kiện đã dùng + hoàn cọc; dòng giá vốn đảo về 0", async () => {
  owner.today = "2026-11-08";
  const q0 = await partQty("LK-0003");
  const r = await owner.post("/api/v1/repairs", { customerId: KH["Nguyễn Văn An"], brandText: "Seiko", complaint: "vào nước", deposit: { method: "cash", amount: 300_000 } }, K());
  const l = await addLine(r.body.id, { lineType: "part", partId: ids.p["LK-0003"], qty: 2 });
  await owner.post(`/api/v1/repairs/${r.body.id}/lines/${l.body.id}/consume`, {});
  assert.equal(await partQty("LK-0003"), q0 - 2);
  const c = await owner.post(`/api/v1/repairs/${r.body.id}/cancel`, { reason: "Khách đổi ý không sửa nữa" }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.refunded, 300_000);
  assert.equal(await partQty("LK-0003"), q0);
  const [s] = await ownerSql("SELECT sum(c.cost_vnd)::bigint s FROM public.repair_line_costs c WHERE c.repair_line_id=$1", [l.body.id]);
  assert.equal(s.s, 0);
  const b = await ownerSql("SELECT held, due FROM public.v_doc_balances WHERE doc_id=$1", [r.body.id]);
  assert.deepEqual([b[0].held, b[0].due], [0, 0]);
});

test("SC-09: sửa nội bộ G (4tr) — LK-0003×2 70k + LK-0001×1 80k + gia công 200k ⇒ giá vốn 4.350.000; bán 6tr ⇒ lãi 1.650.000, BH 3 tháng", async () => {
  wh.today = owner.today = "2026-11-09";
  const g = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper SC09", docDate: "2026-11-09", lines: [{ lineType: "watch", modelId: ids.m["CITIZEN-NH8350"],
    serialNo: "SC09-G", hasSerial: true, condition: "used", conditionGrade: "B", initialStatus: "inspecting", locationId: ids.l["Xưởng"], listPrice: 6_000_000, unitPrice: 4_000_000 }], costs: [] }, K());
  const G = g.body.units[0];
  const r = await owner.post("/api/v1/repairs", { kind: "internal", unitId: G.unitId }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [G.unitId]))[0].status, "in_repair");
  await addLine(r.body.id, { lineType: "part", partId: ids.p["LK-0003"], qty: 2 });
  await addLine(r.body.id, { lineType: "part", partId: ids.p["LK-0001"], qty: 1 });
  await addLine(r.body.id, { lineType: "other", description: "Gia công ngoài", unitPrice: 200_000 });
  const c = await owner.post(`/api/v1/repairs/${r.body.id}/complete`, { unitStatus: "in_stock", condition: "refurbished", grade: "A" }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const cost = (await owner.get(`/api/v1/catalog/units/${G.unitId}/cost`)).body;
  assert.equal(cost.total, 4_350_000);
  assert.ok(cost.entries.some((e) => e.kind === "repair_part" && e.amount === 150_000));
  assert.ok(cost.entries.some((e) => e.kind === "repair_other" && e.amount === 200_000));
  const det = (await owner.get(`/api/v1/repairs/${r.body.id}`)).body;
  assert.deepEqual([det.status, det.revenue], ["completed", 0]);
  const s = await owner.post("/api/v1/sales", { customerId: KH["Trần Thị Bình"], lines: [{ lineType: "watch", unitId: G.unitId, unitPrice: 6_000_000 }], orderDiscount: 0, tradeIns: [] });
  const sc = await owner.post(`/api/v1/sales/${s.body.id}/confirm`, { payments: [{ method: "cash", amount: 6_000_000 }] }, K());
  assert.equal(sc.status, 200, JSON.stringify(sc.body));
  const sd = (await owner.get(`/api/v1/sales/${s.body.id}`)).body;
  assert.equal(sd.grossProfit, 1_650_000);
  assert.deepEqual([sd.warranties[0].startDate, sd.warranties[0].endDate], ["2026-11-09", "2027-02-09"]);
});

test("SC-07: bảo hành — nhận máy bảo hành (warranty_free) dùng dây da ⇒ doanh thu 0, chi phí BH 80k; hết hạn ⇒ WF-WAR-EXPIRED; sales 403", async () => {
  owner.today = wh.today = "2026-11-03";
  const A = (await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper SC07", docDate: "2026-11-01", lines: [{ lineType: "watch", modelId: ids.m["SEIKO-5-SRPD55"],
    serialNo: "SK-A-SC07", hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], listPrice: 8_500_000, unitPrice: 6_060_000 }], costs: [] }, K())).body.units[0];
  const s = await owner.post("/api/v1/sales", { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: A.unitId, unitPrice: 8_200_000 }], orderDiscount: 0, tradeIns: [] });
  await owner.post(`/api/v1/sales/${s.body.id}/confirm`, { payments: [{ method: "cash", amount: 8_200_000 }] }, K());
  owner.today = "2026-11-20";
  const w = (await owner.get("/api/v1/warranties?q=sk-a-sc07")).body.items[0];
  assert.equal(w.effectiveStatus, "active");
  assert.equal(w.endDate, "2027-11-03");
  assert.equal((await sales.post(`/api/v1/warranties/${w.id}/open-repair`, { complaint: "đứt dây" }, K())).status, 403);
  const q0 = await partQty("LK-0001");
  const r = await owner.post(`/api/v1/warranties/${w.id}/open-repair`, { complaint: "đứt dây" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const l = await addLine(r.body.id, { lineType: "part", partId: ids.p["LK-0001"], qty: 1, unitPrice: 0 });
  assert.equal(l.status, 200, JSON.stringify(l.body));
  await owner.post(`/api/v1/repairs/${r.body.id}/complete`, {}, K());
  const dl = await owner.post(`/api/v1/repairs/${r.body.id}/deliver`, { payments: [] }, K());
  assert.equal(dl.status, 200, JSON.stringify(dl.body));
  const d = (await owner.get(`/api/v1/repairs/${r.body.id}`)).body;
  assert.deepEqual([d.chargeMode, d.revenue, d.partsCost, d.grossProfit, d.payments.length], ["warranty_free", 0, 80_000, -80_000, 0]);
  assert.equal(await partQty("LK-0001"), q0 - 1);
  assert.equal((await owner.get(`/api/v1/sales/${s.body.id}`)).body.grossProfit, 8_200_000 - 6_060_000, "lãi bán hàng không đổi (BR-COST-03)");
  owner.today = "2027-11-10";
  assert.equal((await owner.post(`/api/v1/warranties/${w.id}/open-repair`, { complaint: "lại lỗi" }, K())).body.code, "WF-WAR-EXPIRED");
});

test("I12: phiếu giao có doanh thu = Σ dòng (tính phí) hoặc 0 (bảo hành/nội bộ); thanh toán phiếu sửa không vượt", async () => {
  assert.deepEqual(await ownerSql(`SELECT o.id FROM public.repair_orders o WHERE o.status='delivered' AND o.revenue_vnd <>
     CASE WHEN o.kind='customer' AND o.charge_mode='paid' THEN (SELECT coalesce(sum(line_total_vnd),0) FROM public.repair_lines WHERE order_id=o.id) ELSE 0 END`), []);
  assert.deepEqual(await ownerSql("SELECT doc_id FROM public.v_doc_balances WHERE doc_type='repair' AND (due < 0 OR held < 0)"), []);
  await assert.rejects(ownerSql("UPDATE public.repair_status_history SET reason='x'"), /WF-IMMUTABLE/);
  await assert.rejects(ownerSql("DELETE FROM public.repair_line_costs"), /WF-IMMUTABLE/);
});
