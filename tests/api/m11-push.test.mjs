// M11 — Thông báo đẩy (Web Push) với bộ gửi GIẢ (WF_PUSH_FAKE=1, tin ghi vào WF_PUSH_FAKE_FILE; không gọi dịch vụ đẩy thật):
// đăng ký/hủy thiết bị chỉ của mình, khóa p256dh/auth không ai đọc được ngoài máy chủ gửi tin, thông báo mới ⇒ tin đúng nội dung tối thiểu,
// 410 ⇒ tắt thiết bị, giờ yên tĩnh ⇒ giữ lại, máy dùng chung đổi tài khoản, "Gửi thử".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, asUser, login, ownerSql, userOf } from "./_lib.mjs";

const FAKE = process.env.WF_PUSH_FAKE_FILE;
const rid = () => crypto.randomUUID().replace(/-/g, "");
const b64u = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url");
const keys = () => ({ p256dh: b64u(65), auth: b64u(16) });
const readFake = () => (FAKE && fs.existsSync(FAKE) ? fs.readFileSync(FAKE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, ms = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const v = await pred();
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(250);
  }
}
let owner, sales, wh, ownerId, salesId;
let E1, K1;

test("chuẩn bị + cấu hình", async () => {
  assert.ok(FAKE, "thiếu WF_PUSH_FAKE_FILE (chạy qua scripts/test-api.mjs)");
  [owner, sales, wh] = await Promise.all([login("owner"), login("sales"), login("warehouse")]);
  ownerId = userOf("owner").id;
  salesId = userOf("sales").id;
  E1 = `https://fake.push.invalid/ok/${rid()}`;
  K1 = keys();
  const un = await new Client().get("/api/v1/me/push-config");
  assert.equal(un.status, 401);
  const c = await owner.get("/api/v1/me/push-config");
  assert.equal(c.status, 200);
  assert.equal(c.body.enabled, true);
  assert.equal(typeof c.body.publicKey, "string");
  assert.deepEqual(c.body.devices, []);
  assert.deepEqual(c.body.quiet, { enabled: false, start: 1320, end: 420 });
});

test("đăng ký: kiểm dữ liệu vào; chỉ https; không lộ khóa ra API", async () => {
  assert.equal((await owner.post("/api/v1/me/push-subscriptions", { endpoint: "http://fake.push.invalid/x", keys: keys() })).status, 422);
  assert.equal((await owner.post("/api/v1/me/push-subscriptions", { endpoint: E1, keys: { p256dh: "ngắn", auth: "x" } })).status, 422);
  const r = await owner.post("/api/v1/me/push-subscriptions", { endpoint: E1, keys: K1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.id, /^[0-9a-f-]{36}$/);
  const c = await owner.get("/api/v1/me/push-config");
  assert.deepEqual(c.body.devices.map((d) => d.endpoint), [E1]);
  const raw = JSON.stringify(c.body);
  assert.ok(!raw.includes(K1.p256dh) && !raw.includes(K1.auth), "API không được trả khóa bí mật");
  // audit có ghi, không kèm endpoint/khóa
  const [a] = await ownerSql("SELECT after::text t FROM public.audit_logs WHERE action = 'push.subscribed' ORDER BY at DESC LIMIT 1");
  assert.ok(a && !a.t.includes(K1.auth) && !a.t.includes("fake.push.invalid"));
});

test("PT: người khác không thấy/hủy được thiết bị của mình; wf_app không đọc được khóa", async () => {
  const c = await sales.get("/api/v1/me/push-config");
  assert.deepEqual(c.body.devices, []);
  const del = await sales.del("/api/v1/me/push-subscriptions");
  assert.equal(del.status, 422, "DELETE cần body {endpoint}");
  const d2 = await sales.req("DELETE", "/api/v1/me/push-subscriptions", { endpoint: E1 });
  assert.equal(d2.status, 200);
  assert.equal(d2.body.removed, false);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.push_subscriptions WHERE endpoint = $1", [E1]))[0].n, 1);
  // DB: sales (wf_app) không SELECT được cột bí mật và không thấy dòng của người khác
  await assert.rejects(asUser(salesId, (c2) => c2.query("SELECT p256dh FROM public.push_subscriptions")), /permission denied/);
  await assert.rejects(asUser(salesId, (c2) => c2.query("SELECT auth FROM public.push_subscriptions")), /permission denied/);
  await assert.rejects(asUser(ownerId, (c2) => c2.query("SELECT * FROM public.push_subscriptions")), /permission denied/);
  const seen = await asUser(salesId, (c2) => c2.query("SELECT id, endpoint FROM public.push_subscriptions"));
  assert.equal(seen.rows.length, 0);
  const mine = await asUser(ownerId, (c2) => c2.query("SELECT id, endpoint FROM public.push_subscriptions"));
  assert.deepEqual(mine.rows.map((r) => r.endpoint), [E1]);
  // không ghi/xóa trực tiếp
  await assert.rejects(asUser(ownerId, (c2) => c2.query("DELETE FROM public.push_subscriptions")), /permission denied/);
  await assert.rejects(asUser(ownerId, (c2) => c2.query("UPDATE public.push_subscriptions SET user_id = $1", [salesId])), /permission denied/);
  await assert.rejects(asUser(ownerId, (c2) => c2.query("SELECT * FROM public.push_outbox")), /permission denied/);
});

test("thông báo mới ⇒ bộ gửi giả nhận đúng nội dung tối thiểu; người không đăng ký thiết bị không có hàng đợi", async () => {
  const before = readFake().length;
  const dk = "push-t1-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('system.health', 'test.push', 'Giữ hàng quá hạn: GH-1', 'Chiếc W-001 đã quá hạn giữ 550,000 đồng cọc.', '/giu-hang', $1)", [dk]);
  const [n] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [ownerId, dk]);
  assert.ok(n, "owner nhận thông báo trong ứng dụng");
  const ob = await ownerSql("SELECT user_id FROM public.push_outbox WHERE notification_id = $1", [n.id]);
  assert.deepEqual(ob.map((r) => r.user_id), [ownerId], "chỉ người có thiết bị đang bật được xếp hàng");
  await owner.post("/api/v1/notifications/read-all"); // một request ghi ⇒ kickOutbox đẩy hàng đợi
  const hit = await waitFor(() => readFake().slice(before).find((x) => x.payload.nid === n.id));
  assert.ok(hit, "bộ gửi giả phải nhận tin");
  assert.equal(hit.endpoint, E1);
  assert.deepEqual(Object.keys(hit.payload).sort(), ["body", "nid", "tag", "title", "url"], "không kèm dữ liệu thừa");
  assert.equal(hit.payload.title, "Giữ hàng quá hạn: GH-1");
  assert.equal(hit.payload.body, "Chiếc W-001 đã quá hạn giữ 550.000 đồng cọc.");
  assert.equal(hit.payload.url, "/giu-hang");
  assert.ok(!JSON.stringify(hit.payload).includes(ownerId) && !JSON.stringify(hit.payload).includes(userOf("owner").email));
  const st = await waitFor(async () => (await ownerSql("SELECT status FROM public.push_outbox WHERE notification_id = $1", [n.id]))[0]?.status === "sent");
  assert.ok(st, "hàng đợi chuyển sent");
  assert.ok((await ownerSql("SELECT last_ok_at FROM public.push_subscriptions WHERE endpoint = $1", [E1]))[0].last_ok_at);
});

test("liên kết thông báo không an toàn ⇒ mở trang Thông báo (không đưa URL lạ vào tin)", async () => {
  const before = readFake().length;
  const dk = "push-t1b-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('system.health', 'test.push', 'Liên kết lạ', 'x', 'https://evil.example/phish', $1)", [dk]);
  const [n] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [ownerId, dk]);
  await owner.post("/api/v1/notifications/read-all");
  const hit = await waitFor(() => readFake().slice(before).find((x) => x.payload.nid === n.id));
  assert.ok(hit);
  assert.equal(hit.payload.url, "/thong-bao");
});

test("Gửi thử: chỉ khi có thiết bị; giới hạn tần suất", async () => {
  assert.equal((await wh.post("/api/v1/me/push-subscriptions/test")).body.code, "WF-PUSH-NO-DEVICE");
  const before = readFake().length;
  const r = await owner.post("/api/v1/me/push-subscriptions/test");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { devices: 1, sent: 1, failed: 0 });
  const hit = readFake().slice(before).find((x) => x.payload.tag === "test");
  assert.ok(hit && hit.endpoint === E1);
  assert.equal((await owner.post("/api/v1/me/push-subscriptions/test")).status, 429);
});

test("giờ yên tĩnh: giữ lại, không gửi; hết giờ yên tĩnh thì gửi", async () => {
  const nowVn = (new Date().getUTCHours() * 60 + new Date().getUTCMinutes() + 420) % 1440;
  const put = await owner.put("/api/v1/me/push-config", { quietEnabled: true, quietStart: (nowVn + 1440 - 60) % 1440, quietEnd: (nowVn + 60) % 1440 });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal((await owner.put("/api/v1/me/push-config", { quietEnabled: true, quietStart: 1500, quietEnd: 0 })).status, 422);
  assert.equal((await owner.get("/api/v1/me/push-config")).body.quiet.enabled, true);
  const before = readFake().length;
  const dk = "push-t3-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('system.health', 'test.push', 'Đêm khuya', 'Không làm phiền', '/thong-bao', $1)", [dk]);
  const [n] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [ownerId, dk]);
  await owner.post("/api/v1/notifications/read-all");
  const held = await waitFor(async () => {
    const [o] = await ownerSql("SELECT status, attempts, next_attempt_at > now() + interval '30 minutes' AS later FROM public.push_outbox WHERE notification_id = $1", [n.id]);
    return o?.status === "queued" && o.later && o.attempts === 0 ? o : null;
  });
  assert.ok(held, "dòng phải bị lùi giờ gửi tới hết giờ yên tĩnh, không tính lần thử");
  assert.equal(readFake().slice(before).filter((x) => x.payload.nid === n.id).length, 0, "không được gửi trong giờ yên tĩnh");
  // tắt giờ yên tĩnh + cho đến hạn ⇒ gửi
  await owner.put("/api/v1/me/push-config", { quietEnabled: false, quietStart: 1320, quietEnd: 420 });
  await ownerSql("UPDATE public.push_outbox SET next_attempt_at = now() WHERE notification_id = $1", [n.id]);
  await owner.post("/api/v1/notifications/read-all");
  const hit = await waitFor(() => readFake().slice(before).find((x) => x.payload.nid === n.id));
  assert.ok(hit, "hết giờ yên tĩnh ⇒ gửi");
});

test("410 ⇒ thiết bị bị tắt, hàng đợi bỏ qua, thông báo sau không xếp hàng nữa", async () => {
  const gone = `https://fake.push.invalid/gone/${rid()}`;
  assert.equal((await sales.post("/api/v1/me/push-subscriptions", { endpoint: gone, keys: keys() })).status, 200);
  const dk = "push-t4-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('sale.confirm', 'test.push', 'Đơn CTV', 'Chờ xác nhận', '/ban-hang', $1)", [dk]);
  const [n] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [salesId, dk]);
  assert.ok(n, "sales có quyền sale.confirm");
  await sales.post("/api/v1/notifications/read-all");
  const off = await waitFor(async () => (await ownerSql("SELECT disabled_at FROM public.push_subscriptions WHERE endpoint = $1", [gone]))[0]?.disabled_at);
  assert.ok(off, "410 ⇒ disabled_at");
  const [o] = await ownerSql("SELECT status, last_error FROM public.push_outbox WHERE notification_id = $1", [n.id]);
  assert.equal(o.status, "skipped");
  assert.equal(readFake().filter((x) => x.endpoint === gone).length, 0);
  const dk2 = "push-t4b-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('sale.confirm', 'test.push', 'Đơn CTV 2', 'x', '/ban-hang', $1)", [dk2]);
  const [n2] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [salesId, dk2]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.push_outbox WHERE notification_id = $1", [n2.id]))[0].n, 0);
});

test("lỗi tạm thời (5xx) ⇒ thử lại giãn dần, không tắt thiết bị ngay", async () => {
  const flaky = `https://fake.push.invalid/fail/${rid()}`;
  assert.equal((await sales.post("/api/v1/me/push-subscriptions", { endpoint: flaky, keys: keys() })).status, 200);
  const dk = "push-t5-" + rid();
  await ownerSql("SELECT app.fn_notify_permission('sale.confirm', 'test.push', 'Thử lại', 'x', '/ban-hang', $1)", [dk]);
  const [n] = await ownerSql("SELECT id FROM public.notifications WHERE user_id = $1 AND dedupe_key = $2", [salesId, dk]);
  await sales.post("/api/v1/notifications/read-all");
  const retry = await waitFor(async () => {
    const [o] = await ownerSql("SELECT status, attempts, last_error, next_attempt_at > now() AS later FROM public.push_outbox WHERE notification_id = $1", [n.id]);
    return o?.attempts >= 1 ? o : null;
  });
  assert.ok(retry);
  assert.deepEqual([retry.status, retry.attempts, retry.last_error, retry.later], ["queued", 1, "HTTP 500", true]);
  const [s] = await ownerSql("SELECT fail_count, disabled_at FROM public.push_subscriptions WHERE endpoint = $1", [flaky]);
  assert.deepEqual([s.fail_count, s.disabled_at], [1, null]);
  // 5 lần ⇒ failed
  await ownerSql("UPDATE public.push_outbox SET attempts = 4, next_attempt_at = now() WHERE notification_id = $1", [n.id]);
  await sales.post("/api/v1/notifications/read-all");
  const failed = await waitFor(async () => (await ownerSql("SELECT status FROM public.push_outbox WHERE notification_id = $1", [n.id]))[0]?.status === "failed");
  assert.ok(failed, "quá 5 lần ⇒ failed");
});

test("máy dùng chung: cùng endpoint đăng ký bởi người khác ⇒ chuyển chủ; hủy chỉ của mình", async () => {
  const r = await sales.post("/api/v1/me/push-subscriptions", { endpoint: E1, keys: keys() });
  assert.equal(r.status, 200);
  assert.deepEqual((await owner.get("/api/v1/me/push-config")).body.devices, []);
  assert.deepEqual((await sales.get("/api/v1/me/push-config")).body.devices.filter((d) => d.endpoint === E1).length, 1);
  // owner hủy thiết bị đã chuyển chủ ⇒ không tác dụng
  assert.equal((await owner.req("DELETE", "/api/v1/me/push-subscriptions", { endpoint: E1 })).body.removed, false);
  assert.equal((await sales.req("DELETE", "/api/v1/me/push-subscriptions", { endpoint: E1 })).body.removed, true);
  assert.equal((await sales.req("DELETE", "/api/v1/me/push-subscriptions", { endpoint: E1 })).body.removed, false);
});

test("dọn dẹp: không để thiết bị giả ảnh hưởng bộ khác", async () => {
  await ownerSql("DELETE FROM public.push_subscriptions WHERE endpoint LIKE 'https://fake.push.invalid/%'");
  await owner.put("/api/v1/me/push-config", { quietEnabled: false, quietStart: 1320, quietEnd: 420 });
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.push_subscriptions"))[0].n, 0);
});
