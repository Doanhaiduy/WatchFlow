// M7 — Kiểm kê, cảnh báo, thông báo: SC-14 (hao hụt, tồn lâu, linh kiện thấp), CT-13 (điều chỉnh kiểm kê ∥ dùng ∥ bán linh kiện),
// cảnh báo hằng ngày (giữ hàng quá hạn → expired, bảo hành hết hạn, nợ đến hạn, CTV quá hạn), outbox đơn CTV → thông báo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, wh, sales, ids, KH;

test("chuẩn bị", async () => {
  [owner, wh, sales] = await Promise.all([login("owner"), login("warehouse"), login("sales")]);
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])) };
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
});

test("SC-14: kiểm kê vị trí riêng — H không thấy ⇒ ghi mất 3tr; LK lệch −1 × 80k; hao hụt 3.080.000; tồn lâu 123 ngày; linh kiện thấp", async () => {
  owner.today = wh.today = "2026-11-01";
  const loc = await wh.post("/api/v1/catalog/locations", { name: "Kệ kiểm kê SC14", kind: "cabinet" });
  const mk = async (serial, cost) => (await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper SC14", docDate: "2026-11-01", lines: [{ lineType: "watch",
    modelId: ids.m["CASIO-MTP-V001"], serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: loc.body.id, listPrice: cost * 2, unitPrice: cost }], costs: [] }, K())).body.units[0];
  const H = await mk("SC14-H", 3_000_000);
  const I = await mk("SC14-I", 1_000_000);
  await ownerSql("UPDATE public.watch_units SET stock_since = '2026-07-01' WHERE id = $1", [I.unitId]);
  const aging = (await owner.get("/api/v1/catalog/units?aging=1")).body.items.find((u) => u.id === I.unitId);
  // X-Test-Today = 2026-11-01 ⇒ 123 ngày
  assert.equal(aging?.daysInStock, 123);
  // Linh kiện: LK thử SL 9 @80k
  const [cat] = await ownerSql("SELECT id FROM public.part_categories WHERE name='Dây'");
  const p = await wh.post("/api/v1/parts", { code: "LK-SC14", name: "Dây SC14", categoryId: cat.id, uom: "sợi", salePrice: 150_000, reorderLevel: 0 });
  const o = await wh.post("/api/v1/purchases", { kind: "opening", docDate: "2026-11-01", lines: [{ lineType: "part", partId: p.body.id, qty: 9, unitPrice: 80_000 }], costs: [] });
  await wh.post(`/api/v1/purchases/${o.body.id}/confirm`, {}, K());
  // Đợt kiểm vị trí + đợt kiểm linh kiện
  const st = await wh.post("/api/v1/stocktakes", { scope: "location", locationId: loc.body.id });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(st.body.units, 2);
  assert.equal((await wh.post(`/api/v1/stocktakes/${st.body.id}/lines`, { code: I.assetCode })).status, 200);
  assert.equal((await wh.post(`/api/v1/stocktakes/${st.body.id}/lines`, { code: H.assetCode, counted: 0 })).status, 200);
  assert.equal((await wh.post(`/api/v1/stocktakes/${st.body.id}/reconcile`, {}, K())).body.code, "WF-REASON-REQUIRED");
  await wh.post(`/api/v1/stocktakes/${st.body.id}/lines`, { code: H.assetCode, counted: 0, reasonCode: "lost", note: "không thấy trên kệ" });
  assert.equal((await wh.post(`/api/v1/stocktakes/${st.body.id}/reconcile`, {}, K())).body.code, "WF-AUTH-FORBIDDEN", "ghi mất chiếc cần stock.writeoff (CQ-013)");
  const rc = await owner.post(`/api/v1/stocktakes/${st.body.id}/reconcile`, {}, K());
  assert.equal(rc.status, 200, JSON.stringify(rc.body));
  assert.deepEqual([rc.body.loss, rc.body.lostUnits], [3_000_000, 1]);
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [H.unitId]))[0].status, "written_off");
  const sp = await wh.post("/api/v1/stocktakes", { scope: "parts" });
  await wh.post(`/api/v1/stocktakes/${sp.body.id}/lines`, { partId: p.body.id, counted: 8, reasonCode: "lost" });
  const rp = await wh.post(`/api/v1/stocktakes/${sp.body.id}/reconcile`, {}, K());
  assert.equal(rp.status, 200, JSON.stringify(rp.body));
  assert.equal(rp.body.loss, 80_000);
  const [q] = await ownerSql("SELECT qty_on_hand q FROM public.parts WHERE id=$1", [p.body.id]);
  assert.equal(q.q, 8);
  const [mv] = await ownerSql("SELECT kind, qty_delta, unit_cost::text FROM public.part_stock_movements WHERE part_id=$1 ORDER BY at DESC LIMIT 1", [p.body.id]);
  assert.deepEqual([mv.kind, mv.qty_delta, mv.unit_cost], ["stocktake", -1, "80000.0000"]);
  // đợt đã chốt không ghi thêm
  assert.equal((await wh.post(`/api/v1/stocktakes/${st.body.id}/lines`, { code: I.assetCode })).body.code, "WF-INV-STOCKTAKE-CLOSED");
  // linh kiện thấp ⇒ thông báo (đặt ngưỡng)
  await wh.patch(`/api/v1/parts/${p.body.id}`, { reorderLevel: 8 });
  await ownerSql("SELECT set_config('app.env','test',false); SELECT app.fn_daily_alerts()");
  const n = await wh.get("/api/v1/notifications");
  assert.ok(n.body.items.some((x) => x.type === "part.low_stock" && x.title.includes("LK-SC14")));
});

test("CT-13: điều chỉnh kiểm kê ∥ dùng sửa ∥ bán lẻ cùng linh kiện ⇒ qty = Σ movements (I7), không âm", async () => {
  owner.today = wh.today = sales.today = "2026-11-02";
  const [cat] = await ownerSql("SELECT id FROM public.part_categories WHERE name='Khác'");
  const p = await wh.post("/api/v1/parts", { code: "LK-CT13", name: "Linh kiện CT13", categoryId: cat.id, uom: "cái", salePrice: 100_000, reorderLevel: 0 });
  const o = await wh.post("/api/v1/purchases", { kind: "opening", docDate: "2026-11-02", lines: [{ lineType: "part", partId: p.body.id, qty: 5, unitPrice: 50_000 }], costs: [] });
  await wh.post(`/api/v1/purchases/${o.body.id}/confirm`, {}, K());
  const sp = await wh.post("/api/v1/stocktakes", { scope: "parts" });
  await wh.post(`/api/v1/stocktakes/${sp.body.id}/lines`, { partId: p.body.id, counted: 3, reasonCode: "count_error" });
  const rep = await owner.post("/api/v1/repairs", { customerId: KH["Trần Thị Bình"], brandText: "Casio", complaint: "thay chốt" }, K());
  const rl = await owner.post(`/api/v1/repairs/${rep.body.id}/lines`, { lineType: "part", partId: p.body.id, qty: 2 });
  const sd = await sales.post("/api/v1/sales", { lines: [{ lineType: "part", partId: p.body.id, qty: 2, unitPrice: 100_000 }], orderDiscount: 0, tradeIns: [] });
  const res = await Promise.all([
    wh.post(`/api/v1/stocktakes/${sp.body.id}/reconcile`, {}, K()),
    owner.post(`/api/v1/repairs/${rep.body.id}/lines/${rl.body.id}/consume`, {}),
    sales.post(`/api/v1/sales/${sd.body.id}/confirm`, { payments: [{ method: "cash", amount: 200_000 }] }, K()),
  ]);
  assert.ok(res.some((r) => r.status === 200));
  const [x] = await ownerSql(`SELECT p.qty_on_hand q, (SELECT sum(qty_delta) FROM public.part_stock_movements m WHERE m.part_id=p.id)::int s FROM public.parts p WHERE id=$1`, [p.body.id]);
  assert.equal(x.q, x.s);
  assert.ok(x.q >= 0);
});

test("cảnh báo hằng ngày: giữ hàng quá hạn → expired (chiếc vẫn reserved) + thông báo; nợ đến hạn; bảo hành hết hạn → expired", async () => {
  sales.today = wh.today = "2026-11-02";
  const U = (await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper M7", docDate: "2026-11-02", lines: [{ lineType: "watch", modelId: ids.m["SEIKO-5-SRPD55"],
    serialNo: "M7-RSV", hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: (await ownerSql("SELECT id FROM public.storage_locations LIMIT 1"))[0].id, listPrice: 5_000_000, unitPrice: 3_000_000 }], costs: [] }, K())).body.units[0];
  const r = await sales.post("/api/v1/reservations", { unitId: U.unitId, customerId: KH["Nguyễn Văn An"], method: "cash", deposit: 500_000, holdUntil: "2026-11-05" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await ownerSql("SELECT set_config('app.env','test',false), set_config('app.test_today','2026-11-20',false); SELECT app.fn_daily_alerts()");
  const [rs] = await ownerSql("SELECT r.status, u.status us FROM public.reservations r JOIN public.watch_units u ON u.id=r.unit_id WHERE r.id=$1", [r.body.id]);
  assert.deepEqual([rs.status, rs.us], ["expired", "reserved"]);
  const n = await sales.get("/api/v1/notifications");
  assert.ok(n.body.items.some((x) => x.type === "reservation.overdue"));
  assert.ok(n.body.items.some((x) => x.type === "debt.due"), "phiếu nợ SC-04 hẹn 10/11 đã đến hạn");
  // chạy lại cùng ngày không nhân đôi thông báo (dedupe)
  const before = (await ownerSql("SELECT count(*)::int n FROM public.notifications"))[0].n;
  await ownerSql("SELECT set_config('app.env','test',false), set_config('app.test_today','2026-11-20',false); SELECT app.fn_daily_alerts()");
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.notifications"))[0].n, before);
  // hủy giữ hàng đã expired vẫn được
  const c = await sales.post(`/api/v1/reservations/${r.body.id}/cancel`, { mode: "refund", method: "cash" }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
});

test("outbox: CTV gửi đơn ⇒ người xác nhận nhận thông báo 'Đơn CTV chờ xác nhận'", async () => {
  const c1 = await login("collaborator");
  const [unit] = await ownerSql("SELECT id FROM public.watch_units WHERE status='with_collaborator' AND held_by_collaborator_id=$1 LIMIT 1", [userOf("collaborator").id]);
  if (!unit) return; // phụ thuộc dữ liệu bộ m5b (chạy trước)
  const kh = (await c1.get("/api/v1/customers")).body.items[0];
  const d = await c1.post("/api/v1/collab/me/sales", { customerId: kh.id, lines: [{ unitId: unit.id, unitPrice: 1_000_000 }] });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    await new Promise((r) => setTimeout(r, 300));
    found = (await sales.get("/api/v1/notifications")).body.items.some((x) => x.type === "collab.order" && x.link.includes(d.body.id));
  }
  assert.ok(found, "thông báo đơn CTV");
  await c1.del(`/api/v1/sales/${d.body.id}`);
});

test("cron evening chạy kiểm bất biến dưới wf_worker", async () => {
  const r = await fetch(process.env.TEST_BASE_URL + "/api/cron/evening?slot=m7-test", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } });
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.ok(b.notes.some((n) => n.startsWith("consistency:")), JSON.stringify(b));
});
