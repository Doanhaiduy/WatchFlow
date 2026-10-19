// Bản gọn (CF-10…CF-18) — mức DB: chào hàng nhiều CTV, "ai báo trước được" (kể cả đua đồng thời), xác nhận/từ chối/rút báo bán,
// ghi đơn bán gọn + hạn bảo hành, hủy đơn, CTV không thấy tiền/khách/đơn, báo cáo, bất biến I13–I15.
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { ownerSql, asUser, userOf, expectWf } from "./_lib.mjs";

const owner = userOf("owner"), sales = userOf("sales"), wh = userOf("warehouse"), c1 = userOf("collaborator"), c2 = userOf("collaborator", 1);
const q = async (user, sql, p) => asUser(user.id, async (c) => (await c.query(sql, p)).rows);
let model, loc, seq = 0;

async function mkUnit(price, { cond = "new", status = "in_stock" } = {}) {
  const code = `SM-${Date.now().toString(36)}-${++seq}`;
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("SELECT set_config('app.seed','on',false)");
    const r = await c.query(
      `INSERT INTO public.watch_units (asset_code, model_id, brand_id, serial_no, condition, condition_grade, status, location_id, list_price_vnd)
       VALUES ($1,$2,$3,$1,$4,$5,$6,$7,$8) RETURNING id`,
      [code, model.id, model.brand_id, cond, cond === "new" ? null : "A", status, loc.id, price]);
    return { id: r.rows[0].id, code };
  } finally { await c.end(); }
}
const unitRow = async (id) => (await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [id]))[0];
const offers = (id) => ownerSql("SELECT collaborator_id, status FROM public.collaborator_offers WHERE unit_id=$1 ORDER BY offered_at, collaborator_id", [id]);
const offer = (u, who, collabs) => q(who, "SELECT app.fn_offer_units($1::uuid[], $2::uuid[], 'thử') r", [[u], collabs]);
const claim = (u, who, name = "Khách Thử", phone = "0988123456") => q(who, "SELECT app.fn_collab_claim($1,$2,$3,'ghi chú') r", [u, name, phone]);
const confirm = (who, claimId, ...a) => q(who, "SELECT app.fn_confirm_claim($1,$2,$3,$4) r", [claimId, ...[a[0] ?? null, a[1] ?? null, a[2] ?? null]]);

test("chuẩn bị: mẫu đồng hồ, kho, hồ sơ CTV", async () => {
  [model] = await ownerSql("SELECT id, brand_id FROM public.watch_models ORDER BY code LIMIT 1");
  [loc] = await ownerSql("SELECT id FROM public.storage_locations ORDER BY name LIMIT 1");
  for (const u of [c1, c2]) {
    await ownerSql(`INSERT INTO public.collaborator_profiles (user_id, phone, is_active) VALUES ($1, '0900000000', true)
                    ON CONFLICT (user_id) DO UPDATE SET is_active = true`, [u.id]);
  }
  // Vai trò CTV chỉ còn collab.view_own
  const perms = (await ownerSql(`SELECT rp.permission_code p FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id WHERE r.code='collaborator'`)).map((x) => x.p);
  assert.deepEqual(perms, ["collab.view_own"]);
});

let T1, T2;
test("giao một chiếc cho 2 CTV: chiếc VẪN in_stock, mỗi CTV một chào hàng; giao lại không nhân đôi; sai quyền/trạng thái bị chặn", async () => {
  T1 = await mkUnit(8_500_000);
  const r = (await offer(T1.id, owner, [c1.id, c2.id]))[0].r;
  assert.equal(r.created, 2);
  assert.equal((await unitRow(T1.id)).status, "in_stock");
  assert.deepEqual((await offers(T1.id)).map((o) => o.status), ["active", "active"]);
  assert.equal((await offer(T1.id, owner, [c1.id]))[0].r.created, 0, "giao lại cho cùng CTV không tạo thêm");
  await expectWf(offer(T1.id, sales, [c1.id]), "WF-AUTH-FORBIDDEN");
  await expectWf(offer(T1.id, wh, [c1.id]), "WF-AUTH-FORBIDDEN");
  await expectWf(offer(T1.id, c1, [c2.id]), "WF-AUTH-FORBIDDEN");
  const insp = await mkUnit(1_000_000, { cond: "used", status: "inspecting" });
  await expectWf(offer(insp.id, owner, [c1.id]), "WF-COL-UNIT-NOT-OFFERABLE");
  await expectWf(offer(T1.id, owner, [owner.id]), "WF-VALIDATION"); // không phải CTV
});

test("CTV thấy chiếc được giao + giá niêm yết, KHÔNG thấy giá vốn/đơn/khách/chiếc khác (PT-02/PT-03)", async () => {
  const mine = await q(c1, "SELECT * FROM app.fn_my_offers()");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].asset_code, T1.code);
  assert.equal(mine[0].list_price_vnd, 8_500_000);
  assert.equal(mine[0].taken, false);
  assert.ok(!Object.keys(mine[0]).some((k) => /cost|profit|revenue|base_price/.test(k)), "không có cột giá vốn/doanh thu");
  const other = await mkUnit(2_000_000); // không giao ai
  assert.ok(!(await q(c1, "SELECT * FROM app.fn_my_offers()")).some((r) => r.unit_id === other.id));
  for (const t of ["public.sales", "public.sale_lines", "public.customers", "public.watch_units", "public.warranties", "public.sale_line_costs"]) {
    const rows = await q(c1, `SELECT count(*)::int n FROM ${t}`).catch(() => [{ n: 0 }]);
    assert.equal(rows[0].n, 0, `CTV không đọc được ${t}`);
  }
  // CTV chỉ thấy chào hàng của chính mình
  assert.equal((await q(c1, "SELECT count(*)::int n FROM public.collaborator_offers WHERE collaborator_id <> $1", [c1.id]))[0].n, 0);
  assert.equal((await q(sales, "SELECT count(*)::int n FROM public.collaborator_offers"))[0].n, 0, "nhân viên bán hàng không thấy chào hàng");
  // hàm báo cáo cũ trả tiền: CTV bị chặn
  await expectWf(q(c1, "SELECT * FROM app.rpt_collaborator('2020-01-01','2030-01-01','month')"), "WF-AUTH-FORBIDDEN");
  await expectWf(q(c1, "SELECT app.rpt_revenue('2020-01-01','2030-01-01','month')"), "WF-AUTH-FORBIDDEN");
  await expectWf(q(c1, "SELECT app.rpt_collab_sales('2020-01-01','2030-01-01','month')"), "WF-AUTH-FORBIDDEN");
  await expectWf(q(c1, "SELECT app.fn_record_sale(NULL, NULL, '[]')"), "WF-AUTH-FORBIDDEN");
});

let claim1;
test("CTV báo đã bán: ai báo trước được giữ; người sau/ chính mình báo lại bị chặn; cửa hàng không bán chen; không thu hồi khi có báo chờ", async () => {
  const r = (await claim(T1.id, c1))[0].r;
  claim1 = r.id;
  assert.equal(r.status, "pending");
  await expectWf(claim(T1.id, c2), "WF-COL-CLAIMED");
  await expectWf(claim(T1.id, c1), "WF-COL-CLAIMED-SELF");
  assert.equal((await q(c2, "SELECT taken FROM app.fn_my_offers() WHERE unit_id=$1", [T1.id]))[0].taken, true);
  assert.equal((await q(c1, "SELECT claim_id FROM app.fn_my_offers() WHERE unit_id=$1", [T1.id]))[0].claim_id, claim1);
  // người không được giao
  const T = await mkUnit(1_000_000);
  await expectWf(claim(T.id, c1), "WF-COL-NO-OFFER");
  // validate dữ liệu khách
  await expectWf(claim(T1.id, c2, "", "0988123456"), "WF-VALIDATION");
  await expectWf(claim(T1.id, c2, "A", "12"), "WF-VALIDATION");
  // ghi đơn bán chen vào chiếc đang có báo chờ
  const cust = (await ownerSql("SELECT id FROM public.customers LIMIT 1"))[0];
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, NULL, $2::jsonb) r", [cust.id, JSON.stringify([{ unitId: T1.id, price: 8_000_000 }])]), "WF-SALE-UNIT-CLAIMED");
  await expectWf(q(owner, "SELECT app.fn_withdraw_offer($1, $2)", [T1.id, c1.id]), "WF-COL-CLAIM-PENDING");
  // CTV khác không rút được báo của mình
  await expectWf(q(c2, "SELECT app.fn_cancel_claim($1)", [claim1]), "WF-NOT-FOUND");
  // CTV không tự xác nhận / từ chối
  await expectWf(confirm(c1, claim1), "WF-AUTH-FORBIDDEN");
  await expectWf(q(c1, "SELECT app.fn_reject_claim($1, 'không được phép làm vậy')", [claim1]), "WF-AUTH-FORBIDDEN");
  // CTV thấy báo của mình, không có cột tiền
  const mc = await q(c1, "SELECT * FROM app.fn_my_claims()");
  assert.equal(mc.length, 1);
  assert.ok(!Object.keys(mc[0]).some((k) => /price|cost|revenue|total/.test(k)));
  assert.equal((await q(c2, "SELECT * FROM app.fn_my_claims()")).length, 0, "CTV khác không thấy báo của C1");
  // chủ/nhân viên bán hàng thấy hàng chờ duyệt
  assert.equal((await q(sales, "SELECT count(*)::int n FROM public.collaborator_claims WHERE status='pending'"))[0].n >= 1, true);
});

test("đua đồng thời: hai CTV cùng báo một chiếc ⇒ đúng MỘT thắng (CT)", async () => {
  T2 = await mkUnit(5_000_000);
  await offer(T2.id, owner, [c1.id, c2.id]);
  const res = await Promise.allSettled([claim(T2.id, c1, "Khách A", "0911000111"), claim(T2.id, c2, "Khách B", "0911000222")]);
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  const lose = res.find((r) => r.status === "rejected");
  assert.match(lose.reason.message, /WF-COL-CLAIMED/);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.collaborator_claims WHERE unit_id=$1 AND status='pending'", [T2.id]))[0].n, 1);
});

test("rút báo bán (CTV) ⇒ chiếc lại cho CTV khác báo; từ chối (cần lý do ≥ 10 ký tự) ⇒ chào hàng còn nguyên", async () => {
  const mine = (await ownerSql("SELECT id, collaborator_id FROM public.collaborator_claims WHERE unit_id=$1 AND status='pending'", [T2.id]))[0];
  const holder = mine.collaborator_id === c1.id ? c1 : c2, other = holder === c1 ? c2 : c1;
  await q(holder, "SELECT app.fn_cancel_claim($1)", [mine.id]);
  await expectWf(q(holder, "SELECT app.fn_cancel_claim($1)", [mine.id]), "WF-COL-CLAIM-DECIDED");
  const again = (await claim(T2.id, other, "Khách C", "0911000333"))[0].r;
  await expectWf(q(sales, "SELECT app.fn_reject_claim($1, 'ngắn')", [again.id]), "WF-REASON-REQUIRED");
  await q(sales, "SELECT app.fn_reject_claim($1, 'Khách không nhận hàng, báo nhầm')", [again.id]);
  const st = (await ownerSql("SELECT status, reject_reason FROM public.collaborator_claims WHERE id=$1", [again.id]))[0];
  assert.equal(st.status, "rejected");
  assert.equal((await unitRow(T2.id)).status, "in_stock");
  assert.deepEqual((await offers(T2.id)).map((o) => o.status), ["active", "active"], "chào hàng không bị đóng khi từ chối báo bán");
  // thông báo cho CTV bị từ chối
  assert.ok((await ownerSql("SELECT 1 FROM public.notifications WHERE user_id=$1 AND type='collab.claim_rejected'", [other.id])).length >= 1);
  await expectWf(q(sales, "SELECT app.fn_reject_claim($1, 'đã xử lý rồi mà')", [again.id]), "WF-COL-CLAIM-DECIDED");
});

let saleCode, saleId, claimLine;
test("xác nhận báo bán: đơn bán ra đời với giá niêm yết; chiếc sold; CTV thắng 'won', CTV khác 'lost'; khách tạo; bảo hành 12 tháng; có giá vốn chốt", async () => {
  const cl = (await confirm(sales, claim1))[0].r;
  assert.equal(cl.price, 8_500_000, "giá mặc định = giá niêm yết");
  saleId = cl.saleId; saleCode = cl.code;
  assert.match(saleCode, /^HD-\d{4}-\d+$/);
  assert.equal((await unitRow(T1.id)).status, "sold");
  const os = await offers(T1.id);
  assert.equal(os.find((o) => o.collaborator_id === c1.id).status, "won");
  assert.equal(os.find((o) => o.collaborator_id === c2.id).status, "lost");
  const s = (await ownerSql("SELECT status, collaborator_id, grand_total_vnd, subtotal_list_vnd, customer_id FROM public.sales WHERE id=$1", [saleId]))[0];
  assert.equal(s.status, "confirmed");
  assert.equal(s.collaborator_id, c1.id);
  assert.equal(s.grand_total_vnd, 8_500_000);
  const [ln] = await ownerSql("SELECT id, shop_revenue_vnd, line_total_vnd, is_effective FROM public.sale_lines WHERE sale_id=$1", [saleId]);
  claimLine = ln.id;
  assert.equal(ln.shop_revenue_vnd, 8_500_000);
  assert.equal(ln.is_effective, true);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.sale_line_costs WHERE sale_line_id=$1", [ln.id]))[0].n, 1);
  const cust = (await ownerSql("SELECT full_name, phone FROM public.customers WHERE id=$1", [s.customer_id]))[0];
  assert.equal(cust.full_name, "Khách Thử");
  const w = (await ownerSql("SELECT end_date::text e, start_date::text s, status FROM public.warranties WHERE sale_line_id=$1", [ln.id]))[0];
  assert.equal(w.status, "active");
  const exp = (await ownerSql("SELECT (app.today_vn() + interval '12 months')::date::text d"))[0].d;
  assert.equal(w.e, exp);
  // thông báo: thắng & thua
  assert.ok((await ownerSql("SELECT 1 FROM public.notifications WHERE user_id=$1 AND type='collab.claim_confirmed'", [c1.id])).length >= 1);
  assert.ok((await ownerSql("SELECT 1 FROM public.notifications WHERE user_id=$1 AND type='collab.offer_lost'", [c2.id])).length >= 1);
  // xử lý lại
  await expectWf(confirm(sales, claim1), "WF-COL-CLAIM-DECIDED");
  // CTV thắng KHÔNG thấy đơn, khách, giá — chỉ thấy trạng thái báo của mình
  assert.equal((await q(c1, "SELECT count(*)::int n FROM public.sales"))[0].n, 0);
  assert.equal((await q(c1, "SELECT * FROM app.fn_my_claims() WHERE id = $1", [claim1]))[0].status, "confirmed");
  assert.equal((await q(c1, "SELECT * FROM app.fn_my_offers() WHERE unit_id=$1", [T1.id])).length, 0, "chiếc đã bán không còn trong danh sách");
  assert.equal((await q(c2, "SELECT * FROM app.fn_my_offers() WHERE unit_id=$1", [T1.id])).length, 0);
  const st = await q(c1, "SELECT * FROM app.fn_my_collab_stats('2020-01-01','2099-12-31','month')");
  assert.equal(st.length, 1);
  assert.equal(st[0].units_sold, 1);
  assert.deepEqual(Object.keys(st[0]).sort(), ["period_start", "units_sold"], "thống kê CTV chỉ có số chiếc");
});

test("chủ sửa giá khi xác nhận (CF-12); ghi lùi quá hạn mức bị chặn với nhân viên; giá ≤ 0 bị chặn", async () => {
  const T3 = await mkUnit(6_000_000);
  await offer(T3.id, owner, [c2.id]);
  const cl = (await claim(T3.id, c2, "Khách Giá", "0911000999"))[0].r;
  await expectWf(confirm(sales, cl.id, 0), "WF-VALIDATION");
  await expectWf(confirm(sales, cl.id, 5_500_000, "2020-01-01"), "WF-DOC-BACKDATE");
  const r = (await confirm(sales, cl.id, 5_500_000))[0].r;
  assert.equal(r.price, 5_500_000);
  const [s] = await ownerSql("SELECT grand_total_vnd, subtotal_list_vnd, discount_total_vnd FROM public.sales WHERE id=$1", [r.saleId]);
  assert.deepEqual([s.grand_total_vnd, s.subtotal_list_vnd, s.discount_total_vnd], [5_500_000, 6_000_000, 500_000]);
  // khách trùng SĐT được dùng lại, không tạo bản sao
  const T4 = await mkUnit(3_000_000);
  await offer(T4.id, owner, [c2.id]);
  const cl2 = (await claim(T4.id, c2, "Khách Giá (lần 2)", "0911000999"))[0].r;
  const r2 = (await confirm(sales, cl2.id))[0].r;
  const cs = await ownerSql("SELECT DISTINCT customer_id FROM public.sales WHERE id = ANY($1)", [[r.saleId, r2.saleId]]);
  assert.equal(cs.length, 1, "cùng SĐT ⇒ cùng một khách");
});

test("hủy đơn bán do CTV: chiếc về in_stock, báo bán → voided, bảo hành voided; chào hàng KHÔNG tự sống lại; quyền + hạn 24 giờ", async () => {
  await expectWf(q(sales, "SELECT app.fn_void_sale($1, 'hủy thử nhân viên')", [saleId]), "WF-AUTH-FORBIDDEN");
  await expectWf(q(owner, "SELECT app.fn_void_sale($1, 'ngắn')", [saleId]), "WF-REASON-REQUIRED");
  await q(owner, "SELECT app.fn_void_sale($1, 'Khách trả lại, nhập sai đơn')", [saleId]);
  assert.equal((await unitRow(T1.id)).status, "in_stock");
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_claims WHERE id=$1", [claim1]))[0].status, "voided");
  assert.equal((await ownerSql("SELECT status FROM public.warranties WHERE sale_line_id=$1", [claimLine]))[0].status, "voided");
  assert.equal((await ownerSql("SELECT status FROM public.sales WHERE id=$1", [saleId]))[0].status, "voided");
  assert.equal((await offers(T1.id)).filter((o) => o.status === "active").length, 0);
  await expectWf(q(owner, "SELECT app.fn_void_sale($1, 'hủy lần hai thử')", [saleId]), "WF-DOC-NOT-DRAFT");
  // giao lại sau khi hủy được
  assert.equal((await offer(T1.id, owner, [c2.id]))[0].r.created, 1);
});

let rec;
test("ghi đơn bán gọn: 2 chiếc + khách + giá; bảo hành mặc định 12/3 tháng, tùy chỉnh được; không nợ/thanh toán", async () => {
  const cust = (await ownerSql("SELECT id FROM public.customers ORDER BY created_at LIMIT 1"))[0];
  const a = await mkUnit(9_000_000), b = await mkUnit(2_500_000, { cond: "used" });
  const lines = [{ unitId: a.id, price: 8_700_000 }, { unitId: b.id, price: 2_500_000, warrantyMonths: 0 }];
  await expectWf(q(sales, "SELECT app.fn_record_sale(NULL, NULL, $1::jsonb)", [JSON.stringify(lines)]), "WF-SALE-CUSTOMER-REQUIRED");
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, NULL, '[]')", [cust.id]), "WF-VALIDATION");
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, NULL, $2::jsonb)", [cust.id, JSON.stringify([lines[0], lines[0]])]), "WF-VALIDATION");
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, (app.today_vn() + 1), $2::jsonb)", [cust.id, JSON.stringify(lines)]), "WF-DOC-FUTURE");
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, (app.today_vn() - 30), $2::jsonb)", [cust.id, JSON.stringify(lines)]), "WF-DOC-BACKDATE");
  await expectWf(q(wh, "SELECT app.fn_record_sale($1, NULL, $2::jsonb)", [cust.id, JSON.stringify(lines)]), "WF-AUTH-FORBIDDEN");
  rec = (await q(sales, "SELECT app.fn_record_sale($1, NULL, $2::jsonb, 'ghi chú đơn') r", [cust.id, JSON.stringify(lines)]))[0].r;
  assert.equal(rec.grandTotal, 11_200_000);
  assert.equal((await unitRow(a.id)).status, "sold");
  assert.equal((await unitRow(b.id)).status, "sold");
  const [s] = await ownerSql("SELECT status, collaborator_id, grand_total_vnd, subtotal_list_vnd, discount_total_vnd, note FROM public.sales WHERE id=$1", [rec.id]);
  assert.deepEqual([s.status, s.collaborator_id, s.grand_total_vnd, s.subtotal_list_vnd, s.discount_total_vnd, s.note], ["confirmed", null, 11_200_000, 11_500_000, 300_000, "ghi chú đơn"]);
  const ws = await ownerSql("SELECT unit_id, end_date::text e FROM public.warranties w WHERE sale_line_id IN (SELECT id FROM public.sale_lines WHERE sale_id=$1)", [rec.id]);
  assert.equal(ws.length, 1, "chiếc có warrantyMonths=0 không có bảo hành");
  assert.equal(ws[0].unit_id, a.id);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments WHERE doc_type='sale' AND doc_id=$1", [rec.id]))[0].n, 0);
  // chiếc đã bán không ghi lại được
  await expectWf(q(sales, "SELECT app.fn_record_sale($1, NULL, $2::jsonb)", [cust.id, JSON.stringify([lines[0]])]), "WF-SALE-UNIT-UNAVAILABLE");
  // hủy trong hạn rồi quá hạn
  await q(owner, "SELECT app.fn_void_sale($1, 'Nhập nhầm chiếc, ghi lại')", [rec.id]);
  assert.equal((await unitRow(a.id)).status, "in_stock");
  assert.equal((await unitRow(b.id)).status, "in_stock");
  // quá 24 giờ kể từ lúc ghi ⇒ không hủy được (đồng hồ DB test lùi/tiến qua app.test_now)
  const again = (await q(sales, "SELECT app.fn_record_sale($1, NULL, $2::jsonb) r", [cust.id, JSON.stringify([{ unitId: a.id, price: 8_800_000 }])]))[0].r;
  await expectWf(asUser(owner.id, async (c) => {
    await c.query("SELECT set_config('app.test_now', (now() + interval '30 hours')::text, true)");
    await c.query("SELECT app.fn_void_sale($1, 'Quá hạn nên không hủy được')", [again.id]);
  }), "WF-SALE-VOID-EXPIRED");
});

test("chiếc rời in_stock bằng đường khác (ghi mất) ⇒ chào hàng tự đóng 'lost', báo bán chờ tự huỷ; I13/I14 sạch", async () => {
  const T = await mkUnit(4_000_000);
  await offer(T.id, owner, [c1.id, c2.id]);
  const cl = (await claim(T.id, c1, "Khách Z", "0911222333"))[0].r;
  await q(owner, "SELECT app.fn_writeoff_unit($1, 'Mất hàng khi kiểm tra kho')", [T.id]);
  assert.deepEqual((await offers(T.id)).map((o) => o.status), ["lost", "lost"]);
  assert.equal((await ownerSql("SELECT status FROM public.collaborator_claims WHERE id=$1", [cl.id]))[0].status, "cancelled");
  const bad = await ownerSql("SELECT * FROM app.fn_consistency_check()");
  assert.deepEqual(bad.map((r) => `${r.check_code} ${r.detail}`), [], "bộ kiểm bất biến sạch");
});

test("báo cáo: doanh thu có số chiếc + tách kênh CTV; Số lượng; Thống kê CTV chỉ chủ; Tổng quan không còn khóa giá vốn/nợ/cọc", async () => {
  const T = await mkUnit(7_000_000);
  await offer(T.id, owner, [c1.id]);
  const cl = (await claim(T.id, c1, "Khách R", "0911444555"))[0].r;
  await confirm(sales, cl.id);
  const rev = (await q(owner, "SELECT app.rpt_revenue(app.today_vn(), app.today_vn(), 'day') r"))[0].r;
  assert.equal(rev.length, 1);
  assert.ok(rev[0].collabRevenue >= 7_000_000 && rev[0].collabUnits >= 1);
  assert.equal(rev[0].revenue, rev[0].shopRevenue + rev[0].collabRevenue + rev[0].repairRevenue);
  const u = (await q(owner, "SELECT app.rpt_units(app.today_vn(), app.today_vn()) r"))[0].r;
  assert.ok(u.sold.collab >= 1 && u.stock.sellable >= 1 && Array.isArray(u.stock.byBrand));
  const cs = (await q(owner, "SELECT app.rpt_collab_sales(app.today_vn(), app.today_vn(), 'day') r"))[0].r;
  const row = cs.byCollaborator.find((x) => x.collaboratorId === c1.id);
  assert.ok(row && row.units >= 1 && row.revenue >= 7_000_000);
  await expectWf(q(sales, "SELECT app.rpt_collab_sales(app.today_vn(), app.today_vn(), 'day')"), "WF-AUTH-FORBIDDEN");
  const d = (await q(owner, "SELECT app.rpt_dashboard(app.today_vn(), app.today_vn()) r"))[0].r;
  for (const k of ["cogs", "grossProfit", "stockValueUnits", "customerDue", "depositsHeld", "partsLow", "stocktakesOpen", "reservationsOverdue"]) assert.ok(!(k in d), `dashboard còn khóa ${k}`);
  for (const k of ["revenue", "unitsSold", "unitsSellable", "unitsOffered", "collabPendingClaims"]) assert.ok(k in d, `dashboard thiếu ${k}`);
  const ds = (await q(sales, "SELECT app.rpt_dashboard(app.today_vn(), app.today_vn()) r"))[0].r;
  assert.ok(!("repairsOpen" in ds), "nhân viên bán hàng không thấy sửa chữa");
  const dc = (await q(c1, "SELECT app.rpt_dashboard(app.today_vn(), app.today_vn()) r"))[0].r;
  assert.deepEqual(Object.keys(dc).sort(), ["from", "to"], "CTV không thấy chỉ số doanh thu/kho nào");
});

test("bộ kiểm bất biến sau toàn bộ kịch bản: không vi phạm", async () => {
  const bad = await ownerSql("SELECT * FROM app.fn_consistency_check()");
  assert.deepEqual(bad.map((r) => `${r.check_code} ${r.detail}`), []);
});
