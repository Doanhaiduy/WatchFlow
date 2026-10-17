// M11 — "Tin cậy thiết bị này N ngày" ở bước 2FA (0021a, security-model §7.4): tick ⇒ cookie httpOnly + DB chỉ giữ SHA-256;
// lần sau chỉ cần mật khẩu (sai mật khẩu vẫn chặn); token giả/hết hạn/của người khác/trình duyệt khác ⇒ vẫn hỏi mã; reauth KHÔNG bị bỏ qua;
// đổi/đặt lại mật khẩu, tắt 2FA, khóa tài khoản, "quên thiết bị" ⇒ thu hồi; cài đặt 0 ⇒ tắt tính năng.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client, login, reauth, ownerSql, totpNow } from "./_lib.mjs";

const PW = "Mat-khau-tin-cay-2026!";
const COOKIE = "wf_td";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const UA_CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
let seq = 0;

/** Tạo người dùng (vai trò sales) đã đổi mật khẩu tạm, bật 2FA; trả { email, id, secret, c } (c = máy khách đã đăng nhập đủ). */
async function makeUser(tag) {
  const owner = await login("owner");
  const email = `td-${tag}-${Date.now().toString(36)}${seq++}@watchflow.local`;
  const cr = await owner.post("/api/v1/users", { email, fullName: "Người Thử Tin Cậy " + tag, roles: ["sales"] });
  assert.equal(cr.status, 200, JSON.stringify(cr.body));
  const c = new Client();
  assert.equal((await c.post("/api/v1/auth/login", { email, password: cr.body.tempPassword })).status, 200);
  assert.equal((await c.post("/api/v1/auth/change-password", { currentPassword: cr.body.tempPassword, newPassword: PW })).status, 200);
  const setup = await c.post("/api/v1/auth/mfa/setup");
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  const v = await c.post("/api/v1/auth/mfa/verify", { code: totpNow(setup.body.secret) });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const [u] = await ownerSql("SELECT id FROM public.users WHERE email = $1", [email]);
  return { email, id: u.id, secret: setup.body.secret, owner };
}

const resetStep = (id) => ownerSql("UPDATE public.user_mfa SET last_used_step = NULL WHERE user_id = $1", [id]);

/** Đăng nhập đủ 2 bước trên máy khách mới (hoặc máy khách cho trước); trust = tick "tin cậy". */
async function fullLogin(u, c, trust, headers = {}) {
  const l = await c.post("/api/v1/auth/login", { email: u.email, password: PW }, headers);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.equal(l.body.mfaPending, true, "phải đòi mã 2FA");
  await resetStep(u.id);
  const v = await c.post("/api/v1/auth/mfa/verify", { code: totpNow(u.secret), trustDevice: trust }, headers);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v;
}
const loginOnly = (u, c, headers = {}, password = PW) => c.post("/api/v1/auth/login", { email: u.email, password }, headers);
const rowsOf = (id) => ownerSql("SELECT * FROM public.trusted_devices WHERE user_id = $1 ORDER BY created_at", [id]);
const setCookieOf = (r) => (r.headers.getSetCookie?.() ?? []).find((x) => x.startsWith(COOKIE + "="));

test("không tick ⇒ không cấp cookie; đăng nhập lại vẫn đòi mã", async () => {
  const u = await makeUser("khong-tick");
  const c = new Client();
  const v = await fullLogin(u, c, false);
  assert.equal(v.body.trusted, false);
  assert.equal(c.jar.get(COOKIE), undefined);
  assert.equal((await rowsOf(u.id)).length, 0);
  await c.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(u, c)).body.mfaPending, true);
});

test("tick ⇒ cookie httpOnly/SameSite=Strict/Path=/api/v1/auth, DB chỉ lưu SHA-256; lần sau chỉ cần mật khẩu", async () => {
  const u = await makeUser("tick");
  const c = new Client();
  const v = await fullLogin(u, c, true);
  assert.equal(v.body.trusted, true);
  const sc = setCookieOf(v);
  assert.ok(sc, "có Set-Cookie " + COOKIE);
  assert.match(sc, /HttpOnly/i);
  assert.match(sc, /SameSite=Strict/i);
  assert.match(sc, /Path=\/api\/v1\/auth(;|$)/i);
  const maxAge = Number(/Max-Age=(\d+)/i.exec(sc)?.[1]);
  assert.ok(maxAge >= 29 * 86400 && maxAge <= 30 * 86400, "Max-Age ≈ 30 ngày: " + maxAge);
  const token = c.jar.get(COOKIE);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/, "token 256-bit base64url");
  // DB: có đúng 1 dòng, chỉ băm; không đâu chứa token thô
  const rows = await rowsOf(u.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha(token));
  assert.equal(JSON.stringify(rows[0]).includes(token), false, "DB không giữ token thô");
  const days = (new Date(rows[0].expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 29 && days <= 30.01, "hạn 30 ngày: " + days);
  const leaked = await ownerSql("SELECT count(*)::int n FROM public.audit_logs WHERE after::text LIKE $1 OR before::text LIKE $1", ["%" + token + "%"]);
  assert.equal(leaked[0].n, 0, "audit không chứa token");
  // đăng xuất, đăng nhập lại: chỉ mật khẩu
  await c.post("/api/v1/auth/logout");
  const l = await loginOnly(u, c);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.equal(l.body.mfaPending, false);
  assert.equal(l.body.trustedDevice, true);
  const me = await c.get("/api/v1/auth/me");
  assert.equal(me.body.user.mfaEnabled, true, "tài khoản vẫn bật 2FA");
  assert.equal(me.body.user.mfaOk, true);
  assert.equal((await c.get("/api/v1/notifications")).status, 200, "dùng được nghiệp vụ ngay");
  const au = await ownerSql("SELECT action FROM public.audit_logs WHERE entity_id = $1 AND action LIKE 'auth.%' ORDER BY at", [u.id]);
  assert.ok(au.some((a) => a.action === "auth.device_trusted") && au.some((a) => a.action === "auth.login_trusted"), "có audit tin cậy + đăng nhập qua thiết bị tin cậy");
});

test("mật khẩu LUÔN phải đúng: sai mật khẩu trên thiết bị tin cậy ⇒ 401", async () => {
  const u = await makeUser("sai-mk");
  const c = new Client();
  await fullLogin(u, c, true);
  await c.post("/api/v1/auth/logout");
  const bad = await loginOnly(u, c, {}, "Sai-mat-khau-123");
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, "WF-AUTH-INVALID");
  assert.equal((await c.get("/api/v1/auth/me")).status, 401, "không có phiên");
  await ownerSql("DELETE FROM public.rate_limit_hits");
});

test("không dùng được ở nơi khác: không cookie, token giả, token của người khác, trình duyệt/hệ điều hành khác, hết hạn ⇒ vẫn hỏi mã", async () => {
  const a = await makeUser("noi-khac-a");
  const b = await makeUser("noi-khac-b");
  const c = new Client();
  await fullLogin(a, c, true);
  const token = c.jar.get(COOKIE);
  await c.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(a, new Client())).body.mfaPending, true, "không cookie");
  const fake = new Client();
  fake.jar.set(COOKIE, "A".repeat(43));
  assert.equal((await loginOnly(a, fake)).body.mfaPending, true, "token giả");
  const cross = new Client();
  cross.jar.set(COOKIE, token);
  assert.equal((await loginOnly(b, cross)).body.mfaPending, true, "token của A không có tác dụng với B");
  // cùng token nhưng trình duyệt/HĐH khác lúc tin cậy
  const other = new Client();
  other.jar.set(COOKIE, token);
  assert.equal((await loginOnly(a, other, { "User-Agent": UA_CHROME_WIN })).body.mfaPending, true, "khác nhãn thiết bị");
  // hết hạn
  await ownerSql("UPDATE public.trusted_devices SET created_at = now() - interval '40 days', expires_at = now() - interval '10 days' WHERE user_id = $1", [a.id]);
  assert.equal((await loginOnly(a, c)).body.mfaPending, true, "hết hạn");
});

test("reauth (thao tác nhạy cảm) KHÔNG bị bỏ qua bởi thiết bị tin cậy: vẫn cần mã 2FA", async () => {
  const u = await makeUser("reauth");
  const c = new Client();
  await fullLogin(u, c, true);
  await c.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(u, c)).body.mfaPending, false);
  // thao tác cần reauth: tắt 2FA
  const dis = await c.post("/api/v1/auth/mfa/disable");
  assert.equal(dis.status, 401);
  assert.equal(dis.body.code, "WF-SEC-REAUTH");
  // reauth chỉ bằng mật khẩu (không mã) ⇒ từ chối
  const noCode = await c.post("/api/v1/auth/reauth", { password: PW });
  assert.equal(noCode.status, 401);
  assert.equal(noCode.body.code, "WF-AUTH-MFA-INVALID");
  assert.equal((await c.post("/api/v1/auth/mfa/disable")).status, 401, "vẫn chưa reauth");
  // reauth đủ mật khẩu + mã ⇒ qua
  await resetStep(u.id);
  assert.equal((await c.post("/api/v1/auth/reauth", { password: PW, code: totpNow(u.secret) })).status, 200);
});

test("đổi mật khẩu ⇒ mọi thiết bị tin cậy bị thu hồi (trigger DB), đăng nhập lại hỏi mã; ghi audit", async () => {
  const u = await makeUser("doi-mk");
  const c = new Client();
  await fullLogin(u, c, true);
  assert.equal((await c.post("/api/v1/auth/change-password", { currentPassword: PW, newPassword: PW + "x" })).status, 200);
  const rows = await rowsOf(u.id);
  assert.equal(rows[0].revoked_reason, "password_changed");
  assert.ok(rows[0].revoked_at);
  await c.post("/api/v1/auth/logout");
  const l = await c.post("/api/v1/auth/login", { email: u.email, password: PW + "x" });
  assert.equal(l.body.mfaPending, true, "thiết bị đã bị thu hồi ⇒ hỏi mã");
  const au = await ownerSql("SELECT after FROM public.audit_logs WHERE entity_id = $1 AND action = 'auth.trusted_devices_revoked'", [u.id]);
  assert.equal(au.length, 1);
  assert.equal(au[0].after.reason, "password_changed");
});

test("chủ đặt lại mật khẩu / khóa tài khoản ⇒ thu hồi thiết bị tin cậy", async () => {
  const u = await makeUser("chu-dat-lai");
  const c = new Client();
  await fullLogin(u, c, true);
  const owner = await login("owner");
  await reauth(owner);
  const rp = await owner.post(`/api/v1/users/${u.id}/reset-password`, {});
  assert.equal(rp.status, 200, JSON.stringify(rp.body));
  assert.equal((await rowsOf(u.id))[0].revoked_reason, "password_changed");

  const k = await makeUser("chu-khoa");
  const c2 = new Client();
  await fullLogin(k, c2, true);
  const ds = await owner.post(`/api/v1/users/${k.id}/set-status`, { status: "disabled", reason: "Thử khóa tài khoản kiểm thiết bị tin cậy" });
  assert.equal(ds.status, 200, JSON.stringify(ds.body));
  assert.equal((await rowsOf(k.id))[0].revoked_reason, "account_disabled");
  const en = await owner.post(`/api/v1/users/${k.id}/set-status`, { status: "active", reason: "Mở lại sau khi kiểm thử" });
  assert.equal(en.status, 200, JSON.stringify(en.body));
  await c2.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(k, c2)).body.mfaPending, true, "mở khóa xong vẫn phải nhập mã (thiết bị cũ đã thu hồi)");
});

test("tắt 2FA ⇒ thu hồi thiết bị tin cậy", async () => {
  const u = await makeUser("tat-2fa");
  const c = new Client();
  await fullLogin(u, c, true);
  await resetStep(u.id);
  assert.equal((await c.post("/api/v1/auth/reauth", { password: PW, code: totpNow(u.secret) })).status, 200);
  assert.equal((await c.post("/api/v1/auth/mfa/disable")).status, 200);
  assert.equal((await rowsOf(u.id))[0].revoked_reason, "mfa_disabled");
});

test("danh sách + bỏ một thiết bị + 'Quên các thiết bị đã tin cậy' (gỡ cookie)", async () => {
  const u = await makeUser("quen");
  const c1 = new Client();
  await fullLogin(u, c1, true);
  const c2 = new Client();
  await fullLogin(u, c2, true);
  const list = await c1.get("/api/v1/auth/trusted-devices");
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 2);
  assert.equal(list.body.days, 30);
  assert.equal(list.body.items.filter((d) => d.current).length, 1, "đánh dấu máy này");
  assert.equal(JSON.stringify(list.body).includes("token"), false, "không lộ token/hash");
  const mine = list.body.items.find((d) => d.current);
  const del = await c1.del(`/api/v1/auth/trusted-devices/${mine.id}`);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(c1.jar.get(COOKIE), undefined, "cookie máy này đã bị gỡ");
  assert.equal((await c1.del(`/api/v1/auth/trusted-devices/${mine.id}`)).status, 404);
  // máy 2 vẫn tin cậy cho tới khi quên hết
  await c2.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(u, c2)).body.mfaPending, false);
  const all = await c2.del("/api/v1/auth/trusted-devices");
  assert.equal(all.status, 200);
  assert.equal(c2.jar.get(COOKIE), undefined);
  assert.equal((await c2.get("/api/v1/auth/trusted-devices")).body.items.length, 0);
  await c2.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(u, c2)).body.mfaPending, true);
  // người khác không thu hồi được thiết bị của mình
  const other = await makeUser("quen-khac");
  const oc = new Client();
  await fullLogin(other, oc, true);
  const od = (await oc.get("/api/v1/auth/trusted-devices")).body.items[0];
  const attackerDel = await c1.del(`/api/v1/auth/trusted-devices/${od.id}`);
  assert.equal(attackerDel.status, 404, "không thấy thiết bị của người khác");
});

test("security.trusted_device_days = 0 ⇒ tắt: tick không cấp cookie, thiết bị cũ không còn bỏ qua mã", async () => {
  const u = await makeUser("tat-tinh-nang");
  const c = new Client();
  await fullLogin(u, c, true);
  await c.post("/api/v1/auth/logout");
  assert.equal((await loginOnly(u, c)).body.mfaPending, false);
  await ownerSql("UPDATE public.settings SET value = '0' WHERE key = 'security.trusted_device_days'");
  try {
    await c.post("/api/v1/auth/logout");
    assert.equal((await loginOnly(u, c)).body.mfaPending, true, "tính năng tắt ⇒ hỏi mã dù cookie còn");
    const c3 = new Client();
    const v = await fullLogin(u, c3, true);
    assert.equal(v.body.trusted, false);
    assert.equal(c3.jar.get(COOKIE), undefined);
    assert.equal((await c3.get("/api/v1/auth/me")).body.user.trustedDeviceDays, 0);
  } finally {
    await ownerSql("UPDATE public.settings SET value = '30' WHERE key = 'security.trusted_device_days'");
  }
});

test("bảng trusted_devices: wf_app không đọc/ghi được; token_hash phải là SHA-256 hex", async () => {
  const u = await makeUser("quyen-db");
  const { apiConn } = await import("./_lib.mjs");
  const conn = await apiConn();
  try {
    await conn.query("BEGIN");
    await conn.query("SELECT set_config('role','wf_app',true)");
    await assert.rejects(conn.query("SELECT count(*) FROM public.trusted_devices"), /permission denied/);
    await conn.query("ROLLBACK");
    await conn.query("BEGIN");
    await conn.query("SELECT set_config('role','wf_app',true)");
    await assert.rejects(conn.query("INSERT INTO public.trusted_devices (user_id, token_hash, expires_at) VALUES ($1, repeat('a',64), now() + interval '1 day')", [u.id]), /permission denied/);
    await conn.query("ROLLBACK");
  } finally {
    await conn.end();
  }
  await assert.rejects(ownerSql("INSERT INTO public.trusted_devices (user_id, token_hash, expires_at) VALUES ($1, 'raw-token-not-hash', now() + interval '1 day')", [u.id]), /ck_trusted_devices_hash/);
  await assert.rejects(ownerSql("INSERT INTO public.trusted_devices (user_id, token_hash, expires_at) VALUES ($1, repeat('b',64), now() + interval '200 days')", [u.id]), /ck_trusted_devices_ttl/);
});
