// M11 — VietQR: cài đặt tài khoản nhận chuyển khoản. Chỉ settings.manage được sửa; mọi người đã đăng nhập đọc được thông tin cần để
// hiện mã QR qua GET /api/v1/store-info (bán hàng không có settings.view). Không có khóa/PII trong phản hồi, giá trị sai ⇒ 422.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client, login, ownerSql } from "./_lib.mjs";

let owner, sales, ctv;
const KEYS = ["payment.bank_bin", "payment.account_no", "payment.account_name", "payment.transfer_template"];
const patch = (c, key, value) => c.patch("/api/v1/settings", { key, value });

before(async () => {
  [owner, sales, ctv] = await Promise.all([login("owner"), login("sales"), login("collaborator")]);
});
after(async () => {
  // trả về mặc định để không ảnh hưởng bộ khác
  await ownerSql(`UPDATE public.settings SET value = '""'::jsonb WHERE key IN ('payment.bank_bin','payment.account_no','payment.account_name')`);
  await ownerSql(`UPDATE public.settings SET value = '"{code}"'::jsonb WHERE key = 'payment.transfer_template'`);
});

test("migration 0016: có đủ 4 khóa cài đặt với mặc định rỗng / {code}", async () => {
  const rows = await ownerSql(`SELECT key, value FROM public.settings WHERE key LIKE 'payment.%' ORDER BY key`);
  assert.deepEqual(rows.map((r) => r.key), [...KEYS].sort());
  // mặc định (lần đầu): chưa cấu hình ⇒ store-info báo configured=false
  const r = await sales.get("/api/v1/store-info");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.payment.configured, false);
  assert.equal(r.body.payment.transferTemplate, "{code}");
});

test("chưa đăng nhập ⇒ 401 ở /api/v1/store-info", async () => {
  const r = await new Client().get("/api/v1/store-info");
  assert.equal(r.status, 401);
});

test("người bán hàng KHÔNG có settings.view nhưng đọc được store-info; không sửa được cài đặt (403)", async () => {
  assert.equal((await sales.get("/api/v1/settings")).status, 403);
  assert.equal((await patch(sales, "payment.account_no", "0123456789")).status, 403);
  assert.equal((await patch(ctv, "payment.account_no", "0123456789")).status, 403);
  assert.equal((await sales.get("/api/v1/store-info")).status, 200);
  assert.equal((await ctv.get("/api/v1/store-info")).status, 200);
});

test("chủ (settings.manage) cấu hình tài khoản ⇒ người bán hàng thấy configured=true với đúng giá trị", async () => {
  for (const [k, v] of [["payment.bank_bin", "970436"], ["payment.account_no", "0123456789"], ["payment.account_name", "CUA HANG DONG HO"], ["payment.transfer_template", "TT {code}"]]) {
    const r = await patch(owner, k, v);
    assert.equal(r.status, 200, `${k}: ${JSON.stringify(r.body)}`);
  }
  const r = await sales.get("/api/v1/store-info");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.payment, { configured: true, bankBin: "970436", accountNo: "0123456789", accountName: "CUA HANG DONG HO", transferTemplate: "TT {code}" });
  assert.equal(typeof r.body.store.name, "string");
  // không lộ khóa cài đặt nào ngoài nhóm cửa hàng/thanh toán
  assert.deepEqual(Object.keys(r.body).sort(), ["payment", "store"]);
  assert.ok(!JSON.stringify(r.body).includes("security."));
});

test("thay đổi được ghi audit settings.changed (người sửa = chủ)", async () => {
  const rows = await ownerSql(`SELECT after, actor_id FROM public.audit_logs WHERE action = 'settings.changed' AND entity_id = 'payment.account_name' ORDER BY at DESC LIMIT 1`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].after, "CUA HANG DONG HO");
});

test("giá trị sai ⇒ 422 WF-VALIDATION và không đổi dữ liệu", async () => {
  for (const [k, v] of [["payment.bank_bin", "97043"], ["payment.bank_bin", "abcdef"], ["payment.account_no", "12"], ["payment.account_no", "0123 4567"], ["payment.account_no", "x".repeat(20)], ["payment.transfer_template", "y".repeat(41)], ["payment.account_name", 123]]) {
    const r = await patch(owner, k, v);
    assert.equal(r.status, 422, `${k}=${JSON.stringify(v)} ⇒ ${r.status}`);
    assert.equal(r.body.code, "WF-VALIDATION");
  }
  const r = await sales.get("/api/v1/store-info");
  assert.equal(r.body.payment.accountNo, "0123456789");
});

test("xóa số tài khoản ⇒ configured=false (không hiện QR)", async () => {
  assert.equal((await patch(owner, "payment.account_no", "")).status, 200);
  assert.equal((await sales.get("/api/v1/store-info")).body.payment.configured, false);
});

test("wf_app không UPDATE trực tiếp settings (chỉ qua app.fn_set_setting)", async () => {
  const [row] = await ownerSql(`SELECT has_table_privilege('wf_app', 'public.settings', 'UPDATE') AS u, has_table_privilege('wf_app', 'public.settings', 'INSERT') AS i`);
  assert.equal(row.u, false);
  assert.equal(row.i, false);
});
