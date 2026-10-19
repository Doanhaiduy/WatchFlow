// M6 — Sửa chữa gọn (CF-16): SC-08 (nhận máy → tiến độ → khoản tiền → sửa xong → giao ⇒ doanh thu), SC-07 (bảo hành miễn phí, hết hạn),
// PT-04 (chỉ chủ), hủy phiếu, I12. Không còn linh kiện / cọc / thanh toán / sửa nội bộ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, asUser, userOf, makeUnit } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv, KH, ST, STP;

test("chuẩn bị", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
  const st = await ownerSql("SELECT code, id, default_price_vnd p FROM public.service_types");
  ST = Object.fromEntries(st.map((r) => [r.code, r.id]));
  STP = Object.fromEntries(st.map((r) => [r.code, r.p]));
});

const addLine = (oid, body) => owner.post(`/api/v1/repairs/${oid}/lines`, body);

test("PT-04: sales/warehouse/CTV không đọc/ghi phiếu sửa; không có API thợ/linh kiện", async () => {
  for (const who of [sales, wh, ctv]) {
    assert.equal((await who.get("/api/v1/repairs")).status, 403);
    assert.equal((await who.post("/api/v1/repairs", { customerId: KH["Nguyễn Văn An"], brandText: "Casio", complaint: "x" }, K())).status, 403);
  }
  const r = await asUser(userOf("sales").id, (c) => c.query("SELECT count(*)::int n FROM public.repair_orders"));
  assert.equal(r.rows[0].n, 0);
  assert.equal((await owner.get("/api/v1/technicians")).status, 404);
  assert.equal((await owner.get("/api/v1/parts")).status, 404);
});

test("SC-08: nhận máy (khách mới nhập ngay) → kiểm tra → sửa → khoản tiền → sửa xong → giao ⇒ doanh thu = tổng khoản, bảo hành 90 ngày", async () => {
  owner.today = "2026-11-04";
  // khách chưa có SĐT ⇒ không nhận được
  const noPhone = await owner.post("/api/v1/customers", { fullName: "Khách không SĐT", force: true });
  assert.equal((await owner.post("/api/v1/repairs", { customerId: noPhone.body.id, brandText: "Casio", complaint: "chạy chậm" }, K())).body.code, "WF-VALIDATION");
  // thiếu lỗi / thiếu khách
  assert.equal((await owner.post("/api/v1/repairs", { customer: { fullName: "Anh Mới", phone: "0977111222" }, brandText: "Casio" }, K())).status, 422);
  assert.equal((await owner.post("/api/v1/repairs", { brandText: "Casio", complaint: "x" }, K())).status, 422);
  // khách mới nhập ngay trên phiếu (tạo khách) rồi lần sau cùng SĐT dùng lại khách đó
  const r = await owner.post("/api/v1/repairs", { customer: { fullName: "Anh Mới", phone: "0977 111 222" }, brandText: "Casio", serialNo: "CS-9999",
    intakeCondition: "trầy kính, dây mòn", complaint: "chạy chậm", expectedDate: "2026-11-10" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.code, /^SC-2026-\d{4}$/);
  const oid = r.body.id;
  const r2 = await owner.post("/api/v1/repairs", { customer: { fullName: "Anh Mới (nhập lại)", phone: "0977111222" }, brandText: "Seiko", complaint: "vào nước" }, K());
  const cust = (id) => ownerSql("SELECT customer_id FROM public.repair_orders WHERE id=$1", [id]).then((x) => x[0].customer_id);
  assert.equal(await cust(r2.body.id), await cust(oid), "cùng SĐT ⇒ dùng lại khách");
  assert.equal((await owner.post(`/api/v1/repairs/${r2.body.id}/cancel`, { reason: "Khách đổi ý, mang máy về" }, K())).status, 200);

  await owner.post(`/api/v1/repairs/${oid}/status`, { to: "inspecting" });
  await owner.post(`/api/v1/repairs/${oid}/status`, { to: "repairing" });
  assert.equal((await addLine(oid, { lineType: "service", serviceTypeId: ST.bao_duong })).status, 200);
  assert.equal((await addLine(oid, { lineType: "other", description: "Thay dây da", unitPrice: 200_000 })).status, 200);
  assert.equal((await addLine(oid, { lineType: "other", unitPrice: 5 })).status, 422, "khoản khác phải có nội dung");
  const expected = STP.bao_duong + 200_000;
  const d = (await owner.get(`/api/v1/repairs/${oid}`)).body;
  assert.equal(d.linesTotal, expected);
  assert.ok(!("held" in d) && !("payments" in d) && !("partsCost" in d) && !("grossProfit" in d), "không còn thanh toán/giá vốn/lãi");
  assert.equal(d.lines.length, 2);

  const c = await owner.post(`/api/v1/repairs/${oid}/complete`, {}, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.finalTotal, expected);
  assert.equal((await addLine(oid, { lineType: "other", description: "thêm sau khóa", unitPrice: 0 })).body.code, "WF-REP-LOCKED");
  assert.equal((await ownerSql("SELECT revenue_vnd r FROM public.repair_orders WHERE id=$1", [oid]))[0].r, 0, "chưa giao ⇒ chưa có doanh thu");

  owner.today = "2026-11-08";
  const dl = await owner.post(`/api/v1/repairs/${oid}/deliver`, {}, K());
  assert.equal(dl.status, 200, JSON.stringify(dl.body));
  const f = (await owner.get(`/api/v1/repairs/${oid}`)).body;
  assert.deepEqual([f.status, f.revenue], ["delivered", expected]);
  assert.deepEqual([f.warranty.startDate, f.warranty.endDate], ["2026-11-08", "2027-02-06"]);
  assert.equal((await owner.post(`/api/v1/repairs/${oid}/cancel`, { reason: "Hủy sau khi đã giao máy" }, K())).status >= 400, true);
  // danh sách tìm theo SĐT / serial; đếm theo trạng thái
  const byPhone = (await owner.get("/api/v1/repairs?q=0977111222")).body;
  assert.ok(byPhone.items.some((x) => x.id === oid));
  const bySerial = (await owner.get("/api/v1/repairs?q=cs 9999")).body;
  assert.ok(bySerial.items.some((x) => x.id === oid));
  assert.ok(byPhone.counts.delivered >= 1);
});

test("hủy phiếu trước khi sửa xong: cần lý do ≥ 10 ký tự; phiếu hủy không có doanh thu", async () => {
  owner.today = "2026-11-08";
  const r = await owner.post("/api/v1/repairs", { customerId: KH["Nguyễn Văn An"], brandText: "Seiko", complaint: "vào nước" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await addLine(r.body.id, { lineType: "service", serviceTypeId: ST.bao_duong });
  assert.equal((await owner.post(`/api/v1/repairs/${r.body.id}/cancel`, { reason: "ngắn" }, K())).status, 422);
  const c = await owner.post(`/api/v1/repairs/${r.body.id}/cancel`, { reason: "Khách đổi ý không sửa nữa" }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const f = (await owner.get(`/api/v1/repairs/${r.body.id}`)).body;
  assert.deepEqual([f.status, f.revenue], ["cancelled", 0]);
});

test("SC-07: sửa miễn phí theo bảo hành còn hạn — doanh thu 0; hết hạn ⇒ WF-WAR-EXPIRED; chọn bảo hành chỉ của khách", async () => {
  owner.today = "2026-11-03";
  const A = await makeUnit(8_500_000, { serial: "SK-A-SC07" });
  const s = await owner.post("/api/v1/sales", { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: A.id, price: 8_200_000 }] }, K());
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const ws = (await owner.get(`/api/v1/warranties?customerId=${KH["Nguyễn Văn An"]}`)).body.items;
  const w = ws.find((x) => x.serialNo === "SK-A-SC07");
  assert.ok(w, "thấy bảo hành còn hạn của khách");
  assert.equal(w.endDate, "2027-11-03");
  assert.equal((await sales.get(`/api/v1/warranties?customerId=${KH["Nguyễn Văn An"]}`)).status, 403);
  // không có màn tra cứu bảo hành riêng nữa
  assert.equal((await owner.post(`/api/v1/warranties/${w.id}/open-repair`, { complaint: "đứt dây" }, K())).status, 404);

  owner.today = "2026-11-20";
  const r = await owner.post("/api/v1/repairs", { customerId: KH["Nguyễn Văn An"], warrantyId: w.id, complaint: "đứt dây" }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await addLine(r.body.id, { lineType: "service", serviceTypeId: ST.bao_duong });
  await owner.post(`/api/v1/repairs/${r.body.id}/complete`, {}, K());
  const dl = await owner.post(`/api/v1/repairs/${r.body.id}/deliver`, {}, K());
  assert.equal(dl.status, 200, JSON.stringify(dl.body));
  const d = (await owner.get(`/api/v1/repairs/${r.body.id}`)).body;
  assert.deepEqual([d.chargeMode, d.revenue], ["warranty_free", 0]);
  owner.today = "2027-11-10";
  const late = await owner.post("/api/v1/repairs", { customerId: KH["Nguyễn Văn An"], warrantyId: w.id, complaint: "lại lỗi" }, K());
  assert.equal(late.body.code, "WF-WAR-EXPIRED");
});

test("I12: phiếu giao có doanh thu = Σ khoản (tính phí) hoặc 0 (bảo hành); lịch sử trạng thái bất biến", async () => {
  assert.deepEqual(await ownerSql(`SELECT o.id FROM public.repair_orders o WHERE o.status='delivered' AND o.revenue_vnd <>
     CASE WHEN o.kind='customer' AND o.charge_mode='paid' THEN (SELECT coalesce(sum(line_total_vnd),0) FROM public.repair_lines WHERE order_id=o.id) ELSE 0 END`), []);
  await assert.rejects(ownerSql("UPDATE public.repair_status_history SET reason='x'"), /WF-IMMUTABLE/);
});
