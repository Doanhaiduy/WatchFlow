// M12 — Cộng tác viên qua HTTP (CF-10…12): SC-18 (giao nhiều CTV → ai báo trước được → xác nhận → thống kê), CT-14 (đua báo bán),
// PT-14 (CTV chỉ thấy phần được phép; không thấy tiền/đơn/khách), thông báo cho người xác nhận.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, makeUnit, userOf, asUser } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, c1, c2, C1, C2;
const DAY = "2026-11-10";

test("chuẩn bị: hai CTV hoạt động", async () => {
  C1 = userOf("collaborator", 0); C2 = userOf("collaborator", 1);
  for (const u of [C1, C2]) await ownerSql("INSERT INTO public.collaborator_profiles (user_id, phone, is_active) VALUES ($1,'0900000000',true) ON CONFLICT (user_id) DO UPDATE SET is_active = true", [u.id]);
  [owner, sales, wh, c1, c2] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator"), login("collaborator", { email: C2.email })]);
  for (const c of [owner, sales, wh, c1, c2]) c.today = DAY;
});

const offer = (who, unitIds, collaboratorIds) => who.post("/api/v1/collab/offers", { unitIds, collaboratorIds }, K());
const claim = (who, unitId, extra = {}) => who.post("/api/v1/collab/me/claims", { unitId, customerName: "Khách Thử", customerPhone: "0988 123 456", ...extra }, K());
const confirm = (who, id, body = {}) => who.post(`/api/v1/collab/claims/${id}/confirm`, body, K());
let A, B, C, D, saved;

test("SC-18/1: giao A→C1,C2 và B→C2; giao lại không nhân đôi; chỉ chủ giao; chiếc đang kiểm tra không giao được", async () => {
  A = await makeUnit(8_500_000, { serial: "SC18-A" }); B = await makeUnit(5_000_000, { serial: "SC18-B" });
  C = await makeUnit(6_000_000, { serial: "SC18-C" }); D = await makeUnit(3_000_000, { serial: "SC18-D" });
  const r = await offer(owner, [A.id, B.id], [C2.id]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, 2);
  assert.equal((await offer(owner, [A.id], [C1.id, C2.id])).body.created, 1, "A cho C2 đã có ⇒ chỉ thêm C1");
  assert.equal((await offer(owner, [A.id], [C1.id])).body.created, 0);
  assert.equal((await offer(sales, [D.id], [C1.id])).status, 403);
  assert.equal((await offer(c1, [D.id], [C2.id])).status, 403);
  const insp = await makeUnit(1_000_000, { cond: "used", status: "inspecting" });
  assert.equal((await offer(owner, [insp.id], [C1.id])).body.code, "WF-COL-UNIT-NOT-OFFERABLE");
  // chiếc vẫn ở kho, vẫn bán trực tiếp được
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [A.id]))[0].status, "in_stock");
  const list = (await owner.get("/api/v1/collab/offers")).body.items;
  assert.ok(list.some((x) => x.id === A.id || x.unitId === A.id));
});

test("chủ xem danh sách/chi tiết CTV (kể cả CTV chưa có hồ sơ); CTV chưa có hồ sơ vẫn được giao; hồ sơ đã tắt thì không", async () => {
  await ownerSql("DELETE FROM public.collaborator_profiles WHERE user_id = $1", [C2.id]); // CTV mới tạo, chưa nhập SĐT/khu vực
  try {
    const list = await owner.get("/api/v1/collaborators");
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const row = list.body.items.find((x) => x.id === C2.id);
    assert.ok(row && row.isActive === true, "CTV chưa có hồ sơ vẫn hiện và hoạt động");
    for (const k of ["offered", "pendingClaims", "soldMonth", "revenueMonth"]) assert.equal(typeof row[k], "number", k);
    assert.equal((await owner.get(`/api/v1/collaborators/${C2.id}`)).status, 200);
    const E = await makeUnit(2_000_000, { serial: "SC18-E" });
    assert.equal((await offer(owner, [E.id], [C2.id])).body.created, 1, "giao được cho CTV chưa có hồ sơ");
    // tắt hồ sơ ⇒ không giao thêm được; bật lại thì giao được
    assert.equal((await owner.patch(`/api/v1/collaborators/${C2.id}`, { isActive: false })).status, 200);
    const F = await makeUnit(2_000_000, { serial: "SC18-F" });
    assert.equal((await offer(owner, [F.id], [C2.id])).body.code, "WF-VALIDATION");
    assert.equal((await sales.get("/api/v1/collaborators")).status, 403, "bán hàng không xem danh sách CTV");
    assert.equal((await owner.patch(`/api/v1/collaborators/${C2.id}`, { isActive: true })).status, 200);
    assert.equal((await offer(owner, [F.id], [C2.id])).body.created, 1);
    await owner.post("/api/v1/collab/offers/withdraw", { unitId: E.id });
    await owner.post("/api/v1/collab/offers/withdraw", { unitId: F.id });
  } finally {
    await ownerSql("INSERT INTO public.collaborator_profiles (user_id, phone, is_active) VALUES ($1,'0900000000',true) ON CONFLICT (user_id) DO UPDATE SET is_active = true", [C2.id]);
  }
});

test("PT-14: CTV thấy đúng hàng được giao + giá niêm yết; không thấy giá vốn/đơn/khách/chiếc khác/CTV khác; không gọi được API của chủ", async () => {
  const ours = new Set([A.code, B.code, C.code, D.code]); // bộ test khác có thể để lại chào hàng cho cùng CTV
  const mine1 = (await c1.get("/api/v1/collab/me/units")).body.items.filter((x) => ours.has(x.assetCode));
  assert.deepEqual(mine1.map((x) => x.assetCode).sort(), [A.code].sort());
  assert.equal(mine1[0].listPrice, 8_500_000);
  const mine2 = (await c2.get("/api/v1/collab/me/units")).body.items.filter((x) => ours.has(x.assetCode));
  assert.deepEqual(mine2.map((x) => x.assetCode).sort(), [A.code, B.code].sort());
  assert.ok(!JSON.stringify([mine1, mine2]).match(/cost|profit|revenue|customer|sale/i), "không lộ trường nhạy cảm");
  for (const p of ["/api/v1/sales", "/api/v1/customers", "/api/v1/repairs", "/api/v1/reports/revenue", "/api/v1/reports/collab", "/api/v1/collab/offers", "/api/v1/collab/claims", "/api/v1/collaborators"]) {
    assert.equal((await c1.get(p)).status, 403, p);
  }
  assert.equal((await c1.get(`/api/v1/catalog/units?q=${A.code}`)).status, 403, "CTV không duyệt kho");
  // lớp 2 (DB): dưới wf_app, CTV không đọc được bảng đơn/khách/chiếc/bảo hành/giá vốn
  for (const t of ["sales", "sale_lines", "customers", "watch_units", "warranties", "sale_line_costs", "unit_cost_entries"]) {
    const n = (await asUser(C1.id, (cn) => cn.query(`SELECT count(*)::int n FROM public.${t}`).then((x) => x.rows[0].n).catch(() => 0)));
    assert.equal(n, 0, t);
  }
  // chào hàng/báo bán: RLS chỉ cho CTV thấy dòng của chính mình (không có tiền trong các bảng này)
  for (const t of ["collaborator_offers", "collaborator_claims"]) {
    const n = await asUser(C1.id, (cn) => cn.query(`SELECT count(*)::int n FROM public.${t} WHERE collaborator_id <> app.current_user_id()`).then((x) => x.rows[0].n));
    assert.equal(n, 0, t + ": không thấy của CTV khác");
  }
  const stats = await c1.get("/api/v1/collab/me/stats?period=month");
  assert.equal(stats.status, 200);
  assert.deepEqual(Object.keys(stats.body.rows[0] ?? { periodStart: 1, unitsSold: 1 }).sort(), ["periodStart", "unitsSold"]);
});

let claimA;
test("SC-18/2: C1 báo bán A ⇒ pending; C2 báo A ⇒ WF-COL-CLAIMED; C1 báo lại ⇒ WF-COL-CLAIMED-SELF; cửa hàng không bán chen; không thu hồi khi có báo bán", async () => {
  const r = await claim(c1, A.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  claimA = r.body.id;
  assert.equal((await claim(c2, A.id)).body.code, "WF-COL-CLAIMED");
  assert.equal((await claim(c1, A.id)).body.code, "WF-COL-CLAIMED-SELF");
  assert.equal((await claim(c1, B.id)).status >= 400, true, "B không giao cho C1");
  // C2 thấy A đã có người báo
  assert.equal((await c2.get("/api/v1/collab/me/units")).body.items.find((x) => x.assetCode === A.code).taken, true);
  // cửa hàng không ghi đơn chiếc đang có báo bán chờ
  const KHid = (await ownerSql("SELECT id FROM public.customers LIMIT 1"))[0].id;
  assert.equal((await sales.post("/api/v1/sales", { customerId: KHid, lines: [{ unitId: A.id, price: 8_500_000 }] }, K())).body.code, "WF-SALE-UNIT-CLAIMED");
  assert.equal((await owner.post("/api/v1/collab/offers/withdraw", { unitId: A.id, collaboratorId: C1.id })).body.code, "WF-COL-CLAIM-PENDING");
  // CTV không tự xác nhận được
  assert.equal((await confirm(c1, claimA)).status, 403);
  // chủ/nhân viên thấy báo bán chờ + thông báo
  const pending = (await sales.get("/api/v1/collab/claims?status=pending")).body.items;
  assert.ok(pending.some((x) => x.id === claimA));
  assert.equal((await wh.get("/api/v1/collab/claims")).status, 403);
  const mine = (await c1.get("/api/v1/collab/me/claims")).body.items.find((x) => x.id === claimA);
  assert.equal(mine.status, "pending");
  assert.ok(!("price" in mine) && !("salePrice" in mine));
});

test("CT-14: C1 và C2 cùng báo bán B song song ⇒ đúng một thành công, người kia WF-COL-CLAIMED", async () => {
  await offer(owner, [B.id], [C1.id]);
  const [a, b] = await Promise.all([claim(c1, B.id), claim(c2, B.id)]);
  const codes = [a, b].map((r) => (r.status === 200 ? "OK" : r.body.code)).sort();
  assert.deepEqual(codes, ["OK", "WF-COL-CLAIMED"]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.collaborator_claims WHERE unit_id=$1 AND status='pending'", [B.id]))[0].n, 1);
});

test("thông báo: người xác nhận nhận 'CTV báo đã bán' (outbox)", async () => {
  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    found = (await sales.get("/api/v1/notifications")).body.items.some((x) => /collab\./.test(x.type));
    if (!found) await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(found, "thông báo báo bán");
});

test("SC-18/4–5: xác nhận A mặc định giá niêm yết ⇒ đơn 8.500.000, A sold, C1 won, C2 lost; xác nhận B giá sửa 4.500.000; từ chối cần lý do", async () => {
  const r = await confirm(sales, claimA);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.price, 8_500_000);
  assert.match(r.body.code, /^HD-/);
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [A.id]))[0].status, "sold");
  const offers = await ownerSql("SELECT collaborator_id, status FROM public.collaborator_offers WHERE unit_id=$1 ORDER BY status", [A.id]);
  assert.deepEqual(offers.map((o) => [o.collaborator_id === C1.id, o.status]).sort(), [[false, "lost"], [true, "won"]].sort());
  const sale = (await sales.get(`/api/v1/sales/${r.body.saleId}`)).body;
  assert.deepEqual([sale.grandTotal, sale.collaboratorId, sale.customerName], [8_500_000, C1.id, "Khách Thử"]);
  assert.deepEqual(sale.lines.map((l) => l.warrantyEnd), ["2027-11-10"]);
  // C1 xem được báo bán đã xác nhận nhưng không thấy giá/đơn
  const mine = (await c1.get("/api/v1/collab/me/claims")).body.items.find((x) => x.id === claimA);
  assert.equal(mine.status, "confirmed");
  assert.ok(!JSON.stringify(mine).match(/8500000|HD-/));
  assert.equal((await c1.get(`/api/v1/sales/${r.body.saleId}`)).status, 403);
  // B: người báo trước (không rõ C1 hay C2) — lấy từ DB; chủ sửa giá
  const [cb] = await ownerSql("SELECT id, collaborator_id FROM public.collaborator_claims WHERE unit_id=$1 AND status='pending'", [B.id]);
  const lowReason = await sales.post(`/api/v1/collab/claims/${cb.id}/reject`, { reason: "ngắn" });
  assert.equal(lowReason.status, 422, "lý do ngắn bị chặn");
  const cf = await confirm(owner, cb.id, { price: 4_500_000 });
  assert.equal(cf.status, 200, JSON.stringify(cf.body));
  assert.equal(cf.body.price, 4_500_000);
  assert.equal((await confirm(owner, cb.id)).status >= 400, true, "đã xử lý thì không xác nhận lại");
  saved = { saleA: r.body.saleId, saleB: cf.body.saleId, collabB: cb.collaborator_id };
});

test("SC-18/5: từ chối báo bán với lý do đủ ⇒ rejected, chào hàng còn nguyên, chiếc mở lại; CTV rút báo bán", async () => {
  await offer(owner, [C.id, D.id], [C1.id]);
  const cc = await claim(c1, C.id);
  const rj = await sales.post(`/api/v1/collab/claims/${cc.body.id}/reject`, { reason: "Khách không mua nữa theo báo" });
  assert.equal(rj.status, 200, JSON.stringify(rj.body));
  assert.equal((await c1.get("/api/v1/collab/me/claims")).body.items.find((x) => x.id === cc.body.id).status, "rejected");
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_offers WHERE unit_id=$1", [C.id]))[0].status, "active");
  const again = await claim(c1, C.id);
  assert.equal(again.status, 200, "chiếc mở lại cho CTV báo tiếp");
  assert.equal((await c2.post(`/api/v1/collab/me/claims/${again.body.id}/cancel`)).status >= 400, true, "chỉ chính CTV rút được");
  assert.equal((await c1.post(`/api/v1/collab/me/claims/${again.body.id}/cancel`)).status, 200);
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_claims WHERE id=$1", [again.body.id]))[0].status, "cancelled");
});

test("SC-18/6: thu hồi chào hàng từng CTV; hủy đơn A ⇒ A về kho, báo bán voided, chào hàng không tự mở lại", async () => {
  // D giao C1 rồi thu hồi
  const w = await owner.post("/api/v1/collab/offers/withdraw", { unitId: D.id, collaboratorId: C1.id });
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.collaborator_offers WHERE unit_id=$1 AND status='active'", [D.id]))[0].n, 0);
  // hủy đơn A (trong 24 giờ)
  await reauth(owner);
  const v = await owner.post(`/api/v1/sales/${saved.saleA}/void`, { reason: "CTV báo nhầm khách hàng" }, K());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [A.id]))[0].status, "in_stock");
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_claims WHERE unit_id=$1 ORDER BY created_at LIMIT 1", [A.id]))[0].status, "voided");
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.collaborator_offers WHERE unit_id=$1 AND status='active'", [A.id]))[0].n, 0, "chào hàng không tự mở lại");
  assert.equal((await offer(owner, [A.id], [C1.id])).body.created, 1, "giao lại được");
});

test("bất biến I13–I15 và fn_consistency_check sạch sau luồng CTV", async () => {
  assert.deepEqual(await ownerSql("SELECT * FROM app.fn_consistency_check()"), []);
});
