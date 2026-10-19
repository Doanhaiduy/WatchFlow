// M11 (bản gọn) — Tìm nhanh & điều hướng: GET /api/v1/search (Ctrl+K), GET /api/v1/me/badges (huy hiệu số việc), GET /api/v1/system/status?summary=1.
// FR-NAV-01/02/03. Kiểm: tìm serial/mã/không dấu, phạm vi theo quyền + RLS (CTV không có nhóm kết quả nào), không có trường giá vốn/giá, q ngắn ⇒ 422,
// huy hiệu đúng theo quyền (đỏ khi quá hạn), summary vận hành chỉ cho system.health.
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { login, ownerSql, userOf, Client, makeUnit } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, c1;
let U1, UL, SALE, repair, claimU;

const search = (c, q) => c.get("/api/v1/search?q=" + encodeURIComponent(q));
const assetOf = async (id) => (await ownerSql("SELECT asset_code FROM public.watch_units WHERE id=$1", [id]))[0].asset_code;
const FORBIDDEN_FIELDS = /cost|profit|margin|basePrice|unitPrice|listPrice|effectivePrice|price|giá vốn|lãi/i;

test("chuẩn bị: đăng nhập, dữ liệu mẫu (chiếc, khách, đơn bán, phiếu sửa, lô 6 chiếc)", async () => {
  [owner, sales, wh, c1] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  for (const c of [owner, sales, wh, c1]) c.today = "2026-11-01";
  await ownerSql("INSERT INTO public.collaborator_profiles (user_id, phone, is_active) VALUES ($1,'0900000000',true) ON CONFLICT (user_id) DO UPDATE SET is_active = true", [userOf("collaborator").id]);
  U1 = await makeUnit(14_000_000, { serial: "QS-ALPHA-7731" });
  claimU = await makeUnit(8_500_000, { serial: "QS-BETA-8842" });
  UL = [];
  for (const t of ["T1", "T2", "T3", "T4", "T5", "T6"]) UL.push(await makeUnit(1_800_000, { serial: "LIM-" + t }));

  const kh = await sales.post("/api/v1/customers", { fullName: "Lê Thị Quỳnh Xuyến", phone: "0988123456", force: true });
  assert.equal(kh.status, 200, JSON.stringify(kh.body));
  assert.equal((await owner.post("/api/v1/customers", { fullName: "Phạm Quỳnh Khác", phone: "0966777888", force: true })).status, 200);
  SALE = await sales.post("/api/v1/sales", { customerId: kh.body.id, lines: [{ unitId: UL[0].id, price: 1_800_000 }] }, K());
  assert.equal(SALE.status, 200, JSON.stringify(SALE.body));
  repair = await owner.post("/api/v1/repairs", { customerId: kh.body.id, brandText: "Casio", serialNo: "CS-QS-1", intakeCondition: "trầy", complaint: "chạy chậm" }, K());
  assert.equal(repair.status, 200, JSON.stringify(repair.body));
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
    assert.equal(r.body.exactUnitId, U1.id, `q=${q}`);
    assert.equal(r.body.units[0].id, U1.id);
    assert.equal(r.body.units[0].exact, true);
    assert.equal(r.body.units[0].serialNo, "QS-ALPHA-7731");
  }
});

test("tìm theo mã nội bộ khớp chính xác; mã một phần ⇒ có kết quả nhưng không phải exact", async () => {
  const code = await assetOf(U1.id);
  const r = await search(owner, code.toLowerCase());
  assert.equal(r.body.exactUnitId, U1.id);
  assert.equal(r.body.units[0].assetCode, code);
  const part = await search(owner, "QS-ALPHA");
  assert.equal(part.body.exactUnitId, null);
  assert.ok(part.body.units.some((u) => u.id === U1.id && u.exact === false));
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
  assert.deepEqual((await search(owner, "khongcoai")).body.customers, []);
});

test("phiếu theo mã: đơn bán, phiếu sửa; tìm không phân biệt hoa/thường", async () => {
  const r1 = await search(owner, repair.body.code.toLowerCase());
  assert.equal(r1.body.repairs[0].code, repair.body.code);
  assert.equal(r1.body.repairs[0].id, repair.body.id);
  const r3 = await search(sales, SALE.body.code.toLowerCase());
  assert.ok(r3.body.sales.some((s) => s.id === SALE.body.id), "tìm đơn bán theo mã");
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
  const s = (await search(sales, "quynh")).body;
  assert.ok(Array.isArray(s.units) && Array.isArray(s.customers) && Array.isArray(s.sales));
  assert.equal(s.repairs, undefined, "bán hàng không có repair.view");
  const w = (await search(wh, "QS-")).body;
  assert.ok(Array.isArray(w.units));
  for (const k of ["customers", "sales", "repairs"]) assert.equal(w[k], undefined, "kho không có nhóm " + k);
  const o = (await search(owner, "QS-")).body;
  for (const k of ["units", "customers", "sales", "repairs"]) assert.ok(Array.isArray(o[k]), "chủ có nhóm " + k);
  for (const k of ["purchases", "reservations", "parts"]) assert.equal(o[k], undefined, "nhóm đã bỏ: " + k);
});

test("PT-14: CTV không tìm được gì — không chiếc, khách, đơn, phiếu sửa (dù gõ đúng serial)", async () => {
  for (const q of ["QS-ALPHA-7731", "quynh", repair.body.code, SALE.body.code]) {
    const r = (await search(c1, q)).body;
    assert.equal(r.exactUnitId, null);
    for (const k of ["units", "customers", "sales", "repairs"]) assert.equal(r[k], undefined, `q=${q} nhóm ${k}`);
  }
});

test("không có trường giá vốn/lợi nhuận/giá trong kết quả tìm (mọi vai trò)", async () => {
  for (const [c, q] of [[owner, "QS-"], [owner, "quynh"], [sales, "QS-"], [wh, "QS-"], [c1, "QS-"], [owner, "LIM-T"]]) {
    const body = (await search(c, q)).body;
    const keys = JSON.stringify(Object.keys(body)) + JSON.stringify(Object.values(body).flat().flatMap((x) => (x && typeof x === "object" ? Object.keys(x) : [])));
    assert.ok(!FORBIDDEN_FIELDS.test(keys), `q=${q}: có trường cấm ${keys}`);
  }
});

test("huy hiệu: đúng theo QUYỀN; CTV báo bán ⇒ vàng cho người xác nhận, đỏ khi chờ quá 1 ngày; không có số tiền", async () => {
  await owner.post("/api/v1/collab/offers", { unitIds: [claimU.id], collaboratorIds: [userOf("collaborator").id] }, K());
  const cl = await c1.post("/api/v1/collab/me/claims", { unitId: claimU.id, customerName: "Khách Báo", customerPhone: "0911 222 333" }, K());
  assert.equal(cl.status, 200, JSON.stringify(cl.body));

  const o = (await owner.get("/api/v1/me/badges")).body;
  assert.equal(typeof o.total, "number");
  const pend = o.items.find((i) => i.key === "claim_pending");
  assert.ok(pend && pend.navId === "collaborators" && pend.count >= 1 && pend.overdue === 0, JSON.stringify(o));
  assert.ok(o.items.find((i) => i.key === "repair_new" && i.navId === "repairs" && i.count >= 1), "máy mới nhận chờ xử lý");
  assert.equal(o.total, o.items.reduce((s, i) => s + i.count, 0));
  for (const i of o.items) assert.deepEqual(Object.keys(i).sort(), ["count", "key", "label", "navId", "overdue"], "chỉ số lượng — không có tiền");

  const s = (await sales.get("/api/v1/me/badges")).body;
  assert.ok(s.items.some((i) => i.key === "claim_pending"), "bán hàng có sale.confirm");
  assert.ok(!s.items.some((i) => i.navId === "repairs"), "bán hàng không có repair.view");
  assert.deepEqual((await wh.get("/api/v1/me/badges")).body.items, [], "kho không thấy việc bán/sửa");
  assert.deepEqual((await c1.get("/api/v1/me/badges")).body.items, [], "CTV không có huy hiệu");

  // chờ quá 1 ngày ⇒ đỏ
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("SELECT set_config('app.in_fn','on',false)");
    await c.query("UPDATE public.collaborator_claims SET created_at = now() - interval '2 days' WHERE id = $1", [cl.body.id]);
  } finally { await c.end(); }
  const red = (await owner.get("/api/v1/me/badges")).body.items.find((i) => i.key === "claim_pending");
  assert.ok(red.overdue >= 1, JSON.stringify(red));
  // dọn: từ chối báo bán + thu hồi chào hàng để không ảnh hưởng bộ khác
  assert.equal((await owner.post(`/api/v1/collab/claims/${cl.body.id}/reject`, { reason: "Dọn dữ liệu bộ kiểm tìm nhanh" })).status, 200);
  assert.equal((await owner.post("/api/v1/collab/offers/withdraw", { unitId: claimU.id })).status, 200);
});

test("huy hiệu: phiếu sửa quá hẹn ⇒ ĐỎ (ngày giả +60)", async () => {
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
