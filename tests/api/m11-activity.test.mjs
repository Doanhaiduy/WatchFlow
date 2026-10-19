// M11 — Nhật ký hoạt động cấp request (0021_activity.sql): ghi đúng route mẫu, không PII/query, chỉ audit.view đọc,
// append-only (UPDATE/DELETE/TRUNCATE bị chặn), dọn theo retention chỉ qua hàm definer, đọc nhạy cảm có mã action.
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Client, login, ownerSql, apiConn, asUser, userOf, wfCode } from "./_lib.mjs";

const uuid = () => crypto.randomUUID();
/** Chờ nhật ký (ghi SAU phản hồi, gộp lô) xuất hiện trong DB */
async function waitRows(sql, params, min = 1, ms = 8000) {
  const t0 = Date.now();
  for (;;) {
    const r = await ownerSql(sql, params);
    if (r.length >= min) return r;
    if (Date.now() - t0 > ms) return r;
    await new Promise((x) => setTimeout(x, 150));
  }
}
const uid = async (email) => (await ownerSql("SELECT id FROM public.users WHERE email = $1", [email]))[0].id;

/** Kết nối superuser giữ phiên (cho SET ROLE) */
async function withRole(role, fn) {
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL ROLE ${role}`);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

test("thao tác ghi được ghi SAU phản hồi với route mẫu, entity_id UUID, trạng thái, IP băm, request_id; không lộ giá trị tham số/query", async () => {
  const s = await login("sales");
  const salesId = await uid(userOf("sales").email);
  const id = uuid();
  const r = await s.post(`/api/v1/sales/${id}/void?secret=BIMAT123&phone=0912345678`, { reason: "NOI-DUNG-GUI-LEN-KHONG-DUOC-GHI-0912345678" });
  assert.ok(r.status >= 400, "sales không có quyền hủy đơn ⇒ lỗi");
  const rid = r.headers.get("x-request-id");
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE entity_id = $1", [id]);
  assert.equal(rows.length, 1, "đúng một dòng");
  const a = rows[0];
  assert.equal(a.user_id, salesId);
  assert.equal(a.method, "POST");
  assert.equal(a.route, "/api/v1/sales/[id]/void");
  assert.equal(a.status, r.status);
  assert.ok(a.error_code?.startsWith("WF-"), "mã lỗi: " + a.error_code);
  assert.match(a.ip_hash, /^[0-9a-f]{8,64}$/);
  assert.equal(a.request_id, rid);
  assert.ok(a.duration_ms >= 0);
  // không lộ gì ngoài mẫu
  const blob = JSON.stringify(a);
  for (const bad of ["BIMAT123", "0912345678", "NOI-DUNG", "secret", id + "/"]) assert.equal(blob.includes(bad), false, "lọt: " + bad);
  assert.equal(a.route.includes("?"), false);
  assert.equal(a.route.includes(id), false);
});

test("tham số đường dẫn không phải UUID (có thể là PII) ⇒ route vẫn là mẫu, entity_id rỗng", async () => {
  const s = await login("sales");
  const marker = "0987654321";
  const before = (await ownerSql("SELECT count(*)::int n FROM public.activity_logs"))[0].n;
  const r = await s.post(`/api/v1/sales/${marker}/void`, { reason: "kiểm thử không PII trong route" });
  assert.ok(r.status >= 400);
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE route = '/api/v1/sales/[id]/void' ORDER BY at DESC LIMIT 1", []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entity_id, null);
  const leaked = await ownerSql("SELECT count(*)::int n FROM public.activity_logs WHERE route LIKE $1 OR coalesce(entity_id,'') LIKE $1", ["%" + marker + "%"]);
  assert.equal(leaked[0].n, 0);
  assert.ok((await ownerSql("SELECT count(*)::int n FROM public.activity_logs"))[0].n > before);
});

test("đọc thường KHÔNG ghi; đọc nhạy cảm (tem/in) ghi kèm action; poll/đánh dấu đã đọc bị bỏ qua", async () => {
  const o = await login("owner");
  const ownerId = await uid(userOf("owner").email);
  const marker = uuid();
  await o.get("/api/v1/sales?page=1");
  await o.get("/api/v1/notifications");
  await o.post("/api/v1/notifications/read-all", {});
  const label = await o.get(`/api/v1/catalog/units/${marker}/label`);
  assert.ok(label.status >= 200);
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE entity_id = $1", [marker]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "print");
  assert.equal(rows[0].route, "/api/v1/catalog/units/[id]/label");
  await new Promise((x) => setTimeout(x, 800));
  const noise = await ownerSql(
    `SELECT route FROM public.activity_logs WHERE user_id = $1 AND at > now() - interval '30 seconds'
        AND (route = '/api/v1/sales' OR route LIKE '/api/v1/notifications%')`, [ownerId]);
  assert.equal(noise.length, 0, "GET thường/poll/read-all không được ghi: " + JSON.stringify(noise));
});

test("xuất Excel báo cáo ghi action=export (cùng request_id với audit report.exported); xem báo cáo thường ghi view_report", async () => {
  const o = await login("owner");
  const q = "?from=2026-01-01&to=2026-12-31";
  const x = await o.get("/api/v1/reports/revenue" + q + "&format=xlsx");
  assert.equal(x.status, 200);
  const rid = x.headers.get("x-request-id");
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE request_id = $1", [rid]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "export");
  assert.equal(rows[0].route, "/api/v1/reports/[code]");
  const au = await ownerSql("SELECT 1 FROM public.audit_logs WHERE request_id = $1 AND action = 'report.exported'", [rid]);
  assert.equal(au.length, 1, "liên kết với audit qua request_id");
  const v = await o.get("/api/v1/reports/revenue" + q);
  assert.equal(v.status, 200);
  const vr = await waitRows("SELECT * FROM public.activity_logs WHERE request_id = $1", [v.headers.get("x-request-id")]);
  assert.equal(vr[0].action, "view_report");
});

test("thao tác bị từ chối (403) trên GET cũng được ghi; chỉ thiếu 2FA thì không", async () => {
  const s = await login("sales");
  const r = await s.get("/api/v1/users");
  assert.equal(r.status, 403);
  const rid = r.headers.get("x-request-id");
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE request_id = $1", [rid]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 403);
  assert.equal(rows[0].error_code, "WF-AUTH-FORBIDDEN");
});

test("chỉ audit.view đọc: API 403 cho sales/kho/CTV, 200 cho chủ; RLS chặn ở DB", async () => {
  for (const role of ["sales", "warehouse", "collaborator"]) {
    const c = await login(role);
    for (const p of ["/api/v1/activity", "/api/v1/activity/logins", "/api/v1/activity/users"]) {
      const r = await c.get(p);
      assert.equal(r.status, 403, `${role} ${p}`);
    }
    const n = await asUser(await uid(userOf(role).email), async (conn) => (await conn.query("SELECT count(*)::int n FROM public.activity_logs")).rows[0].n);
    assert.equal(n, 0, `${role} thấy ${n} dòng qua RLS`);
  }
  const o = await login("owner");
  const r = await o.get("/api/v1/activity?limit=20");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.items.length > 0);
  const it = r.body.items[0];
  assert.ok(it.label && it.areaLabel && it.route.startsWith("/api/"));
  assert.equal(JSON.stringify(r.body).includes("secret"), false);
  const n = await asUser(await uid(userOf("owner").email), async (conn) => (await conn.query("SELECT count(*)::int n FROM public.activity_logs")).rows[0].n);
  assert.ok(n > 0);
  // lọc theo người + khu vực + khoảng ngày + sensitive
  const sid = await uid(userOf("sales").email);
  const f = await o.get(`/api/v1/activity?userId=${sid}&area=sales`);
  assert.equal(f.status, 200);
  assert.ok(f.body.items.every((x) => x.userId === sid && x.area === "sales"));
  const sens = await o.get("/api/v1/activity?sensitive=1");
  assert.ok(sens.body.items.every((x) => x.action), "chỉ sự kiện nhạy cảm");
  const users = await o.get("/api/v1/activity/users");
  assert.ok(users.body.items.some((u) => u.userId === sid));
  const bad = await o.get("/api/v1/activity?userId=khong-phai-uuid");
  assert.equal(bad.status, 422);
});

test("lịch sử đăng nhập: tái dùng audit_logs auth.* (đăng nhập thành công, sai mật khẩu)", async () => {
  const email = userOf("warehouse").email;
  await new Client().post("/api/v1/auth/login", { email, password: "sai-mat-khau-lich-su-1" });
  await login("warehouse");
  await ownerSql("DELETE FROM public.rate_limit_hits");
  const o = await login("owner");
  const r = await o.get(`/api/v1/activity/logins?userId=${await uid(email)}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const acts = r.body.items.map((x) => x.action);
  assert.ok(acts.includes("auth.login"), "có đăng nhập thành công: " + acts);
  assert.ok(acts.includes("auth.login_failed"), "có sai mật khẩu: " + acts);
  const failed = r.body.items.find((x) => x.action === "auth.login_failed");
  assert.equal(failed.tone, "bad");
  const onlyBad = await o.get(`/api/v1/activity/logins?result=error&userId=${await uid(email)}`);
  assert.ok(onlyBad.body.items.length > 0 && onlyBad.body.items.every((x) => x.tone === "bad"));
  assert.equal(JSON.stringify(r.body).includes("sai-mat-khau"), false);
});

test("append-only: wf_app không INSERT/UPDATE/DELETE; UPDATE/DELETE/TRUNCATE trực tiếp đều bị trigger chặn (cả wf_definer, wf_worker)", async () => {
  const [row] = await ownerSql("SELECT id FROM public.activity_logs LIMIT 1");
  assert.ok(row, "có dữ liệu");
  const appConn = async (sql, p) => {
    const c = await apiConn();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('role','wf_app',true)");
      await c.query(sql, p);
    } finally {
      await c.query("ROLLBACK").catch(() => {});
      await c.end();
    }
  };
  await assert.rejects(appConn("UPDATE public.activity_logs SET status = 200"), /permission denied/);
  await assert.rejects(appConn("DELETE FROM public.activity_logs"), /permission denied/);
  await assert.rejects(appConn("INSERT INTO public.activity_logs (method, route, status) VALUES ('POST','/api/v1/x',200)"), /permission denied/);
  await assert.rejects(appConn("SELECT app.fn_activity_purge()"), /permission denied/);
  // chủ bảng/superuser: trigger vẫn chặn
  await assert.rejects(ownerSql("UPDATE public.activity_logs SET status = 200 WHERE id = $1", [row.id]), (e) => wfCode(e) === "WF-IMMUTABLE");
  await assert.rejects(ownerSql("DELETE FROM public.activity_logs WHERE id = $1", [row.id]), (e) => wfCode(e) === "WF-IMMUTABLE");
  await assert.rejects(ownerSql("TRUNCATE public.activity_logs"), (e) => wfCode(e) === "WF-IMMUTABLE");
  // wf_definer gọi DELETE trực tiếp (không qua hàm dọn) ⇒ vẫn chặn
  await assert.rejects(withRole("wf_definer", (c) => c.query("DELETE FROM public.activity_logs WHERE id = $1", [row.id])), (e) => wfCode(e) === "WF-IMMUTABLE");
  // cố tình bật cờ dọn nhưng không phải wf_definer ⇒ chặn
  await assert.rejects(withRole("wf_worker", async (c) => {
    await c.query("SELECT set_config('app.activity_purge','on',true)");
    await c.query("DELETE FROM public.activity_logs WHERE id = $1", [row.id]);
  }), /permission denied/);
  // wf_worker chỉ INSERT: không đọc, không sửa
  await assert.rejects(withRole("wf_worker", (c) => c.query("SELECT 1 FROM public.activity_logs LIMIT 1")), /permission denied/);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.activity_logs WHERE id = $1", [row.id]))[0].n, 1);
});

test("ràng buộc CHECK: route có query/ký tự lạ, entity_id không phải UUID, ip_hash lạ ⇒ bị từ chối ở DB", async () => {
  const ins = (route, extra = {}) =>
    ownerSql("INSERT INTO public.activity_logs (method, route, status, entity_id, ip_hash) VALUES ('POST',$1,200,$2,$3)", [route, extra.entity ?? null, extra.ip ?? null]);
  await assert.rejects(ins("/api/v1/customers?phone=0912345678"), /activity_logs_route_check/);
  await assert.rejects(ins("/api/v1/khách-hàng"), /activity_logs_route_check/);
  await assert.rejects(ins("/api/v1/sales/[id]", { entity: "0912345678" }), /activity_logs_entity_id_check/);
  await assert.rejects(ins("/api/v1/sales/[id]", { ip: "203.0.113.5" }), /activity_logs_ip_hash_check/);
  await ins("/api/v1/sales/[id]", { entity: uuid(), ip: "ab".repeat(16) }); // hợp lệ
});

test("dọn theo retention: chỉ qua app.fn_activity_purge (wf_worker); quá hạn bị xóa, trong hạn giữ; sàn 30 ngày; ghi audit", async () => {
  const mk = (days) => ownerSql("INSERT INTO public.activity_logs (at, method, route, status) VALUES (now() - make_interval(days => $1), 'POST', '/api/v1/test/retention', 200) RETURNING id", [days]).then((r) => r[0].id);
  const old = await mk(400);
  const mid = await mk(100);
  const recent = await mk(10);
  const purge = (days) => withRole("wf_worker", async (c) => (await c.query("SELECT app.fn_activity_purge($1) AS n", [days])).rows[0].n);
  // tham số nhỏ hơn sàn 30 ngày ⇒ vẫn giữ dòng 10 ngày
  const n1 = await purge(1);
  assert.ok(n1 >= 2, "xóa 400 + 100 ngày (quá sàn 30): " + n1);
  const left1 = await ownerSql("SELECT id FROM public.activity_logs WHERE id = ANY($1)", [[old, mid, recent]]);
  assert.deepEqual(left1.map((x) => x.id), [recent], "dòng 10 ngày được giữ dù p_days=1");
  // theo cài đặt (mặc định 180)
  const old2 = await mk(400);
  const mid2 = await mk(100);
  assert.equal(JSON.stringify((await ownerSql("SELECT value FROM public.settings WHERE key='activity.retention_days'"))[0].value), '180');
  await purge(null);
  const left2 = (await ownerSql("SELECT id FROM public.activity_logs WHERE id = ANY($1)", [[old2, mid2]])).map((x) => x.id);
  assert.deepEqual(left2, [mid2], "100 ngày < 180 ⇒ giữ; 400 ngày ⇒ xóa");
  // đổi cài đặt xuống 60 ngày ⇒ dòng 100 ngày bị dọn
  await ownerSql("UPDATE public.settings SET value = '60' WHERE key = 'activity.retention_days'");
  try {
    await purge(null);
  } finally {
    await ownerSql("UPDATE public.settings SET value = '180' WHERE key = 'activity.retention_days'");
  }
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.activity_logs WHERE id = $1", [mid2]))[0].n, 0);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.activity_logs WHERE id = $1", [recent]))[0].n, 1);
  const au = await ownerSql("SELECT after FROM public.audit_logs WHERE action = 'activity.purged' ORDER BY at DESC LIMIT 1");
  assert.ok(au[0]?.after?.count >= 1, "có audit activity.purged");
  // cờ dọn không rò: sau hàm, DELETE trực tiếp vẫn bị chặn
  await assert.rejects(withRole("wf_definer", (c) => c.query("DELETE FROM public.activity_logs WHERE id = $1", [recent])), (e) => wfCode(e) === "WF-IMMUTABLE");
});

test("ghi nhật ký không làm chậm request: phản hồi thành công có Server-Timing, nhật ký xuất hiện SAU đó", async () => {
  const { ACC } = await import("./_lib.mjs");
  const s = await login("sales");
  const r = await s.post("/api/v1/auth/reauth", { password: ACC.password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.headers.get("server-timing"), "Server-Timing");
  const rows = await waitRows("SELECT * FROM public.activity_logs WHERE request_id = $1", [r.headers.get("x-request-id")]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].route, "/api/v1/auth/reauth");
  assert.equal(rows[0].status, 200);
});
