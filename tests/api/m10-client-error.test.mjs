// Nhật ký lỗi phía trình duyệt (POST /api/v1/public/client-error): nhận hợp lệ, từ chối Origin lạ, vượt giới hạn ⇒ 429,
// nội dung quá dài ⇒ 422, bản ghi không chứa PII. Mỗi ca dùng X-Forwarded-For riêng để không đụng bộ đếm của ca khác.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, login, ownerSql } from "./_lib.mjs";

const rnd = () => Math.random().toString(36).replace(/[0-9.]/g, "").slice(0, 8) + "x"; // chỉ chữ cái: số dài sẽ bị che
const URL_PATH = "/api/v1/public/client-error";
const ok = (over = {}) => ({ kind: "window", message: "TypeError: x is not a function", path: "/ban-hang", version: "0.12.0", ...over });
const xff = (ip) => ({ "X-Forwarded-For": ip });

test("nhận lỗi hợp lệ không cần đăng nhập ⇒ 200 và ghi error_events source=client (có phiên bản, không user)", async () => {
  const msg = "Lỗi thử CE-OK " + rnd();
  const r = await new Client().post(URL_PATH, ok({ message: msg, stack: "Error\n    at f (http://localhost/_next/static/chunks/app.js:1:2)" }), xff("10.9.0.1"));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const rows = await ownerSql("SELECT source, route, code, message, app_version, count FROM public.error_events WHERE message LIKE $1", [msg + "%"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, "client");
  assert.equal(rows[0].route, "/ban-hang");
  assert.equal(rows[0].code, "window");
  assert.equal(rows[0].app_version, "0.12.0");
  // gửi lại cùng lỗi ⇒ gộp, tăng count
  await new Client().post(URL_PATH, ok({ message: msg, stack: "Error\n    at f (http://localhost/_next/static/chunks/app.js:1:2)" }), xff("10.9.0.1"));
  const again = await ownerSql("SELECT count FROM public.error_events WHERE message LIKE $1", [msg + "%"]);
  assert.equal(again[0].count, 2);
});

test("Origin lạ ⇒ 403 WF-AUTH-CSRF và không ghi gì", async () => {
  const msg = "Lỗi thử CE-ORIGIN " + rnd();
  const r = await new Client().post(URL_PATH, ok({ message: msg }), { Origin: "https://evil.example", ...xff("10.9.0.2") });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "WF-AUTH-CSRF");
  assert.equal((await ownerSql("SELECT 1 FROM public.error_events WHERE message LIKE $1", [msg + "%"])).length, 0);
});

test("nội dung quá dài / sai kiểu ⇒ 422 WF-VALIDATION", async () => {
  const long = await new Client().post(URL_PATH, ok({ message: "x".repeat(501) }), xff("10.9.0.3"));
  assert.equal(long.status, 422);
  assert.equal(long.body.code, "WF-VALIDATION");
  assert.equal((await new Client().post(URL_PATH, ok({ stack: "s".repeat(2001) }), xff("10.9.0.3"))).status, 422);
  assert.equal((await new Client().post(URL_PATH, ok({ kind: "lạ" }), xff("10.9.0.3"))).status, 422);
  assert.equal((await new Client().post(URL_PATH, ok({ path: "/".repeat(301) }), xff("10.9.0.3"))).status, 422);
});

test("không lưu PII: email, số điện thoại/CCCD, UUID, query bị che; không lưu IP/UA", async () => {
  const tag = "CE-PII" + rnd();
  const r = await new Client().post(
    URL_PATH,
    ok({ message: `${tag} khach@abc.vn 0901234567 012345678901 123e4567-e89b-12d3-a456-426614174000`, path: "/khach-hang/123e4567-e89b-12d3-a456-426614174000?q=Nguyen+Van+A" }),
    { "User-Agent": "MySecretAgent/1.0", ...xff("203.0.113.77") },
  );
  assert.equal(r.status, 200);
  const rows = await ownerSql("SELECT * FROM public.error_events WHERE message LIKE $1", [tag + "%"]);
  assert.equal(rows.length, 1);
  const dump = JSON.stringify(rows[0]);
  for (const bad of ["khach@abc.vn", "0901234567", "012345678901", "123e4567", "Nguyen", "MySecretAgent", "203.0.113.77"]) assert.ok(!dump.includes(bad), `lộ ${bad}: ${dump}`);
  assert.equal(rows[0].route, "/khach-hang/:id");
});

test("lỗi do tiện ích trình duyệt bị bỏ qua (không ghi)", async () => {
  const msg = "Lỗi CE-NOISE " + rnd();
  const r = await new Client().post(URL_PATH, ok({ message: msg, stack: "at chrome-extension://abc/x.js:1:1" }), xff("10.9.0.4"));
  assert.equal(r.status, 200);
  assert.equal((await ownerSql("SELECT 1 FROM public.error_events WHERE message LIKE $1", [msg + "%"])).length, 0);
});

test("vượt 30 lần/phút theo IP ⇒ 429 WF-RATE-LIMIT + Retry-After; IP khác vẫn qua", async () => {
  const h = xff("10.9.0.99");
  let last;
  for (let i = 0; i < 31; i++) last = await new Client().post(URL_PATH, ok({ message: "spam " + i }), h);
  assert.equal(last.status, 429, JSON.stringify(last.body));
  assert.equal(last.body.code, "WF-RATE-LIMIT");
  assert.ok(last.headers.get("retry-after"));
  assert.equal((await new Client().post(URL_PATH, ok({ message: "ip khác" }), xff("10.9.0.98"))).status, 200);
});

test("quản trị viên thấy lỗi client ở /system/status (source + appVersion)", async () => {
  const msg = "Lỗi thử CE-STATUS " + rnd();
  await new Client().post(URL_PATH, ok({ message: msg }), xff("10.9.0.5"));
  const owner = await login("owner");
  const r = await owner.get("/api/v1/system/status");
  assert.equal(r.status, 200);
  const hit = r.body.errors.find((e) => e.message.startsWith(msg));
  assert.ok(hit, "không thấy lỗi client trong danh sách");
  assert.equal(hit.source, "client");
  assert.equal(hit.appVersion, "0.12.0");
});
