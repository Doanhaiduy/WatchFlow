// M5b — Cộng tác viên: SC-12 (giao → bán → quyết toán → thu hồi → thống kê), SC-16 (hủy đơn CTV & hủy quyết toán),
// CT-06 (giao trùng / giao vs giữ vs bán), CT-08 (hủy đơn vs quyết toán), CT-10 (quyết toán trùng), PT-02/PT-03 (phạm vi CTV).
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, asUser, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, c1, c2, ids, KH, C1, C2;

async function mkUnit(model, serial, cost, listPrice) {
  const r = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper CTV", docDate: "2026-11-01", lines: [{ lineType: "watch", modelId: ids.m[model],
    serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], listPrice, unitPrice: cost }], costs: [] }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.units[0];
}
const assign = (c, collab, lines, today) => { c.today = today; return c.post(`/api/v1/collaborators/${collab}/assignments`, { lines }, K()); };

test("chuẩn bị", async () => {
  [owner, sales, wh, c1] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  c2 = await login("collaborator", { email: userOf("collaborator", 1).email });
  wh.today = "2026-11-01";
  C1 = userOf("collaborator").id; C2 = userOf("collaborator", 1).id;
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])) };
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
});

let A, B, C, saleA, saleC;
test("SC-12 bước 1: giao A/B/C cho C1 (giá thu 7tr/1,5tr/5,5tr) ⇒ with_collaborator; C1 thấy giá thu, không giá vốn (PT-02)", async () => {
  A = await mkUnit("SEIKO-5-SRPD55", "SC12-A", 6_060_000, 8_500_000);
  B = await mkUnit("CASIO-MTP-V001", "SC12-B", 1_212_000, 1_800_000);
  C = await mkUnit("ORIENT-BAMBINO-V2", "SC12-C", 4_848_000, 6_500_000);
  assert.equal((await sales.post(`/api/v1/collaborators/${C1}/assignments`, { lines: [{ unitId: A.unitId, basePrice: 1 }] }, K())).status, 403);
  const r = await assign(owner, C1, [{ unitId: A.unitId, basePrice: 7_000_000 }, { unitId: B.unitId, basePrice: 1_500_000 }, { unitId: C.unitId, basePrice: 5_500_000 }], "2026-11-03");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.code, /^GC-2026-\d{4}$/);
  const st = await ownerSql("SELECT status, held_by_collaborator_id h, location_id FROM public.watch_units WHERE id = ANY($1)", [[A.unitId, B.unitId, C.unitId]]);
  assert.ok(st.every((s) => s.status === "with_collaborator" && s.h === C1 && s.location_id === null));
  const mine = await c1.get("/api/v1/collab/me/units");
  assert.deepEqual(mine.body.items.map((u) => u.basePrice).sort(), [1_500_000, 5_500_000, 7_000_000]);
  assert.ok(!/"cost/i.test(JSON.stringify(mine.body)), "CTV không thấy giá vốn");
  assert.equal((await c1.get("/api/v1/catalog/units")).status, 403);
  assert.equal((await c1.get(`/api/v1/catalog/units/${A.unitId}/cost`)).status, 403);
  assert.equal((await c2.get("/api/v1/collab/me/units")).body.items.length, 0, "C2 không thấy hàng của C1");
  // giá thu không sửa được sau xác nhận (B10)
  await assert.rejects(ownerSql("UPDATE public.collaborator_assignment_lines SET base_price_vnd = 1 WHERE unit_id = $1", [A.unitId]), /WF-IMMUTABLE/);
  // giao chiếc đang ở CTV lần nữa
  assert.equal((await assign(owner, C2, [{ unitId: A.unitId, basePrice: 7_000_000 }], "2026-11-03")).body.code, "WF-COL-UNIT-ASSIGNED");
});

test("SC-12 bước 2–3: C1 tạo khách + đơn nháp A 8,2tr; C1 không xác nhận được (403); chiếc không phải của mình ⇒ COL-UNIT-NOT-HELD; sales xác nhận", async () => {
  c1.today = sales.today = owner.today = "2026-11-03";
  const kh = await c1.post("/api/v1/customers", { fullName: "KH-C Khách của C1", phone: "0977000333", force: true });
  assert.equal(kh.status, 200);
  const X = await mkUnit("TISSOT-PRX-40", "SC12-X", 8_000_000, 11_000_000);
  assert.equal((await c1.post("/api/v1/collab/me/sales", { customerId: kh.body.id, lines: [{ unitId: X.unitId, unitPrice: 1 }] })).body.code, "WF-COL-UNIT-NOT-HELD");
  const d = await c1.post("/api/v1/collab/me/sales", { customerId: kh.body.id, lines: [{ unitId: A.unitId, unitPrice: 8_200_000 }] });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  saleA = d.body.id;
  assert.equal((await c1.post(`/api/v1/sales/${saleA}/confirm`, { payments: [] }, K())).status, 403);
  assert.equal((await c2.get(`/api/v1/sales/${saleA}`)).status, 404, "PT-03: C2 không thấy đơn của C1");
  const c = await sales.post(`/api/v1/sales/${saleA}/confirm`, { payments: [] }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const o = (await owner.get(`/api/v1/sales/${saleA}`)).body;
  assert.equal(o.lines[0].lineTotal, 8_200_000);
  assert.equal(o.lines[0].basePrice, 7_000_000);
  assert.equal(o.shopRevenue, 7_000_000);
  assert.equal(o.lines[0].cost, 6_060_000);
  assert.equal(o.grossProfit, 940_000);
  assert.equal(o.lines[0].collabEarn, 1_200_000);
  assert.equal(o.payments.length, 0, "BR-COL-05: không thanh toán của khách");
  assert.equal(o.warranties[0].endDate, "2027-11-03");
  const s = (await sales.get(`/api/v1/sales/${saleA}`)).body;
  assert.ok(!("basePrice" in s.lines[0]) && !("grossProfit" in s), "sales không thấy giá thu/lãi đơn CTV");
  const mineView = (await c1.get(`/api/v1/sales/${saleA}`)).body;
  assert.equal(mineView.lines[0].basePrice, 7_000_000, "CTV thấy giá thu của chính mình");
  assert.ok(!("cost" in mineView.lines[0]));
  // "Đơn của tôi": đơn đã xác nhận vẫn có dòng (chiếc đã bán, không còn "đang giữ") — lỗi cũ trả 0 dòng (0013e)
  const mine = (await c1.get("/api/v1/collab/me/sales")).body.items.find((x) => x.id === saleA);
  assert.equal(mine.status, "confirmed");
  assert.equal(mine.lines.length, 1);
  assert.equal(mine.lines[0].salePrice, 8_200_000);
  assert.equal(mine.lines[0].basePrice, 7_000_000);
  assert.ok(!("cost" in mine.lines[0]));
  assert.equal((await c2.get("/api/v1/collab/me/sales")).body.items.some((x) => x.id === saleA), false, "PT-03: C2 không thấy đơn của C1");
});

test("SC-12 bước 4: C1 bán C 5,2tr (< giá thu 5,5tr) — cho phép; doanh thu 5,5tr; lãi 652.000; phần C1 −300.000; không áp dưới giá vốn", async () => {
  c1.today = sales.today = "2026-11-04";
  const kh = (await c1.get("/api/v1/customers")).body.items[0];
  const d = await c1.post("/api/v1/collab/me/sales", { customerId: kh.id, lines: [{ unitId: C.unitId, unitPrice: 5_200_000 }] });
  saleC = d.body.id;
  const c = await sales.post(`/api/v1/sales/${saleC}/confirm`, { payments: [] }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const o = (await owner.get(`/api/v1/sales/${saleC}`)).body;
  assert.deepEqual([o.shopRevenue, o.grossProfit, o.lines[0].collabEarn], [5_500_000, 652_000, -300_000]);
});

let settleA;
test("SC-12 bước 5 + CT-10: quyết toán dòng A 7tr CK; hai phiên cùng dòng ⇒ 1 thành công; quyết toán lại ⇒ ALREADY-SETTLED", async () => {
  owner.today = "2026-11-05";
  const un = (await owner.get(`/api/v1/collaborators/${C1}/settlements`)).body.unsettled;
  const lineA = un.find((l) => l.saleId === saleA);
  assert.equal(lineA.basePrice, 7_000_000);
  const body = { lineIds: [lineA.id], method: "bank_transfer" };
  const [x, y] = await Promise.all([owner.post(`/api/v1/collaborators/${C1}/settlements`, body, K()), owner.post(`/api/v1/collaborators/${C1}/settlements`, body, K())]);
  const ok = [x, y].find((r) => r.status === 200);
  const bad = [x, y].find((r) => r.status !== 200);
  assert.ok(ok && bad, JSON.stringify([x.body, y.body]));
  assert.equal(bad.body.code, "WF-COL-ALREADY-SETTLED");
  settleA = ok.body.id;
  assert.equal(ok.body.total, 7_000_000);
  const pays = await ownerSql("SELECT purpose, amount_vnd, status FROM public.payments WHERE doc_type='settlement' AND doc_id=$1", [settleA]);
  assert.deepEqual(pays.map((p) => [p.purpose, p.amount_vnd, p.status]), [["collab_settlement", 7_000_000, "posted"]]);
  // CTV thấy thanh toán quyết toán của mình, không thấy của người khác
  const r = await asUser(C1, (cn) => cn.query("SELECT count(*)::int n FROM public.payments WHERE doc_type='settlement'"));
  assert.equal(r.rows[0].n, 1);
  const r2 = await asUser(C2, (cn) => cn.query("SELECT count(*)::int n FROM public.payments"));
  assert.equal(r2.rows[0].n, 0);
});

test("SC-12 bước 6: thu hồi B về Tủ trưng bày 1 ⇒ in_stock, giá vốn giữ nguyên; thu hồi A (đã bán) ⇒ COL-HAS-SOLD", async () => {
  owner.today = "2026-11-06";
  const loc = ids.l["Tủ trưng bày 1"];
  assert.equal((await owner.post(`/api/v1/collaborators/${C1}/return`, { unitId: A.unitId, locationId: loc, reason: "Thu hồi thử chiếc đã bán" }, K())).body.code, "WF-COL-HAS-SOLD");
  const r = await owner.post(`/api/v1/collaborators/${C1}/return`, { unitId: B.unitId, locationId: loc, reason: "CTV không bán được, trả về" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const [b] = await ownerSql(`SELECT status, held_by_collaborator_id h, location_id l, (SELECT sum(amount_vnd) FROM public.unit_cost_entries e WHERE e.unit_id=u.id)::bigint c FROM public.watch_units u WHERE id=$1`, [B.unitId]);
  assert.deepEqual([b.status, b.h, b.l, b.c], ["in_stock", null, loc, 1_212_000]);
  const [a] = await ownerSql("SELECT a.status FROM public.collaborator_assignments a JOIN public.collaborator_assignment_lines l ON l.assignment_id=a.id WHERE l.unit_id=$1", [B.unitId]);
  assert.equal(a.status, "closed", "phiếu giao tự đóng khi hết dòng active");
});

test("SC-12 tổng hợp: thống kê C1 tháng 11 — 2 chiếc, bán ra 13,4tr, phải nộp 12,5tr, C1 hưởng 900k, đã nộp 7tr, chưa nộp 5,5tr; C1 chỉ xem của mình", async () => {
  const q = "?period=month&from=2026-11-01&to=2026-11-30";
  const mine = (await c1.get("/api/v1/collab/me/stats" + q)).body;
  assert.deepEqual([mine.totals.unitsSold, mine.totals.salesTotal, mine.totals.baseTotal, mine.totals.collabEarn, mine.totals.settled, mine.totals.unsettled],
    [2, 13_400_000, 12_500_000, 900_000, 7_000_000, 5_500_000]);
  const other = (await c1.get(`/api/v1/reports/collaborators${q}&collaborator=${C2}`)).body;
  assert.ok(other.rows.every((r) => r.collaboratorId === C1), "CTV ép xem CTV khác vẫn chỉ ra của mình");
  const all = (await owner.get(`/api/v1/reports/collaborators${q}&collaborator=${C1}`)).body;
  assert.equal(all.totals.collabEarn, 900_000);
  assert.equal((await sales.get("/api/v1/reports/collaborators" + q)).status, 403);
});

test("SC-16: hủy đơn CTV chưa quyết toán ⇒ về with_collaborator; đã quyết toán ⇒ NOT-ALLOWED; hủy quyết toán rồi hủy đơn được", async () => {
  owner.today = "2026-11-04";
  await reauth(owner);
  const v1 = await owner.post(`/api/v1/sales/${saleC}/void`, { reason: "CTV báo nhập nhầm giá" }, K());
  assert.equal(v1.status, 200, JSON.stringify(v1.body));
  const [c] = await ownerSql("SELECT status, held_by_collaborator_id h FROM public.watch_units WHERE id=$1", [C.unitId]);
  assert.deepEqual([c.status, c.h], ["with_collaborator", C1]);
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_assignment_lines WHERE unit_id=$1 AND status='active'", [C.unitId])).length, 1);
  const [base] = await ownerSql("SELECT base_price_vnd FROM public.collaborator_assignment_lines WHERE unit_id=$1 AND status='active'", [C.unitId]);
  assert.equal(base.base_price_vnd, 5_500_000);
  owner.today = "2026-11-03";
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/sales/${saleA}/void`, { reason: "Thử hủy khi đã nộp" }, K())).body.code, "WF-SALE-VOID-NOT-ALLOWED");
  assert.equal((await sales.post(`/api/v1/settlements/${settleA}/void`, { reason: "Nộp nhầm số tiền" }, K())).status, 403);
  const vs = await owner.post(`/api/v1/settlements/${settleA}/void`, { reason: "Nộp nhầm số tiền ngân hàng" }, K());
  assert.equal(vs.status, 200, JSON.stringify(vs.body));
  const [p] = await ownerSql("SELECT status FROM public.payments WHERE doc_type='settlement' AND doc_id=$1", [settleA]);
  assert.equal(p.status, "voided");
  const v2 = await owner.post(`/api/v1/sales/${saleA}/void`, { reason: "Khách C1 trả lại đơn" }, K());
  assert.equal(v2.status, 200, JSON.stringify(v2.body));
  const [a] = await ownerSql("SELECT status, held_by_collaborator_id h FROM public.watch_units WHERE id=$1", [A.unitId]);
  assert.deepEqual([a.status, a.h], ["with_collaborator", C1]);
});

test("CT-06: giao cùng chiếc cho C1 ∥ C2 ⇒ 1 thắng; giao ∥ giữ hàng ∥ bán ⇒ 1 thắng", async () => {
  const U = await mkUnit("CITIZEN-NH8350", "CT06-U", 2_000_000, 4_000_000);
  const [x, y] = await Promise.all([assign(owner, C1, [{ unitId: U.unitId, basePrice: 3_000_000 }], "2026-11-05"),
    owner.post(`/api/v1/collaborators/${C2}/assignments`, { lines: [{ unitId: U.unitId, basePrice: 3_000_000 }] }, K())]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  const [u] = await ownerSql("SELECT held_by_collaborator_id h FROM public.watch_units WHERE id=$1", [U.unitId]);
  const winner = x.status === 200 ? C1 : C2;
  assert.equal(u.h, winner);
  const V = await mkUnit("CITIZEN-NH8350", "CT06-V", 2_000_000, 4_000_000);
  owner.today = sales.today = "2026-11-05";
  const sd = await sales.post("/api/v1/sales", { lines: [{ lineType: "watch", unitId: V.unitId, unitPrice: 4_000_000 }], orderDiscount: 0, tradeIns: [] });
  const res = await Promise.all([
    owner.post(`/api/v1/collaborators/${C1}/assignments`, { lines: [{ unitId: V.unitId, basePrice: 3_000_000 }] }, K()),
    sales.post("/api/v1/reservations", { unitId: V.unitId, customerId: KH["Trần Thị Bình"], method: "cash", deposit: 1_000_000 }, K()),
    sales.post(`/api/v1/sales/${sd.body.id}/confirm`, { payments: [{ method: "cash", amount: 4_000_000 }] }, K()),
  ]);
  assert.equal(res.filter((r) => r.status === 200).length, 1, JSON.stringify(res.map((r) => r.body.code ?? "OK")));
});

test("CT-08: hủy đơn CTV ∥ quyết toán cùng dòng ⇒ đúng 1 thành công, không vừa hủy vừa đã nộp", async () => {
  owner.today = c1.today = sales.today = "2026-11-05";
  const W = await mkUnit("CASIO-LTP-1302", "CT08-W", 600_000, 900_000);
  await assign(owner, C1, [{ unitId: W.unitId, basePrice: 800_000 }], "2026-11-05");
  const kh = (await c1.get("/api/v1/customers")).body.items[0];
  const d = await c1.post("/api/v1/collab/me/sales", { customerId: kh.id, lines: [{ unitId: W.unitId, unitPrice: 900_000 }] });
  await sales.post(`/api/v1/sales/${d.body.id}/confirm`, { payments: [] }, K());
  const line = (await owner.get(`/api/v1/collaborators/${C1}/settlements`)).body.unsettled.find((l) => l.saleId === d.body.id);
  await reauth(owner);
  const [v, s] = await Promise.all([owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Hủy thử song song" }, K()),
    owner.post(`/api/v1/collaborators/${C1}/settlements`, { lineIds: [line.id], method: "cash" }, K())]);
  assert.equal([v.status, s.status].filter((x) => x === 200).length, 1, JSON.stringify([v.body, s.body]));
  const [st] = await ownerSql("SELECT s.status, sl.settlement_id FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id=s.id WHERE s.id=$1", [d.body.id]);
  assert.ok(!(st.status === "voided" && st.settlement_id), "không vừa hủy vừa đã nộp");
});

test("PT-03 + bất biến I6/I10/I11", async () => {
  // CTV chỉ thấy đơn/khách/quyết toán của mình
  const r = await asUser(C2, (cn) => cn.query("SELECT (SELECT count(*) FROM public.sales WHERE collaborator_id <> app.current_user_id())::int a, (SELECT count(*) FROM public.collaborator_settlements)::int b"));
  assert.deepEqual([r.rows[0].a, r.rows[0].b], [0, 0]);
  await assert.rejects(asUser(C1, (cn) => cn.query("SELECT base_price_vnd FROM public.sale_lines")), /permission denied/);
  await assert.rejects(asUser(userOf("sales").id, (cn) => cn.query("SELECT * FROM app.fn_sale_line_collab((SELECT id FROM public.sales WHERE collaborator_id IS NOT NULL LIMIT 1))")), /WF-AUTH-FORBIDDEN/);
  // I6
  assert.deepEqual(await ownerSql(`SELECT u.id FROM public.watch_units u WHERE (u.status='with_collaborator') <> EXISTS (SELECT 1 FROM public.collaborator_assignment_lines l
     JOIN public.collaborator_assignments a ON a.id=l.assignment_id WHERE l.unit_id=u.id AND l.status='active' AND a.collaborator_id=u.held_by_collaborator_id)`), []);
  // I10
  assert.deepEqual(await ownerSql(`SELECT cs.id FROM public.collaborator_settlements cs WHERE cs.status='confirmed' AND (cs.total_vnd <> (SELECT coalesce(sum(base_price_vnd),0) FROM public.sale_lines WHERE settlement_id=cs.id)
     OR cs.total_vnd <> (SELECT coalesce(sum(amount_vnd),0) FROM public.payments p WHERE p.doc_type='settlement' AND p.doc_id=cs.id AND p.status='posted'))`), []);
  // I11
  assert.deepEqual(await ownerSql(`SELECT sl.id FROM public.sale_lines sl JOIN public.sales s ON s.id=sl.sale_id WHERE s.status='confirmed'
     AND sl.shop_revenue_vnd <> CASE WHEN s.collaborator_id IS NULL THEN sl.line_total_vnd ELSE sl.base_price_vnd END`), []);
});
