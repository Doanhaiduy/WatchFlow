// M2 — Khách hàng (bản gọn, CF-13/14): CTV không còn đọc/tạo khách (PT-14), PII: không lộ CCCD trong API/audit và không có API xem CCCD đầy đủ (PT-12),
// trùng SĐT cảnh báo, tìm không dấu/SĐT, sửa khách, đồng hồ của khách (FR-CUS-01/06).
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, ownerSql, asUser, userOf } from "./_lib.mjs";

let owner, sales, ctv, wh;
test("đăng nhập", async () => {
  [owner, sales, ctv, wh] = await Promise.all([login("owner"), login("sales"), login("collaborator"), login("warehouse")]);
});

test("owner/sales thấy mọi khách; CTV và kho không có quyền (PT-14)", async () => {
  const s = await sales.get("/api/v1/customers");
  assert.ok(s.body.total >= 4);
  assert.equal((await owner.get("/api/v1/customers")).status, 200);
  assert.equal((await ctv.get("/api/v1/customers")).status, 403);
  assert.equal((await ctv.get(`/api/v1/customers/${s.body.items[0].id}`)).status, 403);
  assert.equal((await ctv.post("/api/v1/customers", { fullName: "CTV tạo khách", phone: "0911222333" })).status, 403);
  assert.equal((await wh.get("/api/v1/customers")).status, 403);
  // lớp 2: dưới wf_app, CTV đọc trực tiếp bảng khách ⇒ 0 dòng hoặc bị từ chối
  const r = await asUser(userOf("collaborator").id, (cn) => cn.query("SELECT count(*)::int n FROM public.customers"));
  assert.equal(r.rows[0].n, 0);
});

test("tìm khách: không dấu, theo SĐT có định dạng khác (+84 / dấu cách)", async () => {
  const q = async (s) => (await sales.get("/api/v1/customers?q=" + encodeURIComponent(s))).body.items;
  assert.equal((await q("nguyen van an"))[0].fullName, "Nguyễn Văn An");
  assert.equal((await q("+84 901 000 002"))[0].fullName, "Trần Thị Bình");
  assert.ok((await q("binh")).some((x) => x.fullName === "Trần Thị Bình"));
});

test("PT-12: API không trả CCCD (chỉ *** *** 123); wf_app không đọc được id_number_enc; không còn API xem/ẩn danh", async () => {
  const s = await sales.get("/api/v1/customers?q=an");
  const an = s.body.items.find((x) => x.fullName === "Nguyễn Văn An");
  assert.equal(an.idMasked, "*** *** 123");
  assert.ok(!JSON.stringify(s.body).includes("079090000123"));
  assert.ok(!/id_number_enc|idNumberEnc|v1:/.test(JSON.stringify(s.body)));
  await assert.rejects(asUser(userOf("owner").id, (c) => c.query("SELECT id_number_enc FROM public.customers")), /permission denied/);
  // tìm chính xác theo CCCD qua chỉ mục băm
  const f = await sales.get("/api/v1/customers?idNumber=079090000123");
  assert.equal(f.body.items[0]?.fullName, "Nguyễn Văn An");
  // đường xem CCCD đầy đủ / ẩn danh đã gỡ (CF-14)
  assert.equal((await owner.post(`/api/v1/customers/${an.id}/reveal-id`, { reason: "Kiểm tra giấy tờ bán lại" })).status, 404);
  assert.equal((await owner.post(`/api/v1/customers/${an.id}/anonymize`, { reason: "Khách yêu cầu xóa dữ liệu" })).status, 404);
  assert.ok(!JSON.stringify(await ownerSql("SELECT before, after FROM public.audit_logs WHERE entity_table='customers'")).includes("079090000123"));
});

test("tạo khách: trùng SĐT ⇒ 409 gợi ý; force ⇒ tạo", async () => {
  const d = await sales.post("/api/v1/customers", { fullName: "An Nguyễn (trùng)", phone: "0901 000 001" });
  assert.equal(d.status, 409);
  assert.equal(d.body.code, "WF-CUS-PHONE-DUPLICATE");
  const f = await sales.post("/api/v1/customers", { fullName: "Vợ anh An", phone: "0901000001", force: true });
  assert.equal(f.status, 200);
  assert.match(f.body.code, /^KH-\d{6}$/);
});

test("sửa khách: sales sửa được; if-match sai ⇒ 412", async () => {
  const other = (await sales.get("/api/v1/customers?q=pham thi dung")).body.items[0];
  assert.equal((await sales.patch(`/api/v1/customers/${other.id}`, { note: "Hay mua quà tặng" })).status, 200);
  const stale = await sales.patch(`/api/v1/customers/${other.id}`, { address: "Long Thành, Đồng Nai" }, { "If-Match": "999" });
  assert.equal(stale.status, 412);
  assert.equal((await ctv.patch(`/api/v1/customers/${other.id}`, { address: "x" })).status, 403);
});

test("đồng hồ của khách: thêm và xem", async () => {
  const an = (await sales.get("/api/v1/customers?q=nguyen van an")).body.items[0];
  assert.equal((await sales.post(`/api/v1/customers/${an.id}/watches`, { brandText: "Omega", modelText: "Seamaster", serialNo: "OM-1234" })).status, 200);
  const d = await sales.get(`/api/v1/customers/${an.id}`);
  assert.equal(d.body.watches[0].serialNo, "OM-1234");
});
