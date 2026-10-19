// M4 (bản gọn) — "Thêm đồng hồ" từng chiếc: CT-09 (hai lần thêm cùng serial song song ⇒ đúng 1 thành công), CT-07 (cùng Idempotency-Key),
// quyền (sales không thêm được), ngày tương lai bị chặn, không còn API phiếu nhập nhiều dòng / giá vốn (CF-14).
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, wh, sales, ids;
const DAY = "2026-11-02";

test("chuẩn bị", async () => {
  [owner, wh, sales] = await Promise.all([login("owner"), login("warehouse"), login("sales")]);
  for (const c of [owner, wh, sales]) c.today = DAY;
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])) };
});

const watch = (model, serial, price, extra = {}) => ({ lineType: "watch", modelId: ids.m[model], serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], unitPrice: price, ...extra });
const quick = (who, line, extra = {}, headers = K()) => who.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Nhập kho", docDate: DAY, lines: [line], costs: [], ...extra }, headers);

test("thêm một chiếc: vào kho 'Sẵn sàng bán', có mã DH-…, niêm yết; giá nhập ghi nội bộ nhưng không API nào trả ra", async () => {
  const r = await quick(wh, watch("SEIKO-5-SRPD55", "ADD-1", 6_000_000, { listPrice: 8_500_000 }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, "confirmed");
  const u = r.body.units[0];
  const list = await sales.get("/api/v1/catalog/units?q=ADD-1");
  const it = list.body.items.find((x) => x.id === u.unitId);
  assert.ok(it, "thấy chiếc vừa thêm");
  assert.equal(it.status, "in_stock");
  assert.equal(it.listPrice, 8_500_000);
  assert.ok(!JSON.stringify(list.body).match(/"cost/i));
  const detail = await owner.get(`/api/v1/catalog/units/${u.unitId}`);
  assert.equal(detail.status, 200);
  assert.ok(!JSON.stringify(detail.body).match(/"cost/i), "chi tiết chiếc không lộ giá vốn kể cả với chủ");
  // giá nhập vẫn được ghi nội bộ (bất biến I8 cần giá vốn chốt)
  const [c] = await ownerSql("SELECT coalesce(sum(amount_vnd),0)::bigint s FROM public.unit_cost_entries WHERE unit_id=$1", [u.unitId]);
  assert.equal(c.s, 6_000_000);
});

test("CT-09: hai lần thêm cùng serial song song ⇒ đúng 1 thành công", async () => {
  const [a, b] = await Promise.all([quick(wh, watch("TISSOT-PRX-40", "CT09-SERIAL", 9_000_000)), quick(owner, watch("TISSOT-PRX-40", "ct09 serial", 9_000_000))]);
  const codes = [a, b].map((r) => (r.status === 200 ? "OK" : r.body.code)).sort();
  assert.deepEqual(codes, ["OK", "WF-UNIT-SERIAL-DUPLICATE"]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.watch_units WHERE serial_norm='CT09SERIAL'"))[0].n, 1);
});

test("CT-07: gửi hai lần cùng Idempotency-Key ⇒ một chiếc, cùng kết quả", async () => {
  const key = K();
  const body = { kind: "purchase", sourceName: "Nhập kho", docDate: DAY, lines: [watch("CASIO-MTP-V001", "IDEM-1", 1_200_000)], costs: [] };
  const [a, b] = await Promise.all([wh.post("/api/v1/purchases/quick", body, key), wh.post("/api/v1/purchases/quick", body, key)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(a.body.id, b.body.id);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.watch_units WHERE serial_norm='IDEM1'"))[0].n, 1);
});

test("quyền & ngày: sales không thêm được (403); ngày tương lai ⇒ WF-DOC-FUTURE; thiếu Idempotency-Key ⇒ 4xx", async () => {
  assert.equal((await quick(sales, watch("CASIO-LTP-1302", "NOPE-1", 500_000))).status, 403);
  const f = await quick(wh, watch("CASIO-LTP-1302", "FUT-1", 500_000), { docDate: "2026-11-05" });
  assert.equal(f.body.code, "WF-DOC-FUTURE");
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.watch_units WHERE serial_norm='FUT1'"))[0].n, 0, "lỗi ⇒ không để lại chiếc nào");
  const nokey = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "x", lines: [], costs: [] });
  assert.ok(nokey.status >= 400 && nokey.status < 500);
});

test("không còn API phiếu nhập nhiều dòng / giá vốn / nhà cung cấp (CF-14)", async () => {
  for (const p of ["/api/v1/purchases", "/api/v1/purchases/sources", "/api/v1/purchases/export", "/api/v1/parts", "/api/v1/stocktakes", "/api/v1/reservations", "/api/v1/payments"]) {
    const r = await owner.get(p);
    assert.equal(r.status, 404, p);
  }
  const id = (await owner.get("/api/v1/catalog/units?status=stock")).body.items[0].id;
  assert.equal((await owner.get(`/api/v1/catalog/units/${id}/cost`)).status, 404);
  assert.equal((await owner.post(`/api/v1/catalog/units/${id}/cost-adjust`, { amount: 1, reason: "thử gọi API đã gỡ" })).status, 404);
});
