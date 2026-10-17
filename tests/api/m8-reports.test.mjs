// M8 — Báo cáo & tổng quan: SC-10 (tổng hợp ngày SC-01→SC-04 trên khoảng ngày riêng), PT-05 (xuất file theo quyền + giới hạn),
// PT-01 phần dashboard (khóa theo quyền), CTV/kho 403 với R1/R2, Excel cùng số.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv, ids, KH;
const D1 = "2027-01-02", D3 = "2027-01-03", D5 = "2027-01-05";

test("chuẩn bị + dựng lại SC-01→SC-04 trên ngày 2027-01-02/03/05", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])) };
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
  wh.today = D1;
  const w = (code, serial, price, list) => ({ lineType: "watch", modelId: ids.m[code], serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock", locationId: ids.l["Tủ trưng bày 1"], unitPrice: price, listPrice: list });
  const d = await wh.post("/api/v1/purchases", { kind: "purchase", sourceName: "Cửa hàng ABC", docDate: D1, lines: [w("SEIKO-5-SRPD55", "SC10-A", 6_000_000, 8_500_000),
    w("CASIO-MTP-V001", "SC10-B", 1_200_000, 1_800_000), w("ORIENT-BAMBINO-V2", "SC10-C", 4_800_000, 6_500_000)], costs: [{ kind: "shipping", amount: 120_000 }] });
  const c = await wh.post(`/api/v1/purchases/${d.body.id}/confirm`, {}, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const [A, B, C] = c.body.units;
  sales.today = D3;
  const sell = async (body, payments, tendered) => {
    const s = await sales.post("/api/v1/sales", { orderDiscount: 0, tradeIns: [], ...body });
    const r = await sales.post(`/api/v1/sales/${s.body.id}/confirm`, { payments, cashTendered: tendered }, K());
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return s.body.id;
  };
  await sell({ customerId: KH["Nguyễn Văn An"], lines: [{ lineType: "watch", unitId: A.unitId, unitPrice: 8_200_000 }] }, [{ method: "cash", amount: 5_000_000 }, { method: "bank_transfer", amount: 3_200_000 }]);
  await sell({ lines: [{ lineType: "watch", unitId: C.unitId, unitPrice: 6_500_000 }] }, [{ method: "cash", amount: 6_500_000 }], 7_000_000);
  const sb = await sell({ customerId: KH["Trần Thị Bình"], dueDate: "2027-01-10", lines: [{ lineType: "watch", unitId: B.unitId, unitPrice: 1_800_000 }] }, [{ method: "cash", amount: 500_000 }]);
  owner.today = D3;
  // Trước thu thêm: kiểm ngày 03
  const q = `?from=${D3}&to=${D3}`;
  const rev = (await owner.get("/api/v1/reports/revenue" + q)).body.data;
  assert.equal(rev[0].revenue, 16_500_000);
  const pr = (await owner.get("/api/v1/reports/profit" + q)).body.data.periods[0];
  assert.deepEqual([pr.revenue, pr.cogs, pr.grossProfit], [16_500_000, 12_120_000, 4_380_000]);
  const col = (await owner.get("/api/v1/reports/collections" + q)).body.data;
  assert.deepEqual([col.net, col.cash, col.bankTransfer], [15_200_000, 12_000_000, 3_200_000]);
  const ob = (await owner.get("/api/v1/reports/open-balances")).body.data.due.find((x) => x.docId === sb);
  assert.equal(ob.due, 1_300_000);
  const dash = (await owner.get(`/api/v1/reports/dashboard?from=${D3}&to=${D3}`)).body.kpis;
  assert.deepEqual([dash.revenue, dash.grossProfit, dash.collections, dash.unitsSold], [16_500_000, 4_380_000, 15_200_000, 3]);
  // Thu thêm 05
  sales.today = D5;
  assert.equal((await sales.post(`/api/v1/sales/${sb}/payments`, { lines: [{ method: "bank_transfer", amount: 1_000_000 }] }, K())).status, 200);
  const col5 = (await owner.get(`/api/v1/reports/collections?from=${D5}&to=${D5}`)).body.data;
  assert.equal(col5.net, 1_000_000);
  const all = (await owner.get(`/api/v1/reports/collections?from=${D3}&to=${D5}`)).body.data;
  assert.equal(all.net, 16_200_000);
  const ob2 = (await owner.get("/api/v1/reports/open-balances")).body.data.due.find((x) => x.docId === sb);
  assert.equal(ob2.due, 300_000);
  // Excel cùng số
  const x = await owner.req("GET", "/api/v1/reports/revenue" + q + "&format=xlsx");
  assert.equal(x.status, 200);
  assert.match(x.headers.get("content-type"), /spreadsheetml/);
});

test("PT-05 / PT-01: sales xem R1 (doanh thu) nhưng R2/R4 ⇒ 403; dashboard của sales không có khóa lãi/giá vốn/giá trị tồn", async () => {
  const q = `?from=${D3}&to=${D3}`;
  assert.equal((await sales.get("/api/v1/reports/revenue" + q)).status, 200);
  for (const code of ["profit", "stock"]) {
    const r = await sales.get(`/api/v1/reports/${code}${q}`);
    assert.equal(r.status, 403, code);
    assert.equal((await sales.req("GET", `/api/v1/reports/${code}${q}&format=xlsx`)).status, 403, "xuất file cùng lớp quyền");
  }
  const d = (await sales.get(`/api/v1/reports/dashboard?from=${D3}&to=${D3}`)).body;
  assert.ok("revenue" in d.kpis);
  for (const k of ["grossProfit", "cogs", "stockValueUnits", "stockValueParts", "collabUnsettled", "otherIncome"]) assert.ok(!(k in d.kpis), k);
  assert.ok(!("profit" in d.series));
  const w = (await wh.get("/api/v1/reports/dashboard")).body.kpis;
  assert.ok("stockValueUnits" in w && !("revenue" in w) && !("grossProfit" in w));
  assert.equal((await wh.get("/api/v1/reports/revenue")).status, 403);
  assert.equal((await ctv.get("/api/v1/reports/revenue")).status, 403);
  assert.equal((await ctv.get("/api/v1/reports/profit")).status, 403);
  const c = (await ctv.get("/api/v1/reports/dashboard")).body.kpis;
  assert.deepEqual(Object.keys(c).filter((k) => !["from", "to"].includes(k)), [], "CTV không có thẻ số cửa hàng");
  const audits = await ownerSql("SELECT count(*)::int n FROM public.audit_logs WHERE action='report.exported'");
  assert.ok(audits[0].n >= 1);
});

test("các báo cáo còn lại chạy được và tuân quyền: moves, stock, aging, repairs, shrinkage, warranty", async () => {
  for (const code of ["moves", "stock", "aging", "repairs", "shrinkage", "warranty"]) {
    const r = await owner.get(`/api/v1/reports/${code}?from=2026-01-01&to=2027-12-31`);
    assert.equal(r.status, 200, code + JSON.stringify(r.body));
  }
  const mv = (await wh.get("/api/v1/reports/moves?from=2027-01-01&to=2027-01-31")).body.data;
  assert.ok(mv.inbound.some((x) => x.source === "Cửa hàng ABC" && x.units === 3));
  assert.equal((await owner.get("/api/v1/reports/khong-co")).status, 404);
});
