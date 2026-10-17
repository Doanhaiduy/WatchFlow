// M9 — Kiểm định bảo mật (CQ-015): chống chiếm quyền chủ qua user.manage/role.manage, ân hạn refresh hai tab,
// hạn tuyệt đối của phiên, cài đặt security.* chỉ owner, pgcrypto không mở cho PUBLIC.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Client, login, reauth, userOf, ownerSql, asUser, expectWf } from "./_lib.mjs";

let ownerId, warehouseId, salesId, adminRoleId;

before(async () => {
  [{ id: ownerId }] = await ownerSql("SELECT id FROM public.users WHERE email = $1", [userOf("owner").email]);
  [{ id: warehouseId }] = await ownerSql("SELECT id FROM public.users WHERE email = $1", [userOf("warehouse").email]);
  [{ id: salesId }] = await ownerSql("SELECT id FROM public.users WHERE email = $1", [userOf("sales").email]);
  // Vai trò "quản lý" có user.manage + role.manage + settings.manage nhưng KHÔNG phải owner, gán cho kho@
  [{ id: adminRoleId }] = await ownerSql(
    `INSERT INTO public.roles (code, name_vi, description) VALUES ('m9_manager','Quản lý thử','test') ON CONFLICT (code) DO UPDATE SET name_vi = excluded.name_vi RETURNING id`,
  );
  await ownerSql(
    `INSERT INTO public.role_permissions (role_id, permission_code) SELECT $1, x FROM unnest(ARRAY['user.manage','role.manage','settings.manage']) x ON CONFLICT DO NOTHING`,
    [adminRoleId],
  );
  await ownerSql(`INSERT INTO public.user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [warehouseId, adminRoleId]);
});

test("người có user.manage (không phải owner) không tự gán owner, không đụng tài khoản owner", async () => {
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['owner','warehouse'], 'thử')", [warehouseId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['owner'], 'thử')", [salesId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['sales'], 'thử')", [ownerId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_reset_password($1, 'x')", [ownerId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_set_user_status($1, 'disabled', 'thử chiếm quyền')", [ownerId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_update_user($1, 'Kẻ lạ', NULL, 'attacker@watchflow.local', NULL)", [ownerId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_create_user('x9@watchflow.local','X',NULL,'h', ARRAY['owner'])")), "WF-AUTH-FORBIDDEN");
  // tự khóa/tự đặt lại mật khẩu chính mình cũng bị chặn
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_set_user_status($1, 'disabled', 'thử tự khóa')", [warehouseId])), "WF-AUTH-FORBIDDEN");
  // vẫn quản lý được nhân viên thường
  await asUser(warehouseId, (c) => c.query("SELECT app.fn_update_user($1, NULL, '0900000099', NULL, NULL)", [salesId]));
});

test("role.manage không phải owner: không sửa vai trò owner hay vai trò mình đang giữ (chống tự nâng quyền)", async () => {
  const [{ id: ownerRole }] = await ownerSql("SELECT id FROM public.roles WHERE code='owner'");
  const [{ id: salesRole }] = await ownerSql("SELECT id FROM public.roles WHERE code='sales'");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_set_role_permissions($1, ARRAY['user.manage','role.manage','profit.view','settings.manage'])", [adminRoleId])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_set_role_permissions($1, ARRAY['user.manage','role.manage'])", [ownerRole])), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_upsert_role($1, NULL, 'X', NULL, 100, NULL)", [adminRoleId])), "WF-AUTH-FORBIDDEN");
  // vai trò sales (không giữ) thì sửa được
  const [{ perms }] = await ownerSql("SELECT array_agg(permission_code) perms FROM public.role_permissions WHERE role_id=$1", [salesRole]);
  await asUser(warehouseId, (c) => c.query("SELECT app.fn_set_role_permissions($1, $2)", [salesRole, perms]));
});

test("trần cấp quyền: không phải owner chỉ cấp quyền mình đang có (chặn vai trò mới + tài khoản bù nhìn)", async () => {
  // tạo vai trò mới được (role.manage), nhưng không gắn được quyền mình không có
  const roleId = await asUser(warehouseId, async (c) =>
    (await c.query("SELECT app.fn_upsert_role(NULL, 'm9_puppet', 'Bù nhìn', NULL, 0, true) AS id")).rows[0].id);
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_set_role_permissions($1, ARRAY['cost.view','profit.view'])", [roleId])), "WF-AUTH-FORBIDDEN");
  // quyền nằm trong trần thì được
  await asUser(warehouseId, (c) => c.query("SELECT app.fn_set_role_permissions($1, ARRAY['settings.manage'])", [roleId]));
  // gán vai trò có quyền vượt trần (sales có quyền bán mà người quản lý thử không có) ⇒ chặn, cả khi tạo người dùng
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_create_user('puppet9@watchflow.local','Bù nhìn',NULL,'h', ARRAY['sales'])")), "WF-AUTH-FORBIDDEN");
  const [{ id: ctvId }] = await ownerSql("SELECT id FROM public.users WHERE email = $1", [userOf("collaborator").email]);
  await expectWf(asUser(warehouseId, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['collaborator','sales'], 'thử vượt trần')", [ctvId])), "WF-AUTH-FORBIDDEN");
  await ownerSql("DELETE FROM public.role_permissions WHERE role_id = $1", [roleId]);
  await ownerSql("DELETE FROM public.roles WHERE id = $1", [roleId]);
});

test("cài đặt security.* chỉ owner; mfa_required_roles luôn chứa owner", async () => {
  await expectWf(asUser(warehouseId, (c) => c.query(`SELECT app.fn_set_setting('security.mfa_required_roles', '[]'::jsonb)`)), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(ownerId, (c) => c.query(`SELECT app.fn_set_setting('security.mfa_required_roles', '["sales"]'::jsonb)`)), "WF-VALIDATION");
});

test("owner không tự bỏ vai trò owner của chính mình", async () => {
  await expectWf(asUser(ownerId, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['sales'], 'thử')", [ownerId])), "WF-SEC-LAST-OWNER");
});

test("refresh hai tab trong 10 giây: tab chậm vẫn có access token mới, không mất cookie, phiên không bị thu hồi", async () => {
  const a = await login("sales");
  const oldRt = a.jar.get("wf_rt");
  const b = new Client();
  for (const [k, v] of a.jar) b.jar.set(k, v);
  const r1 = await a.post("/api/v1/auth/refresh", {});
  assert.equal(r1.status, 200);
  const r2 = await b.post("/api/v1/auth/refresh", {});
  assert.equal(r2.status, 200);
  assert.equal(b.jar.get("wf_rt"), oldRt, "tab chậm không bị xóa/ghi đè cookie refresh trong ân hạn");
  assert.ok(b.jar.get("wf_at"));
  assert.equal((await b.get("/api/v1/auth/me")).status, 200);
  assert.equal((await a.get("/api/v1/auth/me")).status, 200);
});

test("phiên quá hạn tuyệt đối ⇒ access và refresh đều 401", async () => {
  const c = await login("sales");
  await ownerSql(
    "UPDATE public.auth_sessions SET expires_at = now() - interval '1 second' WHERE user_id = (SELECT id FROM public.users WHERE email=$1) AND revoked_at IS NULL",
    [c.email],
  );
  assert.equal((await c.get("/api/v1/auth/me")).status, 401);
  const c2 = await login("sales");
  await ownerSql(
    "UPDATE public.auth_sessions SET expires_at = now() - interval '1 second' WHERE user_id = (SELECT id FROM public.users WHERE email=$1) AND revoked_at IS NULL",
    [c2.email],
  );
  assert.equal((await c2.post("/api/v1/auth/refresh", {})).status, 401);
});

test("pgcrypto không gọi được từ wf_app", async () => {
  await assert.rejects(asUser(salesId, (c) => c.query("SELECT public.gen_random_bytes(4)")), /permission denied/);
});

test("API: owner vẫn quản trị được (reauth) — gán vai trò cho nhân viên", async () => {
  const o = await login("owner");
  await reauth(o);
  const r = await o.put(`/api/v1/users/${salesId}/roles`, { roles: ["sales"], reason: "kiểm định M9" });
  assert.ok([200, 204].includes(r.status), JSON.stringify(r.body));
});

test("dọn: bỏ vai trò thử", async () => {
  await ownerSql("DELETE FROM public.user_roles WHERE role_id = $1", [adminRoleId]);
});
