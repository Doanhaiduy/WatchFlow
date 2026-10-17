// PT-07 — Xác thực & phiên (security-model §7, BR-SEC-04/06): khóa tạm, xoay refresh + phát hiện dùng lại, đăng xuất, mật khẩu tạm,
// MFA owner, CSRF/Origin, đổi mật khẩu thu hồi phiên khác, idempotency (CT-07 mức nền).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, login, reauth, userOf, ACC, ownerSql, totpNow } from "./_lib.mjs";

test("health công khai + deep", async () => {
  const c = new Client();
  const r = await c.get("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const d = await c.get("/api/health?deep=1");
  assert.ok(d.body.checks.db.ok && d.body.checks.migrations.ok, JSON.stringify(d.body));
});

test("chưa đăng nhập ⇒ 401 WF-AUTH-UNAUTHENTICATED, lỗi dạng problem+json có requestId", async () => {
  const r = await new Client().get("/api/v1/auth/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "WF-AUTH-UNAUTHENTICATED");
  assert.match(r.headers.get("content-type"), /problem\+json/);
  assert.ok(r.body.requestId);
});

test("đăng nhập 4 vai trò; sai mật khẩu ⇒ thông báo chung", async () => {
  for (const role of ["sales", "warehouse", "collaborator"]) {
    const c = await login(role);
    const me = await c.get("/api/v1/auth/me");
    assert.equal(me.status, 200);
    assert.ok(me.body.user.roles.includes(role));
  }
  const bad = await new Client().post("/api/v1/auth/login", { email: "khongco@watchflow.local", password: "sai-mat-khau-123" });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, "WF-AUTH-INVALID");
});

test("MFA owner: sau mật khẩu chỉ vào /auth/*; nghiệp vụ ⇒ WF-AUTH-MFA-REQUIRED; mã đúng ⇒ vào được; mã dùng lại ⇒ từ chối", async () => {
  const owner = userOf("owner");
  await ownerSql("UPDATE public.user_mfa SET last_used_step = NULL WHERE user_id=$1", [owner.id]);
  const c = new Client();
  const r = await c.post("/api/v1/auth/login", { email: owner.email, password: ACC.password });
  assert.equal(r.body.mfaPending, true);
  assert.equal((await c.get("/api/v1/auth/me")).status, 200);
  const blocked = await c.get("/api/v1/users");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "WF-AUTH-MFA-REQUIRED");
  assert.equal((await c.post("/api/v1/auth/mfa/verify", { code: "000000" })).status, 401);
  const code = totpNow();
  assert.equal((await c.post("/api/v1/auth/mfa/verify", { code })).status, 200);
  assert.equal((await c.get("/api/v1/users")).status, 200);
  // phiên khác dùng lại cùng mã ⇒ từ chối (chống phát lại)
  const c2 = new Client();
  await c2.post("/api/v1/auth/login", { email: owner.email, password: ACC.password });
  assert.equal((await c2.post("/api/v1/auth/mfa/verify", { code })).status, 401);
});

test("CSRF: thiếu token ⇒ 403; Origin lạ ⇒ 403", async () => {
  const c = await login("sales");
  const r1 = await c.post("/api/v1/auth/change-password", { currentPassword: "x", newPassword: "y" }, { "X-CSRF-Token": "" });
  assert.equal(r1.status, 403);
  assert.equal(r1.body.code, "WF-AUTH-CSRF");
  const r2 = await c.post("/api/v1/notifications/read-all", {}, { Origin: "https://evil.example" });
  assert.equal(r2.status, 403);
  const r3 = await new Client().post("/api/v1/auth/login", { email: "a@b.cd", password: "x" }, { Origin: "https://evil.example" });
  assert.equal(r3.status, 403);
});

test("refresh xoay vòng; dùng lại token cũ (quá 10 giây) ⇒ thu hồi cả phiên (BR-SEC-06)", async () => {
  const c = await login("warehouse");
  const oldRt = c.jar.get("wf_rt");
  const r = await c.post("/api/v1/auth/refresh", {});
  assert.equal(r.status, 200);
  assert.notEqual(c.jar.get("wf_rt"), oldRt);
  // giả lập đã quá cửa sổ ân hạn
  await ownerSql("UPDATE public.refresh_tokens SET rotated_at = now() - interval '1 minute' WHERE rotated_at IS NOT NULL");
  const attacker = new Client();
  attacker.jar.set("wf_rt", oldRt);
  const a = await attacker.post("/api/v1/auth/refresh", {});
  assert.equal(a.status, 401);
  // phiên thật cũng bị thu hồi
  const me = await c.get("/api/v1/auth/me");
  assert.equal(me.status, 401);
  const [s] = await ownerSql("SELECT count(*)::int n FROM public.auth_sessions WHERE revoke_reason='refresh_reuse'");
  assert.ok(s.n >= 1);
});

test("đăng xuất thu hồi phiên (access token cũ hết hiệu lực ngay)", async () => {
  const c = await login("sales");
  const at = c.jar.get("wf_at");
  assert.equal((await c.post("/api/v1/auth/logout", {})).status, 200);
  const stale = new Client();
  stale.jar.set("wf_at", at);
  assert.equal((await stale.get("/api/v1/auth/me")).status, 401);
});

test("khóa tạm sau 5 lần sai; đúng mật khẩu vẫn bị khóa (WF-AUTH-LOCKED)", async () => {
  const owner = await login("owner");
  const email = "khoa-tam@watchflow.local";
  const cr = await owner.post("/api/v1/users", { email, fullName: "Người Thử Khóa", roles: ["sales"] });
  assert.equal(cr.status, 200, JSON.stringify(cr.body));
  const c = new Client();
  let last;
  for (let i = 0; i < 5; i++) last = await c.post("/api/v1/auth/login", { email, password: "sai-mat-khau-" + i });
  assert.equal(last.status, 423);
  const r = await c.post("/api/v1/auth/login", { email, password: cr.body.tempPassword });
  assert.equal(r.status, 423);
  assert.equal(r.body.code, "WF-AUTH-LOCKED");
  await ownerSql("DELETE FROM public.rate_limit_hits");
});

test("mật khẩu tạm: chặn mọi API ngoài /auth/* tới khi đổi; đổi xong vào được", async () => {
  const owner = await login("owner");
  const email = "mat-khau-tam@watchflow.local";
  const cr = await owner.post("/api/v1/users", { email, fullName: "Người Mới", roles: ["sales"] });
  const c = new Client();
  assert.equal((await c.post("/api/v1/auth/login", { email, password: cr.body.tempPassword })).status, 200);
  const blocked = await c.get("/api/v1/notifications");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "WF-AUTH-MUST-CHANGE-PASSWORD");
  const weak = await c.post("/api/v1/auth/change-password", { currentPassword: cr.body.tempPassword, newPassword: "123" });
  assert.equal(weak.status, 422);
  const ok = await c.post("/api/v1/auth/change-password", { currentPassword: cr.body.tempPassword, newPassword: "Dong-ho-moi-2026!" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await c.get("/api/v1/notifications")).status, 200);
});

test("đổi mật khẩu thu hồi các phiên khác", async () => {
  const owner = await login("owner");
  const email = "doi-mk@watchflow.local";
  const cr = await owner.post("/api/v1/users", { email, fullName: "Người Đổi MK", roles: ["warehouse"] });
  const a = new Client();
  await a.post("/api/v1/auth/login", { email, password: cr.body.tempPassword });
  await a.post("/api/v1/auth/change-password", { currentPassword: cr.body.tempPassword, newPassword: "Mat-khau-ben-vung-1" });
  const b = new Client();
  await b.post("/api/v1/auth/login", { email, password: "Mat-khau-ben-vung-1" });
  assert.equal((await b.get("/api/v1/auth/me")).status, 200);
  await a.post("/api/v1/auth/change-password", { currentPassword: "Mat-khau-ben-vung-1", newPassword: "Mat-khau-ben-vung-2" });
  assert.equal((await a.get("/api/v1/auth/me")).status, 200, "phiên hiện tại giữ");
  assert.equal((await b.get("/api/v1/auth/me")).status, 401, "phiên khác bị thu hồi");
});

test("phân quyền API: sales không xem người dùng / nhật ký / cài đặt; owner xem được", async () => {
  const s = await login("sales");
  for (const p of ["/api/v1/users", "/api/v1/audit", "/api/v1/settings", "/api/v1/system/status"]) {
    const r = await s.get(p);
    assert.equal(r.status, 403, p);
    assert.equal(r.body.code, "WF-AUTH-FORBIDDEN");
  }
  const o = await login("owner");
  for (const p of ["/api/v1/users", "/api/v1/audit", "/api/v1/settings", "/api/v1/system/status", "/api/v1/roles", "/api/v1/permissions"]) {
    assert.equal((await o.get(p)).status, 200, p);
  }
});

test("mass-assignment qua API: sales tự gán vai trò owner ⇒ 403", async () => {
  const s = await login("sales");
  const me = (await s.get("/api/v1/auth/me")).body.user;
  const r = await s.put(`/api/v1/users/${me.userId}/roles`, { roles: ["owner"] });
  assert.equal(r.status, 403);
});

test("thao tác nhạy cảm cần xác thực lại (WF-SEC-REAUTH), sau reauth thì được", async () => {
  const o = await login("owner");
  const roles = (await o.get("/api/v1/roles")).body.items;
  const sales = roles.find((r) => r.code === "sales");
  // vừa qua TOTP lúc đăng nhập ⇒ reauth còn mới; giả lập đã quá 5 phút
  await ownerSql("UPDATE public.auth_sessions SET reauth_at = now() - interval '10 minutes' WHERE user_id = $1", [userOf("owner").id]);
  const r1 = await o.put(`/api/v1/roles/${sales.id}/permissions`, { permissions: sales.permissions });
  assert.equal(r1.status, 401);
  assert.equal(r1.body.code, "WF-SEC-REAUTH");
  await reauth(o);
  const r2 = await o.put(`/api/v1/roles/${sales.id}/permissions`, { permissions: sales.permissions });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
});

test("CT-07 nền: cùng Idempotency-Key gửi 2 lần song song ⇒ một người dùng, cùng kết quả; khác nội dung ⇒ 422", async () => {
  const o = await login("owner");
  const key = crypto.randomUUID();
  const body = { email: "idem@watchflow.local", fullName: "Người Idem", roles: ["sales"] };
  const [a, b] = await Promise.all([o.post("/api/v1/users", body, { "Idempotency-Key": key }), o.post("/api/v1/users", body, { "Idempotency-Key": key })]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.id, b.body.id);
  const [n] = await ownerSql("SELECT count(*)::int n FROM public.users WHERE email='idem@watchflow.local'");
  assert.equal(n.n, 1);
  const c = await o.post("/api/v1/users", { ...body, fullName: "Khác" }, { "Idempotency-Key": key });
  assert.equal(c.status, 422);
  assert.equal(c.body.code, "WF-IDEMPOTENCY-MISMATCH");
});

test("cài đặt: owner sửa được, giá trị sai kiểu ⇒ 422; có audit", async () => {
  const o = await login("owner");
  assert.equal((await o.patch("/api/v1/settings", { key: "sales.default_due_days", value: 10 })).status, 200);
  assert.equal((await o.patch("/api/v1/settings", { key: "sales.default_due_days", value: "mười" })).status, 422);
  assert.equal((await o.patch("/api/v1/settings", { key: "khong.ton.tai", value: 1 })).status, 404);
  const a = await o.get("/api/v1/audit?action=settings.changed");
  assert.ok(a.body.items.some((x) => x.entityId === "sales.default_due_days"));
});

test("thông báo: chỉ thấy của mình; đánh dấu đã đọc", async () => {
  const sales = userOf("sales");
  await ownerSql("INSERT INTO public.notifications (user_id, type, title) VALUES ($1,'test','Xin chào bán hàng')", [sales.id]);
  const s = await login("sales");
  const r = await s.get("/api/v1/notifications");
  assert.ok(r.body.unread >= 1);
  const w = await login("warehouse");
  assert.ok(!(await w.get("/api/v1/notifications")).body.items.some((n) => n.title === "Xin chào bán hàng"));
  await s.post("/api/v1/notifications/read-all", {});
  assert.equal((await s.get("/api/v1/notifications")).body.unread, 0);
});

test("tải ảnh: magic bytes sai ⇒ 422; ảnh PNG hợp lệ ⇒ có thumbnail; người không quyền không tải được", async () => {
  const w = await login("warehouse");
  const fake = new FormData();
  fake.set("kind", "product");
  fake.set("file", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/png" }), "x.png");
  const r1 = await w.post("/api/v1/files", fake);
  assert.equal(r1.status, 422);
  assert.equal(r1.body.code, "WF-FILE-INVALID");
  // PNG 1×1
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const ok = new FormData();
  ok.set("kind", "product");
  ok.set("file", new Blob([png], { type: "image/png" }), "a.png");
  const r2 = await w.post("/api/v1/files", ok);
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  const t = await w.get(r2.body.thumbUrl);
  assert.equal(t.status, 200);
  const c = await login("collaborator");
  const r3 = await c.post("/api/v1/files", ok);
  assert.equal(r3.status, 403);
});

test("cron: thiếu/sai Bearer ⇒ 401; đúng ⇒ chạy một lần theo slot", async () => {
  const c = new Client();
  assert.equal((await c.get("/api/cron/daily")).status, 401);
  const h = { Authorization: "Bearer " + process.env.CRON_SECRET };
  const r = await c.get("/api/cron/daily?slot=test-slot", h);
  assert.equal(r.status, 200);
  assert.equal(r.body.skipped, false);
  assert.equal((await c.get("/api/cron/daily?slot=test-slot", h)).body.skipped, true);
});
