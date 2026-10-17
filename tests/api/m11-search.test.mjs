// M11 — Tìm nhanh & điều hướng: GET /api/v1/search (Ctrl+K), GET /api/v1/me/badges (huy hiệu số việc), GET /api/v1/system/status?summary=1 (dải cảnh báo vận hành).
// FR-NAV-01/02/03. Kiểm: tìm serial/mã/không dấu, phạm vi theo quyền + RLS (CTV chỉ thấy chiếc đang giữ), không có trường giá vốn/giá, q ngắn ⇒ 422,
// huy hiệu đúng theo quyền (đỏ khi quá hạn), summary vận hành chỉ cho system.health.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, userOf, Client } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, c1, c2, ids, C1;
let U1, U2, UL; // U1 tồn kho, U2 giao C1, UL = lô 6 chiếc
let rsv, repair, ctvDraft;

async function quick(lines) {
  const r = await wh.post("/api/v1/purchases/quick", { kind: "purchase", sourceName: "Helper tìm nhanh", docDate: "2026-11-01", lines, costs: [] }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.units;
}
const line = (model, serial, cost, listPrice) => ({ lineType: "watch", modelId: ids.m[model], serialNo: serial, hasSerial: true, condition: "new", initialStatus: "in_stock",
  locationId: ids.l["Tủ trưng bày 1"], listPrice, unitPrice: cost });
const search = (c, q) => c.get("/api/v1/search?q=" + encodeURIComponent(q));
const assetOf = async (id) => (await ownerSql("SELECT asset_code FROM public.watch_units WHERE id=$1", [id]))[0].asset_code;
const FORBIDDEN_FIELDS = /cost|profit|margin|basePrice|unitPrice|listPrice|effectivePrice|price|giá vốn|lãi/i;

test("chuẩn bị: đăng nhập, dữ liệu mẫu (chiếc, khách, phiếu sửa, giữ hàng, lô 6 chiếc)", async () => {
  [owner, sales, wh, c1] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  c2 = await login("collaborator", { email: userOf("collaborator", 1).email });
  C1 = userOf("collaborator").id;
  wh.today = owner.today = sales.today = "2026-11-01";
  const m = await ownerSql("SELECT code, id FROM public.watch_models");
  const l = await ownerSql("SELECT name, id FROM public.storage_locations");
  ids = { m: Object.fromEntries(m.map((r) => [r.code, r.id])), l: Object.fromEntries(l.map((r) => [r.name, r.id])) };

  [U1] = await quick([line("TISSOT-PRX-40", "QS-ALPHA-7731", 10_000_000, 14_000_000)]);
  [U2] = await quick([line("SEIKO-5-SRPD55", "QS-BETA-8842", 6_060_000, 8_500_000)]);
  UL = await quick(["T1", "T2", "T3", "T4", "T5", "T6"].map((s) => line("CASIO-MTP-V001", "LIM-" + s, 1_212_000, 1_800_000)));
  assert.equal(UL.length, 6);
  const g = await owner.post(`/api/v1/collaborators/${C1}/assignments`, { lines: [{ unitId: U2.unitId, basePrice: 7_000_000 }] }, K());
  assert.equal(g.status, 200, JSON.stringify(g.body));

  const kh = await sales.post("/api/v1/customers", { fullName: "Lê Thị Quỳnh Xuyến", phone: "0988123456", force: true });
  assert.equal(kh.status, 200, JSON.stringify(kh.body));
  const kh2 = await owner.post("/api/v1/customers", { fullName: "Phạm Quỳnh Khác", phone: "0966777888", force: true });
  assert.equal(kh2.status, 200);
  const kc = await c1.post("/api/v1/customers", { fullName: "Quỳnh Của CTV Một", phone: "0977111222", force: true });
  assert.equal(kc.status, 200, JSON.stringify(kc.body));
  repair = await owner.post("/api/v1/repairs", { kind: "customer", customerId: kh.body.id, brandText: "Casio", serialNo: "CS-QS-1", intakeCondition: "trầy", complaint: "chạy chậm" }, K());
  assert.equal(repair.status, 200, JSON.stringify(repair.body));
  rsv = await sales.post("/api/v1/reservations", { unitId: U1.unitId, customerId: kh.body.id, method: "cash", deposit: 2_000_000 }, K());
  assert.equal(rsv.status, 200, JSON.stringify(rsv.body));
});

test("q tối thiểu 2 ký tự: ngắn/rỗng/thiếu ⇒ 422; quá dài ⇒ 422; chưa đăng nhập ⇒ 401", async () => {
  for (const q of ["a", " a ", "", "x".repeat(61)]) assert.equal((await search(owner, q)).status, 422, `q=${JSON.stringify(q)}`);
  assert.equal((await owner.get("/api/v1/search")).status, 422);
  assert.equal((await new Client().get("/api/v1/search?q=abcd")).status, 401);
  assert.equal((await new Client().get("/api/v1/me/badges")).status, 401);
  assert.equal((await new Client().get("/api/v1/system/status?summary=1")).status, 401);
});

test("tìm theo serial khớp chính xác (không phân biệt hoa/thường, dấu gạch) ⇒ exactUnitId + units[0].exact", async () => {
  for (const q of ["QS-ALPHA-7731", "qs-alpha-7731", "qs alpha 7731", "QSALPHA7731"]) {
    const r = await search(owner, q);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.exactUnitId, U1.unitId, `q=${q}`);
    assert.equal(r.body.units[0].id, U1.unitId);
    assert.equal(r.body.units[0].exact, true);
    assert.equal(r.body.units[0].serialNo, "QS-ALPHA-7731");
  }
});

test("tìm theo mã nội bộ (DH-…) khớp chính xác; mã một phần ⇒ có kết quả nhưng không phải exact", async () => {
  const code = await assetOf(U1.unitId);
  const r = await search(owner, code.toLowerCase());
  assert.equal(r.body.exactUnitId, U1.unitId);
  assert.equal(r.body.units[0].assetCode, code);
  const part = await search(owner, "QS-ALPHA");
  assert.equal(part.body.exactUnitId, null);
  assert.ok(part.body.units.some((u) => u.id === U1.unitId && u.exact === false));
});

test("tìm không dấu: 'quynh xuyen' khớp 'Quỳnh Xuyến'; SĐT khớp một phần; SĐT chỉ trả 3 số cuối", async () => {
  for (const q of ["quynh xuyen", "QUỲNH XUYẾN", "Xuyến", "0988123", "988123456"]) {
    const r = await search(owner, q);
    assert.equal(r.status, 200);
    const c = r.body.customers.find((x) => x.fullName === "Lê Thị Quỳnh Xuyến");
    assert.ok(c, `q=${q}: ${JSON.stringify(r.body.customers)}`);
    assert.equal(c.phoneTail, "456");
    assert.ok(!JSON.stringify(r.body).includes("0988123456"), "không trả SĐT đầy đủ");
  }
  const none = await search(owner, "khongcoai");
  assert.deepEqual(none.body.customers, []);
});

test("phiếu theo mã: phiếu sửa, giữ hàng; tìm không phân biệt hoa/thường", async () => {
  const r1 = await search(owner, repair.body.code.toLowerCase());
  assert.equal(r1.body.repairs[0].code, repair.body.code);
  assert.equal(r1.body.repairs[0].id, repair.body.id);
  const r2 = await search(sales, rsv.body.code);
  assert.equal(r2.body.reservations[0].code, rsv.body.code);
  const sale = (await ownerSql("SELECT id, code FROM public.sales WHERE code IS NOT NULL ORDER BY confirmed_at DESC LIMIT 1"))[0];
  if (sale) {
    const r3 = await search(owner, sale.code);
    assert.ok(r3.body.sales.some((s) => s.id === sale.id), "tìm phiếu bán theo mã");
  }
  assert.ok(Array.isArray((await search(wh, "PN")).body.purchases), "kho thấy nhóm phiếu nhập");
});

test("tối đa 5 dòng mỗi nhóm", async () => {
  const r = await search(owner, "LIM-T");
  assert.equal(r.status, 200);
  assert.equal(r.body.units.length, 5);
  assert.equal(r.body.exactUnitId, null);
});

test("ký tự đại diện LIKE (% _) bị thoát: '%%' không khớp mọi thứ", async () => {
  for (const q of ["%%", "__", "%_"]) {
    const r = await search(owner, q);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.units, [], `q=${q}`);
    assert.deepEqual(r.body.customers, []);
    assert.deepEqual(r.body.repairs, []);
  }
});

test("PT: nhóm kết quả theo QUYỀN — bán hàng / kho / chủ", async () => {
  const q = "QS-";
  const s = (await search(sales, "quynh")).body;
  assert.ok(Array.isArray(s.units) && Array.isArray(s.customers) && Array.isArray(s.sales) && Array.isArray(s.reservations) && Array.isArray(s.parts));
  assert.equal(s.repairs, undefined, "bán hàng không có repair.view");
  assert.equal(s.purchases, undefined, "bán hàng không có purchase.view");
  const w = (await search(wh, q)).body;
  assert.ok(Array.isArray(w.units) && Array.isArray(w.purchases) && Array.isArray(w.parts));
  assert.equal(w.customers, undefined, "kho không có customer.view");
  assert.equal(w.sales, undefined);
  assert.equal(w.repairs, undefined);
  assert.equal(w.reservations, undefined);
  const o = (await search(owner, q)).body;
  for (const k of ["units", "customers", "sales", "repairs", "purchases", "reservations", "parts"]) assert.ok(Array.isArray(o[k]), "chủ có nhóm " + k);
});

test("PT-02: CTV chỉ thấy chiếc đang giữ; không thấy chiếc không giữ, phiếu sửa/nhập/giữ hàng/linh kiện; khách chỉ của mình", async () => {
  const mine = (await search(c1, "QS-")).body;
  assert.deepEqual(mine.units.map((u) => u.id), [U2.unitId], "chỉ chiếc đang giữ (QS-BETA)");
  assert.equal((await search(c1, "QS-ALPHA-7731")).body.units.length, 0, "chiếc không giữ: không thấy dù gõ đúng serial");
  assert.equal((await search(c1, "QS-ALPHA-7731")).body.exactUnitId, null);
  assert.equal((await search(c1, "LIM-T")).body.units.length, 0);
  for (const k of ["repairs", "purchases", "reservations", "parts"]) assert.equal(mine[k], undefined, "CTV không có nhóm " + k);
  const cus = (await search(c1, "quynh")).body.customers.map((c) => c.fullName);
  assert.deepEqual(cus, ["Quỳnh Của CTV Một"], "CTV chỉ thấy khách do mình tạo");
  // CTV khác không thấy gì của C1
  const other = (await search(c2, "QS-")).body;
  assert.equal(other.units.length, 0);
  assert.equal((await search(c2, "quynh")).body.customers.length, 0);
  // người dùng bình thường vẫn thấy cả hai
  assert.deepEqual((await search(owner, "QS-")).body.units.map((u) => u.id).sort(), [U1.unitId, U2.unitId].sort());
});

test("không có trường giá vốn/lợi nhuận/giá trong kết quả tìm (mọi vai trò)", async () => {
  for (const [c, q] of [[owner, "QS-"], [owner, "quynh"], [sales, "QS-"], [wh, "QS-"], [c1, "QS-"], [owner, "LIM-T"]]) {
    const body = (await search(c, q)).body;
    const keys = JSON.stringify(Object.keys(body)) + JSON.stringify(Object.values(body).flat().flatMap((x) => (x && typeof x === "object" ? Object.keys(x) : [])));
    assert.ok(!FORBIDDEN_FIELDS.test(keys), `q=${q}: có trường cấm ${keys}`);
  }
});

test("huy hiệu: đúng theo QUYỀN; đỏ khi quá hạn, vàng khi chỉ chờ; không có số tiền", async () => {
  // CTV C1 lập đơn nháp ⇒ chủ/bán hàng (sale.confirm) thấy "Đơn CTV chờ xác nhận"
  const kh = (await ownerSql("SELECT id FROM public.customers WHERE full_name = 'Quỳnh Của CTV Một'"))[0].id;
  const d = await c1.post("/api/v1/collab/me/sales", { customerId: kh, lines: [{ unitId: U2.unitId, unitPrice: 8_200_000 }] });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  ctvDraft = d.body.id;

  const o = (await owner.get("/api/v1/me/badges")).body;
  assert.equal(typeof o.total, "number");
  const pend = o.items.find((i) => i.key === "ctv_pending");
  assert.ok(pend && pend.navId === "sales" && pend.count >= 1 && pend.overdue === 0, JSON.stringify(o));
  assert.ok(o.items.find((i) => i.key === "repair_new" && i.navId === "repairs" && i.count >= 1), "máy mới nhận chờ xử lý");
  assert.equal(o.total, o.items.reduce((s, i) => s + i.count, 0));
  for (const i of o.items) assert.deepEqual(Object.keys(i).sort(), ["count", "key", "label", "navId", "overdue"], "chỉ số lượng — không có tiền");

  const s = (await sales.get("/api/v1/me/badges")).body;
  assert.ok(s.items.some((i) => i.key === "ctv_pending"), "bán hàng có sale.confirm");
  assert.ok(!s.items.some((i) => i.navId === "repairs"), "bán hàng không có repair.view");
  assert.ok(!s.items.some((i) => i.navId === "collaborators" || i.navId === "stocktakes"));

  const w = (await wh.get("/api/v1/me/badges")).body;
  assert.ok(!w.items.some((i) => i.key === "ctv_pending" || i.key === "debt_due" || i.navId === "repairs"), "kho không thấy việc bán/sửa");

  const c = (await c1.get("/api/v1/me/badges")).body;
  assert.deepEqual(c.items.map((i) => i.key), ["ctv_my_pending"], "CTV chỉ thấy việc của mình");
  assert.equal(c.items[0].navId, "ctv-sales");
  assert.equal(c.items[0].count, 1);
  assert.equal((await c2.get("/api/v1/me/badges")).body.total, 0);
});

test("huy hiệu: giữ hàng sắp/quá hạn ⇒ ĐỎ khi quá hạn (ngày giả +30)", async () => {
  const soon = (await sales.get("/api/v1/me/badges")).body.items.find((i) => i.key === "reservation_due");
  assert.equal(soon, undefined, "vừa giữ, hạn còn xa ⇒ chưa có huy hiệu");
  sales.today = "2026-12-31";
  const late = (await sales.get("/api/v1/me/badges")).body.items.find((i) => i.key === "reservation_due");
  assert.ok(late && late.navId === "reservations" && late.overdue >= 1 && late.overdue <= late.count, JSON.stringify(late));
  sales.today = "2026-11-01";
  // phiếu sửa quá hẹn (chỉ khi có expected_date) ⇒ đỏ
  await ownerSql("UPDATE public.repair_orders SET expected_date = '2026-11-02' WHERE id = $1", [repair.body.id]);
  owner.today = "2026-12-31";
  const rl = (await owner.get("/api/v1/me/badges")).body.items.find((i) => i.key === "repair_late");
  owner.today = "2026-11-01";
  assert.ok(rl && rl.overdue === rl.count && rl.count >= 1, JSON.stringify(rl));
});

test("system/status?summary=1: chỉ system.health; không lộ chi tiết lỗi; phản ánh job lỗi/quá hạn, sao lưu lỗi, lỗi mới", async () => {
  assert.equal((await sales.get("/api/v1/system/status?summary=1")).status, 403);
  assert.equal((await wh.get("/api/v1/system/status?summary=1")).status, 403);
  assert.equal((await c1.get("/api/v1/system/status?summary=1")).status, 403);
  assert.equal((await owner.get("/api/v1/system/status?summary=2")).status, 422);
  const base = await owner.get("/api/v1/system/status?summary=1");
  assert.equal(base.status, 200, JSON.stringify(base.body));
  assert.ok(["ok", "warn", "error"].includes(base.body.level));
  assert.ok(Array.isArray(base.body.issues));
  assert.equal(base.body.errors, undefined);
  assert.equal(base.body.jobs, undefined);
  // bản đầy đủ vẫn chạy như cũ cho system.health
  const full = await owner.get("/api/v1/system/status");
  assert.equal(full.status, 200);
  assert.ok(full.body.health && Array.isArray(full.body.jobs));

  await ownerSql("INSERT INTO public.job_runs (job, slot, status, started_at) VALUES ('daily', 'm11-fail', 'failed', now())");
  await ownerSql("INSERT INTO public.job_runs (job, slot, status, started_at, finished_at) VALUES ('m11x', 'm11-old', 'ok', now() - interval '40 hours', now() - interval '40 hours')");
  await ownerSql("INSERT INTO public.error_events (fingerprint, source, message) VALUES ('m11-fp', 'test', 'lỗi thử m11') ON CONFLICT DO NOTHING");
  await ownerSql("INSERT INTO public.ops_heartbeats (kind, ok, note) VALUES ('backup', false, 'm11')");
  try {
    const r = await owner.get("/api/v1/system/status?summary=1");
    assert.equal(r.body.level, "error");
    const by = Object.fromEntries(r.body.issues.map((i) => [i.key, i]));
    assert.equal(by.job_failed_daily?.level, "error");
    assert.equal(by.job_overdue_m11x?.level, "error");
    assert.equal(by.backup_failed?.level, "error");
    assert.equal(by.errors_new?.level, "warn");
    assert.ok(!JSON.stringify(r.body).includes("lỗi thử m11"), "không lộ nội dung lỗi");
    assert.equal(r.body.issues[0].level, "error", "lỗi đỏ xếp trước vàng");
  } finally {
    await ownerSql("DELETE FROM public.job_runs WHERE slot IN ('m11-fail','m11-old')");
    await ownerSql("DELETE FROM public.error_events WHERE fingerprint = 'm11-fp'");
  }
});

// Dọn: trả C1 về như cũ (bộ m5b kiểm "C1 có đúng 3 chiếc") — bỏ đơn nháp, thu hồi chiếc về kho
after(async () => {
  try {
    if (ctvDraft) await c1.del(`/api/v1/sales/${ctvDraft}`);
    if (U2 && owner) {
      const r = await owner.post(`/api/v1/collaborators/${C1}/return`, { unitId: U2.unitId, locationId: ids.l["Tủ trưng bày 1"], reason: "Dọn dữ liệu bộ kiểm tìm nhanh" }, K());
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
  } catch (e) {
    console.error("dọn m11-search lỗi:", e);
    throw e;
  }
});
