// M2 — Khách hàng: PT-03 (CTV chỉ thấy khách mình tạo), PT-12 (PII: không lộ CCCD trong API/audit; reveal cần quyền + lý do + reauth + audit),
// trùng SĐT cảnh báo, tìm không dấu/SĐT, ẩn danh (FR-CUS-01/06/07, FR-BAK-05).
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, asUser, userOf } from "./_lib.mjs";

let owner, sales, ctv, ctv2, wh;
test("đăng nhập", async () => {
  [owner, sales, ctv, ctv2, wh] = await Promise.all([login("owner"), login("sales"), login("collaborator"), login("collaborator", { email: userOf("collaborator", 1).email }), login("warehouse")]);
});

test("sales thấy mọi khách; CTV chỉ thấy khách mình tạo (PT-03); kho không có quyền", async () => {
  const s = await sales.get("/api/v1/customers");
  assert.ok(s.body.total >= 4);
  const c = await ctv.get("/api/v1/customers");
  assert.equal(c.status, 200);
  assert.ok(c.body.items.length >= 1 && c.body.items.every((x) => x.createdBy === userOf("collaborator").id));
  const other = s.body.items.find((x) => x.createdBy !== userOf("collaborator").id);
  assert.equal((await ctv.get(`/api/v1/customers/${other.id}`)).status, 404);
  assert.equal((await wh.get("/api/v1/customers")).status, 403);
  const r = await asUser(userOf("collaborator").id, (cn) => cn.query("SELECT count(*)::int n FROM public.customers WHERE created_by <> app.current_user_id()"));
  assert.equal(r.rows[0].n, 0);
});

test("tìm khách: không dấu, theo SĐT có định dạng khác (+84 / dấu cách)", async () => {
  const q = async (s) => (await sales.get("/api/v1/customers?q=" + encodeURIComponent(s))).body.items;
  assert.equal((await q("nguyen van an"))[0].fullName, "Nguyễn Văn An");
  assert.equal((await q("+84 901 000 002"))[0].fullName, "Trần Thị Bình");
  assert.ok((await q("binh")).some((x) => x.fullName === "Trần Thị Bình"));
});

test("PT-12: API không trả CCCD (chỉ *** *** 123); wf_app không đọc được id_number_enc", async () => {
  const s = await sales.get("/api/v1/customers?q=an");
  const an = s.body.items.find((x) => x.fullName === "Nguyễn Văn An");
  assert.equal(an.idMasked, "*** *** 123");
  assert.ok(!JSON.stringify(s.body).includes("079090000123"));
  assert.ok(!/id_number_enc|idNumberEnc|v1:/.test(JSON.stringify(s.body)));
  await assert.rejects(asUser(userOf("owner").id, (c) => c.query("SELECT id_number_enc FROM public.customers")), /permission denied/);
  // tìm chính xác theo CCCD qua chỉ mục băm
  const f = await sales.get("/api/v1/customers?idNumber=079090000123");
  assert.equal(f.body.items[0]?.fullName, "Nguyễn Văn An");
});

test("PT-12: xem CCCD đầy đủ — sales 403; owner cần reauth + lý do ≥10; có audit pii.reveal không chứa số", async () => {
  const an = (await owner.get("/api/v1/customers?q=nguyen van an")).body.items[0];
  assert.equal((await sales.post(`/api/v1/customers/${an.id}/reveal-id`, { reason: "Kiểm tra giấy tờ bán lại" })).status, 403);
  await ownerSql("UPDATE public.auth_sessions SET reauth_at = NULL WHERE user_id=$1", [userOf("owner").id]);
  assert.equal((await owner.post(`/api/v1/customers/${an.id}/reveal-id`, { reason: "Kiểm tra giấy tờ bán lại" })).body.code, "WF-SEC-REAUTH");
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/customers/${an.id}/reveal-id`, { reason: "ngắn" })).body.code, "WF-SEC-PII-REASON");
  const ok = await owner.post(`/api/v1/customers/${an.id}/reveal-id`, { reason: "Đối chiếu giấy tờ khi thu mua lại" });
  assert.equal(ok.body.idNumber, "079090000123");
  const logs = await ownerSql("SELECT reason, before, after FROM public.audit_logs WHERE action='pii.reveal' AND entity_id=$1", [an.id]);
  assert.equal(logs.length, 1);
  assert.ok(!JSON.stringify(await ownerSql("SELECT before, after FROM public.audit_logs WHERE entity_table='customers'")).includes("079090000123"));
});

test("tạo khách: trùng SĐT ⇒ 409 gợi ý; force ⇒ tạo; CTV tạo khách thuộc về CTV đó", async () => {
  const d = await sales.post("/api/v1/customers", { fullName: "An Nguyễn (trùng)", phone: "0901 000 001" });
  assert.equal(d.status, 409);
  assert.equal(d.body.code, "WF-CUS-PHONE-DUPLICATE");
  const f = await sales.post("/api/v1/customers", { fullName: "Vợ anh An", phone: "0901000001", force: true });
  assert.equal(f.status, 200);
  assert.match(f.body.code, /^KH-\d{6}$/);
  // CTV2 tạo khách trùng SĐT với khách của CTV1: KHÔNG được lộ tên khách CTV1 ⇒ tạo được ngay (không thấy trùng)
  const ctvCust = (await ctv.get("/api/v1/customers")).body.items[0];
  const c2 = await ctv2.post("/api/v1/customers", { fullName: "Khách CTV2", phone: ctvCust.phone });
  assert.equal(c2.status, 200, JSON.stringify(c2.body));
  assert.equal((await ctv.get(`/api/v1/customers/${c2.body.id}`)).status, 404);
});

test("sửa khách: CTV sửa khách mình; không sửa khách người khác; sales sửa được mọi khách", async () => {
  const mine = (await ctv.get("/api/v1/customers")).body.items[0];
  assert.equal((await ctv.patch(`/api/v1/customers/${mine.id}`, { address: "Long Thành, Đồng Nai" })).status, 200);
  const other = (await sales.get("/api/v1/customers?q=pham thi dung")).body.items[0];
  assert.equal((await ctv.patch(`/api/v1/customers/${other.id}`, { address: "x" })).status, 412);
  assert.equal((await sales.patch(`/api/v1/customers/${other.id}`, { note: "Hay mua quà tặng" })).status, 200);
});

test("đồng hồ của khách: thêm và xem", async () => {
  const an = (await sales.get("/api/v1/customers?q=nguyen van an")).body.items[0];
  assert.equal((await sales.post(`/api/v1/customers/${an.id}/watches`, { brandText: "Omega", modelText: "Seamaster", serialNo: "OM-1234" })).status, 200);
  const d = await sales.get(`/api/v1/customers/${an.id}`);
  assert.equal(d.body.watches[0].serialNo, "OM-1234");
});

test("ẩn danh khách: xóa PII, giữ bản ghi; audit không giữ tên/SĐT cũ", async () => {
  const c = (await sales.post("/api/v1/customers", { fullName: "Người Cần Ẩn Danh", phone: "0933111222", idNumber: "001122334455", force: true })).body;
  await reauth(owner);
  const r = await owner.post(`/api/v1/customers/${c.id}/anonymize`, { reason: "Khách yêu cầu xóa dữ liệu cá nhân" }, { "Idempotency-Key": crypto.randomUUID() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = await owner.get(`/api/v1/customers/${c.id}`);
  assert.match(d.body.fullName, /^Khách đã ẩn danh KH-/);
  assert.equal(d.body.phone, null);
  assert.equal(d.body.hasIdNumber, false);
  const dump = JSON.stringify(await ownerSql("SELECT before, after FROM public.audit_logs WHERE entity_id=$1", [c.id]));
  assert.ok(!dump.includes("0933111222") && !dump.includes("Người Cần Ẩn Danh"), dump);
  assert.equal((await sales.patch(`/api/v1/customers/${c.id}`, { phone: "0933111222" })).status, 412);
});
