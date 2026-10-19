// M8 (bản gọn, CF-17) — Báo cáo & tổng quan: SC-10 (doanh thu / số lượng đồng hồ / CTV trên ngày riêng), PT-05 (xuất file theo quyền + giới hạn),
// PT-01/PT-14 phần dashboard (khóa theo quyền; CTV không có thẻ số), không giá vốn/lãi/nợ ở bất kỳ báo cáo nào, Excel cùng số.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, makeUnit, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv, KH, C1;
const D3 = "2027-01-03", D5 = "2027-01-05";

test("dựng dữ liệu SC-10: 2 đơn cửa hàng + 1 đơn CTV + 1 máy sửa giao trong ngày 2027-01-03", async () => {
  C1 = userOf("collaborator");
  await ownerSql("INSERT INTO public.collaborator_profiles (user_id, phone, is_active) VALUES ($1,'0900000000',true) ON CONFLICT (user_id) DO UPDATE SET is_active = true", [C1.id]);
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  for (const c of [owner, sales, wh, ctv]) c.today = D3;
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
  const A = await makeUnit(8_500_000), C = await makeUnit(6_500_000), E = await makeUnit(1_800_000);
  const s1 = await sales.post("/api/v1/sales", { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: A.id, price: 8_200_000 }] }, K());
  const s2 = await sales.post("/api/v1/sales", { customer: { fullName: "Khách vãng lai", phone: "0944 000 111" }, lines: [{ unitId: C.id, price: 6_500_000 }] }, K());
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  assert.equal(s2.status, 200, JSON.stringify(s2.body));
  // CTV bán E: giao → báo → chủ xác nhận với giá mặc định (niêm yết 1.800.000)
  assert.equal((await owner.post("/api/v1/collab/offers", { unitIds: [E.id], collaboratorIds: [C1.id] }, K())).status, 200);
  const cl = await ctv.post("/api/v1/collab/me/claims", { unitId: E.id, customerName: "Khách CTV", customerPhone: "0955 222 333" }, K());
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  const cf = await owner.post(`/api/v1/collab/claims/${cl.body.id}/confirm`, {}, K());
  assert.equal(cf.status, 200, JSON.stringify(cf.body));
  // sửa chữa: nhận → khoản 140.000 → xong → giao
  const r = await owner.post("/api/v1/repairs", { customer: { fullName: "Khách sửa", phone: "0933 456 789" }, brandText: "Citizen", complaint: "hết pin" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await owner.post(`/api/v1/repairs/${r.body.id}/lines`, { lineType: "other", description: "Thay pin", unitPrice: 140_000 });
  await owner.post(`/api/v1/repairs/${r.body.id}/complete`, {}, K());
  assert.equal((await owner.post(`/api/v1/repairs/${r.body.id}/deliver`, {}, K())).status, 200);
});

test("SC-10: Doanh thu ngày = cửa hàng 14.700.000 + CTV 1.800.000 + sửa chữa 140.000; 3 đơn bán, 3 chiếc (1 do CTV), 1 máy sửa", async () => {
  const q = `?from=${D3}&to=${D3}`;
  const rev = (await owner.get("/api/v1/reports/revenue" + q)).body.data;
  assert.equal(rev.length, 1);
  assert.deepEqual([rev[0].shopRevenue, rev[0].collabRevenue, rev[0].repairRevenue, rev[0].revenue], [14_700_000, 1_800_000, 140_000, 16_640_000]);
  assert.deepEqual([rev[0].invoiceCount, rev[0].unitsSold, rev[0].collabUnits, rev[0].repairCount], [3, 3, 1, 1]);
  // gom theo tháng/quý/năm cùng tổng
  for (const g of ["month", "quarter", "year"]) {
    const x = (await owner.get(`/api/v1/reports/revenue?from=${D3}&to=${D3}&group=${g}`)).body.data;
    assert.equal(x.length, 1, g);
    assert.equal(x[0].revenue, 16_640_000, g);
  }
  assert.ok(!JSON.stringify(rev).match(/cogs|profit|cost|due|debt/i), "không giá vốn/lãi/nợ");
  const d = (await owner.get(`/api/v1/reports/dashboard?from=${D3}&to=${D3}`)).body.kpis;
  assert.deepEqual([d.revenue, d.invoiceCount, d.unitsSold, d.repairRevenue, d.collabSalesRevenue], [16_640_000, 3, 3, 140_000, 1_800_000]);
  // ngày khác không có số
  assert.deepEqual((await owner.get(`/api/v1/reports/revenue?from=${D5}&to=${D5}`)).body.data, []);
});

test("Số lượng đồng hồ: đã bán trong kỳ theo kênh + theo hãng; tồn kho; Excel cùng số", async () => {
  const u = (await owner.get(`/api/v1/reports/units?from=${D3}&to=${D3}`)).body.data;
  const get = (k) => u.summary.find((x) => x.k.trim() === k).v;
  assert.equal(get("Đã bán trong kỳ"), 3);
  assert.equal(get("- Bán tại cửa hàng"), 2);
  assert.equal(get("- CTV bán"), 1);
  assert.equal(u.soldByBrand.reduce((a, b) => a + b.units, 0), 3);
  assert.ok(u.stockByBrand.length > 0);
  const x = await owner.req("GET", `/api/v1/reports/revenue?from=${D3}&to=${D3}&format=xlsx`);
  assert.equal(x.status, 200);
  assert.match(x.headers.get("content-type"), /spreadsheetml/);
  assert.equal((await owner.req("GET", `/api/v1/reports/units?from=${D3}&to=${D3}&format=xlsx`)).status, 200);
});

test("Cộng tác viên (chỉ chủ): theo kỳ + từng CTV; sales/kho/CTV ⇒ 403", async () => {
  const c = (await owner.get(`/api/v1/reports/collab?from=${D3}&to=${D3}&group=day`)).body.data;
  assert.deepEqual(c.periods.map((p) => [p.units, p.revenue, p.collaborators]), [[1, 1_800_000, 1]]);
  assert.deepEqual(c.byCollaborator.map((p) => [p.collaboratorId, p.units, p.revenue]), [[C1.id, 1, 1_800_000]]);
  const st = (await owner.get(`/api/v1/reports/collaborators?period=day&from=${D3}&to=${D3}`)).body;
  assert.deepEqual(st.byCollaborator.map((p) => [p.collaboratorId, p.units, p.revenue]), [[C1.id, 1, 1_800_000]]);
  for (const who of [sales, wh, ctv]) assert.equal((await who.get(`/api/v1/reports/collab?from=${D3}&to=${D3}`)).status, 403);
  assert.equal((await sales.get("/api/v1/reports/collaborators")).status, 403);
  assert.equal((await owner.get("/api/v1/reports/khong-co")).status, 404);
  for (const old of ["profit", "stock", "collections", "open-balances", "aging", "shrinkage", "warranty", "moves", "repairs"]) assert.equal((await owner.get(`/api/v1/reports/${old}`)).status, 404, old);
});

test("PT-05 / PT-01 / PT-14: sales xem doanh thu & số lượng (không xem CTV); kho chỉ số lượng đồng hồ; CTV không có báo cáo/thẻ số", async () => {
  const q = `?from=${D3}&to=${D3}`;
  assert.equal((await sales.get("/api/v1/reports/revenue" + q)).status, 200);
  assert.equal((await sales.get("/api/v1/reports/units" + q)).status, 200);
  assert.equal((await sales.req("GET", `/api/v1/reports/revenue${q}&format=xlsx`)).status, 200, "sales có report.export");
  assert.equal((await sales.req("GET", `/api/v1/reports/collab${q}&format=xlsx`)).status, 403, "xuất file vẫn tuân quyền dữ liệu");
  assert.equal((await wh.get("/api/v1/reports/revenue" + q)).status, 403);
  assert.equal((await wh.req("GET", `/api/v1/reports/revenue${q}&format=xlsx`)).status, 403, "xuất file cùng lớp quyền");
  assert.equal((await wh.get("/api/v1/reports/units" + q)).status, 200, "kho xem số lượng đồng hồ");
  assert.equal((await ctv.get("/api/v1/reports/revenue")).status, 403);
  assert.equal((await ctv.get("/api/v1/reports/units")).status, 403);
  const d = (await sales.get(`/api/v1/reports/dashboard?from=${D3}&to=${D3}`)).body;
  assert.ok("revenue" in d.kpis);
  assert.ok(!JSON.stringify(d).match(/grossProfit|cogs|stockValue|cost|due\b|debt|deposit/i));
  const w = (await wh.get("/api/v1/reports/dashboard")).body.kpis;
  assert.ok("unitsInStock" in w && !("revenue" in w));
  const c = (await ctv.get("/api/v1/reports/dashboard")).body.kpis;
  assert.deepEqual(Object.keys(c).filter((k) => !["from", "to"].includes(k)), [], "CTV không có thẻ số cửa hàng");
  assert.ok((await ownerSql("SELECT count(*)::int n FROM public.audit_logs WHERE action='report.exported'"))[0].n >= 1);
});
