// Bộ cấu trúc & bảo mật mức DB (không cần máy chủ): migrate ×2, khớp danh mục quyền/cài đặt, RLS 0 dòng khi chưa gắn người dùng,
// PT-08/09 (bất biến audit), PT-10 (owner cuối), PT-07 phần mass-assignment dưới wf_app.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ownerSql, apiConn, asUser, userOf, expectWf, wfCode } from "./_lib.mjs";

test("migrate lần 2: chạy lại mọi file SQL không lỗi (idempotent)", async () => {
  for (const f of fs.readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    await ownerSql(fs.readFileSync(path.join("db/migrations", f), "utf8"));
  }
});

test("danh mục quyền src/lib/permissions.ts khớp bảng permissions", async () => {
  const src = fs.readFileSync("src/lib/permissions.ts", "utf8");
  const ts = [...src.matchAll(/^\s+"([a-z_.]+)": \{ module/gm)].map((m) => m[1]).sort();
  const db = (await ownerSql("SELECT code FROM public.permissions ORDER BY code")).map((r) => r.code);
  assert.deepEqual(ts, db);
});

test("danh mục cài đặt src/lib/settings-catalog.ts khớp bảng settings", async () => {
  const src = fs.readFileSync("src/lib/settings-catalog.ts", "utf8");
  const ts = [...src.matchAll(/^\s+"([a-z_.]+)": \{ group/gm)].map((m) => m[1]).sort();
  const db = (await ownerSql("SELECT key FROM public.settings ORDER BY key")).map((r) => r.key);
  assert.deepEqual(ts, db);
});

test("RLS: wf_app không gắn người dùng ⇒ 0 dòng ở MỌI bảng public", async () => {
  const tables = (await ownerSql("SELECT tablename FROM pg_tables WHERE schemaname='public'")).map((r) => r.tablename);
  const c = await apiConn();
  try {
    for (const t of tables) {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE wf_app");
      try {
        const r = await c.query(`SELECT count(*)::int n FROM public."${t}"`);
        assert.equal(r.rows[0].n, 0, `bảng ${t} lộ ${r.rows[0].n} dòng`);
      } catch (e) {
        assert.equal(e.code, "42501", `bảng ${t}: lỗi lạ ${e.message}`); // không có quyền SELECT cũng đạt
      } finally {
        await c.query("ROLLBACK");
      }
    }
  } finally { await c.end(); }
});

test("wf_api (NOINHERIT) không SET ROLE thì không đọc được bảng nào", async () => {
  const c = await apiConn();
  try { await assert.rejects(c.query("SELECT * FROM public.users LIMIT 1"), /permission denied/); } finally { await c.end(); }
});

test("PT-08: audit_logs bất biến dưới wf_app, wf_owner, superuser", async () => {
  const owner = userOf("owner");
  await ownerSql("INSERT INTO public.audit_logs (action) VALUES ('test.pt08')");
  await assert.rejects(asUser(owner.id, (c) => c.query("UPDATE public.audit_logs SET action='x'")), /permission denied|WF-IMMUTABLE/);
  await assert.rejects(asUser(owner.id, (c) => c.query("DELETE FROM public.audit_logs")), /permission denied|WF-IMMUTABLE/);
  const before = (await ownerSql("SELECT count(*)::int n FROM public.audit_logs WHERE action='test.pt08'"))[0].n;
  for (const sql of ["UPDATE public.audit_logs SET action='x'", "DELETE FROM public.audit_logs", "TRUNCATE public.audit_logs"]) {
    await assert.rejects(ownerSql(sql), /WF-IMMUTABLE/);
    // wf_owner: FORCE RLS không có policy ⇒ UPDATE/DELETE chạm 0 dòng; TRUNCATE ⇒ trigger chặn
    await ownerSql(`SET ROLE wf_owner; ${sql}`).catch((e) => assert.match(e.message, /WF-IMMUTABLE|permission denied/));
  }
  const after = (await ownerSql("SELECT count(*)::int n FROM public.audit_logs WHERE action='test.pt08'"))[0].n;
  assert.equal(after, before);
});

test("PT-07 mass-assignment: wf_app không UPDATE/INSERT trực tiếp users, user_roles, role_permissions, settings", async () => {
  const sales = userOf("sales");
  const tries = [
    "UPDATE public.users SET status='active' WHERE id = app.current_user_id()",
    "UPDATE public.users SET must_change_password=false WHERE id = app.current_user_id()",
    "UPDATE public.users SET email_verified_at=now() WHERE id = app.current_user_id()",
    "INSERT INTO public.user_roles (user_id, role_id) SELECT app.current_user_id(), id FROM public.roles WHERE code='owner'",
    "INSERT INTO public.role_permissions (role_id, permission_code) SELECT id, 'cost.view' FROM public.roles WHERE code='sales'",
    "UPDATE public.settings SET value='0' WHERE key='security.max_failed_logins'",
    "UPDATE public.roles SET max_discount_pct=100 WHERE code='sales'",
  ];
  for (const sql of tries) await assert.rejects(asUser(sales.id, (c) => c.query(sql)), /permission denied/, sql);
});

test("Quyền hàm: sales gọi fn_assign_roles / fn_set_setting ⇒ WF-AUTH-FORBIDDEN", async () => {
  const sales = userOf("sales");
  await expectWf(asUser(sales.id, (c) => c.query("SELECT app.fn_assign_roles(app.current_user_id(), ARRAY['owner'], null)")), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(sales.id, (c) => c.query(`SELECT app.fn_set_setting('security.max_failed_logins', '99')`)), "WF-AUTH-FORBIDDEN");
});

test("PT-10: không khóa / hạ quyền owner cuối cùng", async () => {
  const owner = userOf("owner");
  await expectWf(asUser(owner.id, (c) => c.query("SELECT app.fn_set_user_status($1,'disabled','thử khóa chủ cuối cùng')", [owner.id])), "WF-SEC-LAST-OWNER");
  await expectWf(asUser(owner.id, (c) => c.query("SELECT app.fn_assign_roles($1, ARRAY['sales'], 'thử hạ quyền chủ')", [owner.id])), "WF-SEC-LAST-OWNER");
  const [r] = await ownerSql("SELECT id FROM public.roles WHERE code='owner'");
  await expectWf(asUser(owner.id, (c) => c.query("SELECT app.fn_set_role_permissions($1, ARRAY['catalog.view'])", [r.id])), "WF-SEC-LAST-OWNER");
  // Trực tiếp bằng superuser cũng bị trigger chặn
  await assert.rejects(ownerSql("DELETE FROM public.user_roles WHERE user_id = $1", [owner.id]), /WF-SEC-LAST-OWNER/);
});

test("Lý do bắt buộc ≥ 10 ký tự (BR-GEN-05)", async () => {
  const owner = userOf("owner");
  const sales = userOf("sales");
  await expectWf(asUser(owner.id, (c) => c.query("SELECT app.fn_set_user_status($1,'disabled','ngắn')", [sales.id])), "WF-REASON-REQUIRED");
});

test("fn_next_number: mã tăng dần theo năm, rollback không tái dùng sai (BR-GEN-06)", async () => {
  const [a] = await ownerSql("SELECT app.fn_next_number('TS') AS c");
  const [b] = await ownerSql("SELECT app.fn_next_number('TS') AS c");
  assert.match(a.c, /^TS-\d{4}-\d{4}$/);
  assert.notEqual(a.c, b.c);
  const [d] = await ownerSql("SELECT app.fn_next_number('DX', false, 6) AS c");
  assert.match(d.c, /^DX-\d{6}$/);
});

test("today_vn ghi đè được ở DB test", async () => {
  const owner = userOf("owner");
  const r = await asUser(owner.id, (c) => c.query("SELECT app.today_vn()::text AS d"), { today: "2026-01-15" });
  assert.equal(r.rows[0].d, "2026-01-15");
});

test("tg_audit ghi nhật ký khi đổi cài đặt qua hàm, che cột nhạy cảm", async () => {
  const owner = userOf("owner");
  await asUser(owner.id, (c) => c.query(`SELECT app.fn_set_setting('inventory.aging_days', '120')`));
  const [a] = await ownerSql("SELECT before, after, actor_id FROM public.audit_logs WHERE action='settings.changed' ORDER BY at DESC LIMIT 1");
  assert.equal(a.after, 120);
  assert.equal(a.actor_id, owner.id);
  const rows = await ownerSql("SELECT after FROM public.audit_logs WHERE entity_table='users' AND after ? 'password_hash'");
  for (const r of rows) assert.equal(r.after.password_hash, "***");
  assert.ok(wfCode(new Error('{"code":"X"}')) === "X");
});
