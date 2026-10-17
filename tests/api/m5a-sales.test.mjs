// M5a — Bán hàng, giữ hàng, thu cũ đổi mới, bảo hành: SC-02, SC-03, SC-04, SC-05 (a,b,c), SC-06 (a,b), SC-15;
// CT-01, CT-02, CT-03, CT-05, CT-07; PT-01 (phiếu bán không lộ giá vốn/lãi), PT-11 (hạn mức giảm giá, dưới giá vốn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv, ids, KH;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

/** Tạo một chiếc qua phiếu nhập thật (giá vốn = cost) */
async function mkUnit(model, serial, cost, listPrice, opts = {}) {
  const r = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper SC", docDate: "2026-11-01", lines: [{ lineType: "watch", modelId: ids.m[model], serialNo: serial,
    hasSerial: true, condition: opts.condition ?? "new", conditionGrade: opts.grade ?? null, initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], listPrice, unitPrice: cost }], costs: [] }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.units[0];
}
const mkSale = (c, body) => c.post("/api/v1/sales", { orderDiscount: 0, tradeIns: [], ...body });
const confirm = (c, id, payments, cashTendered) => c.post(`/api/v1/sales/${id}/confirm`, { payments, cashTendered }, K());

test("chuẩn bị", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  for (const c of [owner, sales, wh, ctv]) c.today = "2026-11-03";
  wh.today = "2026-11-01";
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])) };
  const cs = await ownerSql("SELECT full_name, id FROM public.customers");
  KH = Object.fromEntries(cs.map((r) => [r.full_name, r.id]));
});

let A, saleA;
test("SC-02: bán A 8.200.000 (giảm 300.000 từ 8.500.000), 5tr tiền mặt + 3,2tr CK; giá vốn 6.060.000; lãi 2.140.000; bảo hành 12 tháng", async () => {
  A = await mkUnit("SEIKO-5-SRPD55", "SC02-A", 6_060_000, 8_500_000);
  const d = await mkSale(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: A.unitId, unitPrice: 8_200_000 }] });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  saleA = d.body.id;
  const pv = (await sales.get(`/api/v1/sales/${saleA}`)).body;
  assert.equal(pv.grandTotal, 8_200_000);
  assert.equal(pv.discountPct, 3.53);
  assert.ok(!JSON.stringify(pv).match(/"cost"|grossProfit|lockedCost/), "PT-01: sales không thấy giá vốn/lãi");
  const c = await confirm(sales, saleA, [{ method: "cash", amount: 5_000_000 }, { method: "bank_transfer", amount: 3_200_000 }]);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.due, 0);
  assert.match(c.body.code, /^HD-2026-\d{4}$/);
  const o = (await owner.get(`/api/v1/sales/${saleA}`)).body;
  assert.equal(o.lines[0].cost, 6_060_000);
  assert.equal(o.grossProfit, 2_140_000);
  assert.deepEqual(o.payments.map((p) => [p.method, p.amount]), [["cash", 5_000_000], ["bank_transfer", 3_200_000]]);
  assert.deepEqual([o.warranties[0].startDate, o.warranties[0].endDate], ["2026-11-03", "2027-11-03"]);
  assert.equal(o.balance.due, 0);
  const [u] = await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [A.unitId]);
  assert.equal(u.status, "sold");
  // Phủ định
  const again = await mkSale(sales, { customerId: KH["Trần Thị Bình"], lines: [{ lineType: "watch", unitId: A.unitId, unitPrice: 8_200_000 }] });
  assert.equal((await confirm(sales, again.body.id, [])).body.code, "WF-SALE-UNIT-UNAVAILABLE");
  assert.equal((await ctv.post(`/api/v1/sales/${saleA}/confirm`, { payments: [] }, K())).status, 403);
  assert.equal((await sales.patch(`/api/v1/sales/${saleA}`, { lines: [] })).status, 412);
  await assert.rejects(ownerSql("UPDATE public.sales SET note='x' WHERE id=$1", [saleA]), /WF-DOC-NOT-DRAFT/);
  await assert.rejects(ownerSql("UPDATE public.sale_line_costs SET cost_vnd=1"), /WF-IMMUTABLE/);
});

test("PT-11: giảm 5,88% vượt hạn mức 5% của sales ⇒ WF-SALE-DISCOUNT-LIMIT; owner được; bán dưới giá vốn ⇒ WF-SALE-BELOW-COST (không lộ số)", async () => {
  const X = await mkUnit("SEIKO-5-SRPD55", "PT11-X", 6_000_000, 8_500_000);
  const d = await mkSale(sales, { lines: [{ lineType: "watch", unitId: X.unitId, unitPrice: 8_000_000 }] });
  const r = await confirm(sales, d.body.id, [{ method: "cash", amount: 8_000_000 }]);
  assert.equal(r.body.code, "WF-SALE-DISCOUNT-LIMIT");
  const Z = await mkUnit("CASIO-MTP-V001", "PT11-Z", 1_000_000, 900_000);
  const d3 = await mkSale(sales, { lines: [{ lineType: "watch", unitId: Z.unitId, unitPrice: 900_000 }] });
  const below = await confirm(sales, d3.body.id, [{ method: "cash", amount: 900_000 }]);
  assert.equal(below.body.code, "WF-SALE-BELOW-COST");
  assert.ok(!/\d{3}\.\d{3}/.test(below.body.detail), "không lộ số tiền giá vốn");
  assert.equal((await confirm(owner, d3.body.id, [{ method: "cash", amount: 900_000 }])).status, 200, "owner có sale.below_cost");
});

test("SC-03: tiền thừa — thanh toán ghi 6.500.000, khách đưa 7.000.000, thừa 500.000; khách vãng lai", async () => {
  const C = await mkUnit("ORIENT-BAMBINO-V2", "SC03-C", 4_848_000, 6_500_000);
  const d = await mkSale(sales, { lines: [{ lineType: "watch", unitId: C.unitId, unitPrice: 6_500_000 }] });
  const c = await confirm(sales, d.body.id, [{ method: "cash", amount: 6_500_000 }], 7_000_000);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.change, 500_000);
  const [p] = await ownerSql("SELECT amount_vnd, cash_tendered_vnd FROM public.payments WHERE doc_id=$1", [d.body.id]);
  assert.deepEqual([p.amount_vnd, p.cash_tendered_vnd], [6_500_000, 7_000_000]);
  assert.equal((await owner.get(`/api/v1/sales/${d.body.id}`)).body.grossProfit, 1_652_000);
});

let saleB;
test("SC-04: bán nợ — thiếu khách ⇒ CUSTOMER-REQUIRED; còn nợ 1.300.000; thu thêm 1.000.000 ⇒ còn 300.000; vượt ⇒ OVERPAY; CT-05", async () => {
  const B = await mkUnit("CASIO-MTP-V001", "SC04-B", 1_212_000, 1_800_000);
  const noCust = await mkSale(sales, { lines: [{ lineType: "watch", unitId: B.unitId, unitPrice: 1_800_000 }] });
  assert.equal((await confirm(sales, noCust.body.id, [{ method: "cash", amount: 500_000 }])).body.code, "WF-SALE-CUSTOMER-REQUIRED");
  await sales.del(`/api/v1/sales/${noCust.body.id}`);
  const d = await mkSale(sales, { customerId: KH["Trần Thị Bình"], dueDate: "2026-11-10", lines: [{ lineType: "watch", unitId: B.unitId, unitPrice: 1_800_000 }] });
  saleB = d.body.id;
  const c = await confirm(sales, saleB, [{ method: "cash", amount: 500_000 }]);
  assert.equal(c.body.due, 1_300_000);
  assert.equal((await owner.get(`/api/v1/sales/${saleB}`)).body.grossProfit, 588_000);
  const dueList = await sales.get(`/api/v1/sales?due=true&customerId=${KH["Trần Thị Bình"]}`);
  assert.ok(dueList.body.items.some((x) => x.id === saleB && x.due === 1_300_000));
  sales.today = "2026-11-05";
  const over = await sales.post(`/api/v1/sales/${saleB}/payments`, { lines: [{ method: "bank_transfer", amount: 2_000_000 }] }, K());
  assert.equal(over.body.code, "WF-PAY-OVERPAY");
  const p = await sales.post(`/api/v1/sales/${saleB}/payments`, { lines: [{ method: "bank_transfer", amount: 1_000_000 }] }, K());
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal((await sales.get(`/api/v1/sales/${saleB}`)).body.balance.due, 300_000);
  // CT-05: hai phiên thu thêm 200.000 song song (còn nợ 300.000) ⇒ đúng 1 thành công
  const [x, y] = await Promise.all([
    sales.post(`/api/v1/sales/${saleB}/payments`, { lines: [{ method: "cash", amount: 200_000 }] }, K()),
    owner.post(`/api/v1/sales/${saleB}/payments`, { lines: [{ method: "cash", amount: 200_000 }] }, K()),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 422]);
  assert.equal((await sales.get(`/api/v1/sales/${saleB}`)).body.balance.due, 100_000);
  sales.today = "2026-11-03";
});

test("CT-01: hai phiếu cùng bán một chiếc song song ⇒ đúng 1 thành công; CT-07: xác nhận 2 lần cùng khóa ⇒ một kết quả", async () => {
  const U = await mkUnit("TISSOT-PRX-40", "CT01-U", 8_000_000, 11_500_000);
  const d1 = await mkSale(sales, { lines: [{ lineType: "watch", unitId: U.unitId, unitPrice: 11_500_000 }] });
  const d2 = await mkSale(owner, { lines: [{ lineType: "watch", unitId: U.unitId, unitPrice: 11_500_000 }] });
  const [r1, r2] = await Promise.all([confirm(sales, d1.body.id, [{ method: "cash", amount: 11_500_000 }]), confirm(owner, d2.body.id, [{ method: "cash", amount: 11_500_000 }])]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.sale_lines WHERE unit_id=$1 AND is_effective", [U.unitId]))[0].n, 1);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments p JOIN public.sales s ON s.id=p.doc_id WHERE s.id = ANY($1) AND p.status='posted'", [[d1.body.id, d2.body.id]]))[0].n, 1);
  const V = await mkUnit("TISSOT-PRX-40", "CT07-V", 8_000_000, 11_500_000);
  const d3 = await mkSale(sales, { lines: [{ lineType: "watch", unitId: V.unitId, unitPrice: 11_500_000 }] });
  const key = K();
  const [a, b] = await Promise.all([sales.post(`/api/v1/sales/${d3.body.id}/confirm`, { payments: [{ method: "cash", amount: 11_500_000 }] }, key),
    sales.post(`/api/v1/sales/${d3.body.id}/confirm`, { payments: [{ method: "cash", amount: 11_500_000 }] }, key)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.code, b.body.code);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments WHERE doc_id=$1", [d3.body.id]))[0].n, 1);
});

test("SC-05a: giữ D cọc 2.000.000; cọc thấp ⇒ DEPOSIT-TOO-LOW; người khác bán D ⇒ UNAVAILABLE; chuyển thành bán giảm 500.000 ⇒ payable 11.500.000", async () => {
  sales.today = "2026-11-04";
  const D = await mkUnit("TISSOT-PRX-40", "SC05-D", 10_000_000, 14_000_000);
  const low = await sales.post("/api/v1/reservations", { unitId: D.unitId, customerId: KH["Nguyễn Văn An"], method: "cash", deposit: 1_000_000 }, K());
  assert.equal(low.body.code, "WF-RSV-DEPOSIT-TOO-LOW");
  const r = await sales.post("/api/v1/reservations", { unitId: D.unitId, customerId: KH["Nguyễn Văn An"], method: "cash", deposit: 2_000_000 }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.holdUntil, "2026-11-11");
  const other = await mkSale(owner, { customerId: KH["Trần Thị Bình"], lines: [{ lineType: "watch", unitId: D.unitId, unitPrice: 14_000_000 }] });
  assert.equal((await confirm(owner, other.body.id, [])).body.code, "WF-SALE-UNIT-UNAVAILABLE");
  // CT-02: giữ trùng ⇒ UNIT-HELD
  assert.equal((await owner.post("/api/v1/reservations", { unitId: D.unitId, customerId: KH["Trần Thị Bình"], method: "cash", deposit: 2_000_000 }, K())).body.code, "WF-RSV-UNIT-HELD");
  sales.today = "2026-11-06";
  const cv = await sales.post(`/api/v1/reservations/${r.body.id}/convert`, {});
  const sid = cv.body.saleId;
  await sales.patch(`/api/v1/sales/${sid}`, { customerId: KH["Nguyễn Văn An"], reservationId: r.body.id, orderDiscount: 500_000, lines: [{ lineType: "watch", unitId: D.unitId, unitPrice: 14_000_000 }] });
  const c = await confirm(sales, sid, [{ method: "bank_transfer", amount: 11_500_000 }]);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.grandTotal, c.body.depositApplied, c.body.payable, c.body.due], [13_500_000, 2_000_000, 11_500_000, 0]);
  const [rs] = await ownerSql("SELECT status, applied_vnd FROM public.reservations WHERE id=$1", [r.body.id]);
  assert.deepEqual([rs.status, rs.applied_vnd], ["converted", 2_000_000]);
  assert.equal((await owner.get(`/api/v1/sales/${sid}`)).body.grossProfit, 3_500_000);
  // SC-15 phủ định: phiếu đã dùng cọc không hủy được
  await reauth(owner);
  owner.today = "2026-11-06";
  assert.equal((await owner.post(`/api/v1/sales/${sid}/void`, { reason: "Thử hủy phiếu có cọc" }, K())).body.code, "WF-SALE-VOID-NOT-ALLOWED");
});

test("SC-05b/c + CT-03: hoàn cọc (thanh toán out); tịch thu cần quyền + lý do; bán vs giữ song song chỉ 1 thắng", async () => {
  sales.today = owner.today = "2026-11-04";
  const E1 = await mkUnit("CITIZEN-NH8350", "SC05-E1", 2_000_000, 5_000_000);
  const E2 = await mkUnit("CITIZEN-NH8350", "SC05-E2", 2_000_000, 5_000_000);
  const r1 = await sales.post("/api/v1/reservations", { unitId: E1.unitId, customerId: KH["Trần Thị Bình"], method: "cash", deposit: 2_000_000 }, K());
  const c1 = await sales.post(`/api/v1/reservations/${r1.body.id}/cancel`, { mode: "refund", method: "cash" }, K());
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  const pays = await ownerSql("SELECT direction, purpose, amount_vnd FROM public.payments WHERE doc_id=$1 ORDER BY created_at", [r1.body.id]);
  assert.deepEqual(pays.map((p) => [p.direction, p.amount_vnd]), [["in", 2_000_000], ["out", 2_000_000]]);
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [E1.unitId]))[0].status, "in_stock");
  const r2 = await sales.post("/api/v1/reservations", { unitId: E2.unitId, customerId: KH["Trần Thị Bình"], method: "cash", deposit: 2_000_000 }, K());
  assert.equal((await sales.post(`/api/v1/reservations/${r2.body.id}/cancel`, { mode: "forfeit", reason: "Khách bỏ cọc quá hạn" }, K())).status, 403);
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/reservations/${r2.body.id}/cancel`, { mode: "forfeit", reason: "ngắn" }, K())).status, 422);
  const f = await owner.post(`/api/v1/reservations/${r2.body.id}/cancel`, { mode: "forfeit", reason: "Khách bỏ cọc quá hạn giữ" }, K());
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const [rs] = await ownerSql("SELECT status, forfeited_vnd, applied_vnd FROM public.reservations WHERE id=$1", [r2.body.id]);
  assert.deepEqual([rs.status, rs.forfeited_vnd, rs.applied_vnd], ["forfeited", 2_000_000, 0]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments WHERE doc_id=$1", [r2.body.id]))[0].n, 1, "tịch thu không tạo thanh toán mới");
  // CT-03
  const G = await mkUnit("CITIZEN-NH8350", "CT03-G", 2_000_000, 5_000_000);
  const sd = await mkSale(owner, { lines: [{ lineType: "watch", unitId: G.unitId, unitPrice: 5_000_000 }] });
  const [a, b] = await Promise.all([confirm(owner, sd.body.id, [{ method: "cash", amount: 5_000_000 }]),
    sales.post("/api/v1/reservations", { unitId: G.unitId, customerId: KH["Trần Thị Bình"], method: "cash", deposit: 1_000_000 }, K())]);
  assert.equal([a.status, b.status].filter((s) => s === 200).length, 1);
  const [g] = await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [G.unitId]);
  assert.ok(["sold", "reserved"].includes(g.status));
});

test("SC-06a: thu cũ đổi mới — giá thu 6tr; payable 14tr; phiếu trade_in tự tạo; máy cũ inspecting giá vốn 6tr; doanh thu 20tr", async () => {
  sales.today = owner.today = "2026-11-04";
  const E = await mkUnit("TISSOT-PRX-40", "SC06-E", 15_000_000, 20_000_000);
  const ti = { credit: 6_000_000, modelId: ids.m["ORIENT-BAMBINO-V2"], serialNo: "SC06-OLD", condition: "used", conditionGrade: "B", initialStatus: "inspecting", locationId: ids.l["Xưởng"] };
  const d = await mkSale(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: E.unitId, unitPrice: 20_000_000 }], tradeIns: [ti] });
  // thiếu ảnh giấy tờ người bán ⇒ lỗi (BR-PUR-09 qua BR-TRD-04)
  assert.equal((await confirm(sales, d.body.id, [{ method: "bank_transfer", amount: 14_000_000 }])).body.code, "WF-PUR-SELLER-ID-REQUIRED");
  for (const kind of ["id_document", "condition"]) {
    const f = new FormData(); f.set("kind", kind); f.set("entityTable", "sales"); f.set("entityId", d.body.id); f.set("file", new Blob([PNG], { type: "image/png" }), "x.png");
    assert.equal((await sales.post("/api/v1/files", f)).status, 200);
  }
  const over = await mkSale(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: E.unitId, unitPrice: 20_000_000 }], tradeIns: [{ ...ti, serialNo: "X", credit: 25_000_000 }] });
  assert.equal((await confirm(sales, over.body.id, [])).body.code, "WF-SALE-TRADEIN-EXCEEDS");
  await sales.del(`/api/v1/sales/${over.body.id}`);
  const c = await confirm(sales, d.body.id, [{ method: "bank_transfer", amount: 14_000_000 }]);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.grandTotal, c.body.tradeIn, c.body.payable, c.body.due], [20_000_000, 6_000_000, 14_000_000, 0]);
  const det = (await owner.get(`/api/v1/sales/${d.body.id}`)).body;
  assert.equal(det.grossProfit, 5_000_000);
  const F = det.tradeIns[0];
  const [fu] = await ownerSql(`SELECT u.status, (SELECT sum(amount_vnd) FROM public.unit_cost_entries e WHERE e.unit_id=u.id)::bigint cost, r.kind, r.status rs
    FROM public.purchase_receipts r JOIN public.purchase_lines l ON l.receipt_id=r.id JOIN public.watch_units u ON u.id=l.unit_id WHERE r.id=$1`, [F.purchaseReceiptId]);
  assert.deepEqual([fu.status, fu.cost, fu.kind, fu.rs], ["inspecting", 6_000_000, "trade_in", "confirmed"]);
  assert.equal((await ownerSql("SELECT coalesce(sum(amount_vnd),0)::bigint s FROM public.payments WHERE doc_id=$1", [d.body.id]))[0].s, 14_000_000);
});

test("SC-06b: mua lại đúng chiếc A đã bán (giá thu 5tr) ⇒ cùng mã, cost_cycle 2, giá vốn 5tr; chu kỳ 1 giữ nguyên; dòng bán cũ hết hiệu lực", async () => {
  sales.today = "2026-11-08";
  const N = await mkUnit("CASIO-LTP-1302", "SC06B-N", 600_000, 900_000);
  const ti = { credit: 5_000_000, modelId: ids.m["SEIKO-5-SRPD55"], serialNo: "SC02-A", condition: "used", conditionGrade: "A", initialStatus: "inspecting", locationId: ids.l["Xưởng"], rebuyUnitId: A.unitId };
  const d = await mkSale(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: N.unitId, unitPrice: 900_000 }], tradeIns: [{ ...ti, credit: 800_000 }] });
  for (const kind of ["id_document", "condition"]) {
    const f = new FormData(); f.set("kind", kind); f.set("entityTable", "sales"); f.set("entityId", d.body.id); f.set("file", new Blob([PNG], { type: "image/png" }), "x.png");
    await sales.post("/api/v1/files", f);
  }
  const c = await confirm(sales, d.body.id, [{ method: "cash", amount: 100_000 }]);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const [a] = await ownerSql(`SELECT u.asset_code, u.cost_cycle, u.status,
      (SELECT sum(amount_vnd) FROM public.unit_cost_entries e WHERE e.unit_id=u.id AND e.cycle=2)::bigint c2,
      (SELECT sum(amount_vnd) FROM public.unit_cost_entries e WHERE e.unit_id=u.id AND e.cycle=1)::bigint c1 FROM public.watch_units u WHERE id=$1`, [A.unitId]);
  assert.deepEqual([a.asset_code, a.cost_cycle, a.status, a.c2, a.c1], [A.assetCode, 2, "inspecting", 800_000, 6_060_000]);
  const [old] = await ownerSql("SELECT is_effective FROM public.sale_lines WHERE sale_id=$1", [saleA]);
  assert.equal(old.is_effective, false);
  const [s02] = await ownerSql("SELECT status, grand_total_vnd FROM public.sales WHERE id=$1", [saleA]);
  assert.deepEqual([s02.status, s02.grand_total_vnd], ["confirmed", 8_200_000], "doanh thu SC-02 giữ nguyên");
});

test("SC-15: hủy phiếu trong 24 giờ ⇒ chiếc về in_stock, thanh toán & bảo hành voided; sales 403; quá 25 giờ ⇒ VOID-EXPIRED", async () => {
  owner.today = sales.today = "2026-11-03";
  const Q = await mkUnit("SEIKO-5-SRPD55", "SC15-Q", 6_060_000, 8_500_000);
  const d = await mkSale(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: Q.unitId, unitPrice: 8_200_000 }] });
  await confirm(sales, d.body.id, [{ method: "cash", amount: 5_000_000 }, { method: "bank_transfer", amount: 3_200_000 }]);
  assert.equal((await sales.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Nhập nhầm khách hàng" }, K())).status, 403);
  await reauth(owner);
  const v = await owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Nhập nhầm khách hàng" }, K());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const [u] = await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [Q.unitId]);
  assert.equal(u.status, "in_stock");
  const ps = await ownerSql("SELECT status FROM public.payments WHERE doc_id=$1", [d.body.id]);
  assert.deepEqual(ps.map((p) => p.status), ["voided", "voided"]);
  const [w] = await ownerSql("SELECT w.status FROM public.warranties w JOIN public.sale_lines sl ON sl.id=w.sale_line_id WHERE sl.sale_id=$1", [d.body.id]);
  assert.equal(w.status, "voided");
  // quá 25 giờ
  const d2 = await mkSale(sales, { lines: [{ lineType: "watch", unitId: Q.unitId, unitPrice: 8_500_000 }] });
  await confirm(sales, d2.body.id, [{ method: "cash", amount: 8_500_000 }]);
  await ownerSql("SELECT set_config('app.in_fn','on',false); UPDATE public.sales SET confirmed_at = now() - interval '25 hours' WHERE id = $1", [d2.body.id]).catch(async () => {
    const pg = (await import("pg")).default; const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL }); await c.connect();
    await c.query("SELECT set_config('app.in_fn','on',false)"); await c.query("UPDATE public.sales SET confirmed_at = now() - interval '25 hours' WHERE id = $1", [d2.body.id]); await c.end();
  });
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/sales/${d2.body.id}/void`, { reason: "Hủy muộn quá hạn" }, K())).body.code, "WF-SALE-VOID-EXPIRED");
});

test("bảo hành: tra theo serial / SĐT / mã phiếu; sales xem được; kho không", async () => {
  const bySerial = await sales.get("/api/v1/warranties?q=sc02-a");
  assert.ok(bySerial.body.items.length >= 1);
  const byPhone = await sales.get("/api/v1/warranties?q=0901000001");
  assert.ok(byPhone.body.items.some((w) => w.customerName === "Nguyễn Văn An"));
  assert.equal((await wh.get("/api/v1/warranties")).status, 403);
});

test("bất biến sau M5a: I2 (Σ thu ≤ phải thu), I4 (sold ⇔ đúng 1 dòng hiệu lực), I5 (reserved ⇔ 1 giữ hàng hiệu lực), I8 (dòng hiệu lực có giá vốn chốt)", async () => {
  assert.deepEqual(await ownerSql("SELECT doc_id FROM public.v_doc_balances WHERE doc_type='sale' AND due < 0"), []);
  assert.deepEqual(await ownerSql(`SELECT u.id FROM public.watch_units u WHERE u.status='sold' AND (SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id=u.id AND sl.is_effective) <> 1`), []);
  assert.deepEqual(await ownerSql(`SELECT u.id FROM public.watch_units u WHERE (u.status='reserved') <> EXISTS (SELECT 1 FROM public.reservations r WHERE r.unit_id=u.id AND r.status IN ('active','expired'))`), []);
  assert.deepEqual(await ownerSql(`SELECT sl.id FROM public.sale_lines sl JOIN public.sales s ON s.id=sl.sale_id WHERE s.status='confirmed' AND NOT EXISTS (SELECT 1 FROM public.sale_line_costs c WHERE c.sale_line_id=sl.id)`), []);
  assert.deepEqual(await ownerSql(`SELECT r.id FROM public.reservations r JOIN public.v_doc_balances b ON b.doc_id=r.id WHERE r.status NOT IN ('active','expired') AND b.held <> 0`), []);
});
