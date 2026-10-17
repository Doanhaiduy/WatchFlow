// M10 — Ảnh & lưu trữ: dọn tệp đã xóa khỏi kho (PII), tệp bất biến không bị xóa, theo dõi dung lượng cần system.health.
// BR-SEC-03 (ẩn danh khách ⇒ xóa THẬT ảnh giấy tờ), migration 0014_storage_purge.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { login, reauth, ownerSql, asUser, userOf } from "./_lib.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const STORE = path.join(process.cwd(), ".local", "storage");
const onDisk = (f) => fs.existsSync(path.join(STORE, f.bucket, f.path));
const thumbOnDisk = (f) => fs.existsSync(path.join(STORE, f.bucket, f.thumb_path));
const runDaily = async (slot) => {
  const r = await fetch(process.env.TEST_BASE_URL + "/api/cron/daily?slot=" + slot, { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } });
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.ok, true, JSON.stringify(b));
  return b;
};
const row = async (id) => (await ownerSql("SELECT * FROM public.files WHERE id=$1", [id]))[0];

let owner, sales, wh;
const upload = async (c, kind, entityTable, entityId) => {
  const f = new FormData();
  f.set("kind", kind);
  if (entityTable) { f.set("entityTable", entityTable); f.set("entityId", entityId); }
  f.set("file", new Blob([PNG], { type: "image/png" }), "a.png");
  const r = await c.post("/api/v1/files", f);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.id;
};

test("đăng nhập", async () => {
  [owner, sales, wh] = await Promise.all([login("owner"), login("sales"), login("warehouse")]);
});

test("ẩn danh khách ⇒ job DAILY xóa THẬT mọi ảnh giấy tờ (gắn khách + phiếu thu mua) khỏi kho; ảnh khác giữ nguyên", async () => {
  const c = (await sales.post("/api/v1/customers", { fullName: "Khách Xóa Ảnh Giấy Tờ", phone: "0933555777", idNumber: "001199887766", force: true })).body;
  const [rc] = await ownerSql("INSERT INTO public.purchase_receipts (kind, seller_customer_id, created_by) VALUES ('customer_buyback', $1, $2) RETURNING id", [c.id, userOf("warehouse").id]);
  const idCust = await upload(sales, "id_document", "customers", c.id);
  const idRcpt = await upload(wh, "id_document", "purchase_receipts", rc.id);
  const photo = await upload(wh, "condition", "purchase_receipts", rc.id);
  const [fc, fr, fp] = await Promise.all([row(idCust), row(idRcpt), row(photo)]);
  for (const f of [fc, fr, fp]) { assert.ok(onDisk(f), "tệp phải có trong kho trước khi ẩn danh"); assert.ok(thumbOnDisk(f)); assert.ok(f.thumb_size_bytes > 0); }
  assert.equal(fc.is_immutable, true, "ảnh giấy tờ bất biến");

  await reauth(owner);
  const r = await owner.post(`/api/v1/customers/${c.id}/anonymize`, { reason: "Khách yêu cầu xóa dữ liệu cá nhân" }, { "Idempotency-Key": crypto.randomUUID() });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  // Ngay sau ẩn danh: đã đánh dấu + hẹn xóa ngay; tệp CÒN trong kho cho tới khi job chạy
  const [a, b, p] = await Promise.all([row(idCust), row(idRcpt), row(photo)]);
  assert.equal(a.is_deleted && b.is_deleted, true);
  assert.ok(a.purge_after && new Date(a.purge_after) <= new Date(), "ảnh giấy tờ: purge_after = ngay");
  assert.equal(a.purged_at, null);
  assert.equal(p.is_deleted, false, "ảnh máy của phiếu không bị ảnh hưởng");
  assert.ok(onDisk(a) && onDisk(b));
  assert.equal((await owner.get(`/api/v1/files/${idCust}`)).status, 404, "tệp đã xóa không còn tải được qua API");

  const j = await runDaily("m10-anon");
  assert.ok(j.notes.some((n) => /^storage-purge: đã xóa \d+\/\d+ tệp/.test(n)), JSON.stringify(j.notes));
  const [a2, b2, p2] = await Promise.all([row(idCust), row(idRcpt), row(photo)]);
  assert.ok(a2.purged_at && b2.purged_at, "đã đánh dấu purged_at");
  for (const f of [a2, b2]) { assert.equal(onDisk(f), false, "ảnh chính đã bị xóa thật"); assert.equal(thumbOnDisk(f), false, "thumb đã bị xóa thật"); }
  assert.equal(p2.purged_at, null);
  assert.ok(onDisk(p2), "ảnh máy còn nguyên");
  assert.ok((await ownerSql("SELECT 1 FROM public.audit_logs WHERE action='storage.purged'")).length >= 1, "có audit xóa thật");

  // Job chạy lại (slot khác) ⇒ idempotent
  await runDaily("m10-anon-2");
  assert.ok((await row(idCust)).purged_at);
  // Đã xóa thật thì không thể bỏ xóa
  await assert.rejects(ownerSql("UPDATE public.files SET is_deleted=false WHERE id=$1", [idCust]), /không thể khôi phục/);
});

test("tệp bất biến (intake/evidence) bị đánh dấu xóa KHÔNG bao giờ tự bị xóa; wf_app không sửa được tệp bất biến", async () => {
  const id = await upload(owner, "intake", "repair_orders", crypto.randomUUID());
  const f = await row(id);
  assert.equal(f.is_immutable, true);
  // người dùng ứng dụng không đặt is_deleted được trên tệp bất biến (RLS files_update)
  const n = await asUser(userOf("warehouse").id, async (cn) => (await cn.query("UPDATE public.files SET is_deleted = true WHERE id=$1", [id])).rowCount);
  assert.equal(n, 0);
  // nghiệp vụ lỡ đánh dấu xóa (vd. qua SQL của chủ DB) ⇒ không có purge_after ⇒ job bỏ qua
  await ownerSql("UPDATE public.files SET is_deleted=true WHERE id=$1", [id]);
  const d = await row(id);
  assert.equal(d.purge_after, null, "tệp bất biến không có hẹn xóa");
  await runDaily("m10-immutable");
  const after = await row(id);
  assert.equal(after.purged_at, null);
  assert.ok(onDisk(after) && thumbOnDisk(after), "tệp bất biến còn nguyên trong kho");
});

test("ảnh thường xóa mềm ⇒ hẹn xóa thật sau storage.purge_after_days (7 ngày); quá hạn mới bị xóa; wf_app không ghi được purged_at", async () => {
  const id = await upload(wh, "condition", "watch_units", crypto.randomUUID());
  const f = await row(id);
  assert.equal(f.is_immutable, false);
  // ứng dụng không tự xóa mềm tệp (chỉ qua hàm nghiệp vụ như fn_anonymize_customer); ở đây mô phỏng hàm nghiệp vụ bằng SQL của chủ DB
  await assert.rejects(asUser(userOf("warehouse").id, (cn) => cn.query("UPDATE public.files SET is_deleted = true WHERE id=$1", [id])), /row-level security/);
  await ownerSql("UPDATE public.files SET is_deleted = true WHERE id=$1", [id]);
  const [{ days }] = await ownerSql("SELECT extract(epoch FROM (purge_after - now()))/86400 AS days FROM public.files WHERE id=$1", [id]);
  assert.ok(Number(days) > 6.9 && Number(days) < 7.01, "hẹn sau ~7 ngày, được " + days);
  await runDaily("m10-grace");
  assert.ok(onDisk(await row(id)), "chưa tới hạn ⇒ còn trong kho");
  // wf_app không có quyền ghi purge_after/purged_at
  await assert.rejects(asUser(userOf("warehouse").id, (cn) => cn.query("UPDATE public.files SET purged_at = now() WHERE id=$1", [id])), /permission denied/);
  await ownerSql("UPDATE public.files SET purge_after = now() - interval '1 minute' WHERE id=$1", [id]);
  await runDaily("m10-due");
  const g = await row(id);
  assert.ok(g.purged_at);
  assert.equal(onDisk(g), false);
});

test("dung lượng kho: /api/v1/system/storage cần system.health; có số liệu theo bucket + ước tính", async () => {
  assert.equal((await sales.get("/api/v1/system/storage")).status, 403);
  assert.equal((await wh.get("/api/v1/system/storage")).status, 403);
  const r = await owner.get("/api/v1/system/storage");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const b = r.body;
  assert.ok(b.totalBytes > 0 && b.totalFiles > 0);
  assert.ok(b.buckets.some((x) => x.bucket === "unit-photos" || x.bucket === "documents" || x.bucket === "repair-photos"));
  assert.equal(b.quotaMb, 1024);
  assert.ok(["ok", "warn", "critical"].includes(b.level));
  assert.equal(b.totalBytes, b.buckets.reduce((a, x) => a + x.bytes, 0));
  assert.ok(b.purged.files >= 1, "đã có tệp xóa thật ở các ca trên");
  // hàm DB cũng chặn người không có quyền (không chỉ lớp API)
  await assert.rejects(asUser(userOf("sales").id, (cn) => cn.query("SELECT app.fn_storage_usage()")), /WF-AUTH-FORBIDDEN|forbidden|quyền/i);
});

test("vượt ngưỡng dung lượng ⇒ job DAILY gửi thông báo cho người có system.health (mỗi mức một lần/tuần)", async () => {
  await ownerSql("UPDATE public.settings SET value='0'::jsonb WHERE key='storage.warn_percent'");
  try {
    await ownerSql("DELETE FROM public.job_runs WHERE slot LIKE 'm10-alert%'");
    const j = await runDaily("m10-alert");
    assert.ok(j.notes.some((n) => /^storage-monitor: .*\((warn|critical)\), đã báo/.test(n)), JSON.stringify(j.notes));
    const n = (await owner.get("/api/v1/notifications?page=1&pageSize=20")).body.items;
    assert.ok(n.some((x) => x.title?.startsWith("Kho ảnh")), JSON.stringify(n.map((x) => x.title)));
  } finally {
    await ownerSql("UPDATE public.settings SET value='80'::jsonb WHERE key='storage.warn_percent'");
  }
});
