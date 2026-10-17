import "server-only";
// Thông báo đẩy (Web Push / VAPID). Mẫu: ref-sources/domus-francis/src/server/push.ts — đơn giản hóa cho WatchFlow.
//   notifications (INSERT) → trigger app.tg_notification_push → push_outbox (chỉ khi người nhận có thiết bị đang bật).
//   dispatchPendingPush(): lấy dòng đến hạn (mượn chỗ 2 phút để không gửi trùng), gửi NGOÀI transaction, rồi ghi kết quả:
//     • giờ yên tĩnh của người nhận ⇒ lùi next_attempt_at tới hết giờ yên tĩnh (không tính là lần thử);
//     • gửi được ≥ 1 thiết bị ⇒ sent; mọi thiết bị trả 404/410 ⇒ tắt thiết bị (disabled_at) + skipped;
//     • lỗi khác ⇒ thử lại tối đa 5 lần, giãn 2^n phút; quá 5 lần ⇒ failed.
//   Gọi sau mỗi request ghi (kickOutbox) và sau job cron. Không có tiến trình nền riêng.
// Thiếu khóa VAPID ⇒ tính năng tắt êm (pushConfigured() = false). WF_PUSH_FAKE=1 (chỉ ngoài production): bộ gửi GIẢ ghi mỗi tin vào tệp
// WF_PUSH_FAKE_FILE (JSON lines) thay vì gọi dịch vụ đẩy của trình duyệt; endpoint chứa "/gone/" ⇒ 410, "/fail/" ⇒ 500 (dùng cho test).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import webpush from "web-push";
import { withWorker, type Tx } from "./db";
import { env } from "./env";
import { ApiError, viGrouping } from "./errors";
import { recordErrorEvent } from "./ops";
import { safeLink } from "@/lib/notification-link";
import { quietUntil } from "@/lib/push-quiet";

const BATCH = 25;
const CHUNK = 5;
const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 2;
const DISABLE_AFTER_FAILS = 10;
const FAKE_PUBLIC_KEY = "B".padEnd(87, "A");

/** Bộ gửi giả: chỉ khi WF_PUSH_FAKE=1 VÀ không phải production/Vercel (không bao giờ bật nhầm ở môi trường thật). */
export const pushFake = () => process.env.WF_PUSH_FAKE === "1" && !env.isProd && process.env.VERCEL !== "1";
export const fakeFile = () => process.env.WF_PUSH_FAKE_FILE || path.join(os.tmpdir(), "wf-push-fake.jsonl");

export const pushConfigured = () => pushFake() || (!!env.vapidPublicKey && !!env.vapidPrivateKey);
export const pushPublicKey = (): string | null => (env.vapidPublicKey ? env.vapidPublicKey : pushFake() ? FAKE_PUBLIC_KEY : null);

let vapidReady = false;
function setup(): boolean {
  if (pushFake()) return true;
  if (vapidReady) return true;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  try {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    vapidReady = true;
    return true;
  } catch {
    return false; // khóa sai định dạng ⇒ coi như chưa cấu hình
  }
}

/** Nội dung gửi tới thiết bị — chỉ những gì cần hiển thị (không mã người dùng, không email, không dữ liệu khách). */
export type PushPayload = { title: string; body: string; url: string; nid?: string; tag: string };

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type SendResult = { ok: true } | { ok: false; status: number | null };

async function sendOne(sub: Sub, payload: PushPayload): Promise<SendResult> {
  const json = JSON.stringify(payload);
  if (pushFake()) {
    if (sub.endpoint.includes("/gone/")) return { ok: false, status: 410 };
    if (sub.endpoint.includes("/fail/")) return { ok: false, status: 500 };
    fs.appendFileSync(fakeFile(), JSON.stringify({ at: new Date().toISOString(), subscriptionId: sub.id, endpoint: sub.endpoint, payload }) + "\n");
    return { ok: true };
  }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json, { TTL: 60 * 60 * 24, urgency: "normal", timeout: 10_000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, status: (e as { statusCode?: number }).statusCode ?? null };
  }
}

const isGone = (s: number | null) => s === 404 || s === 410;

/** Ghi kết quả gửi tới một thiết bị. Trả true nếu thiết bị bị tắt. */
async function recordDevice(tx: Tx, sub: Sub, r: SendResult) {
  if (r.ok) {
    await tx.q("UPDATE public.push_subscriptions SET last_ok_at = now(), fail_count = 0 WHERE id = $1", [sub.id]);
  } else if (isGone(r.status)) {
    await tx.q("UPDATE public.push_subscriptions SET disabled_at = now() WHERE id = $1 AND disabled_at IS NULL", [sub.id]);
  } else {
    await tx.q(
      `UPDATE public.push_subscriptions SET fail_count = fail_count + 1,
              disabled_at = CASE WHEN fail_count + 1 >= $2 THEN now() ELSE disabled_at END WHERE id = $1`,
      [sub.id, DISABLE_AFTER_FAILS],
    );
  }
}

type Claimed = { id: string; notification_id: string; user_id: string; attempts: number };
type Notif = { id: string; type: string; title: string; body: string | null; link: string | null };
type Prefs = { user_id: string; quiet_enabled: boolean; quiet_start: number; quiet_end: number };

let running = false;

/**
 * Gửi MỘT lượt (tối đa 25 dòng) thông báo đẩy đang chờ. An toàn khi gọi dồn dập (mỗi tiến trình một lượt tại một thời điểm; nhiều tiến trình
 * thì dòng được "mượn chỗ" 2 phút nên không gửi trùng). Trả số dòng đã xử lý (gồm cả dòng hoãn vì giờ yên tĩnh).
 */
export async function dispatchPendingPush(): Promise<number> {
  if (running || !setup()) return 0;
  running = true;
  try {
    const rows = await withWorker((tx) =>
      tx.q<Claimed>(
        `WITH due AS (
           SELECT id FROM public.push_outbox WHERE status = 'queued' AND next_attempt_at <= now()
            ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
         UPDATE public.push_outbox o SET next_attempt_at = now() + make_interval(mins => $2)
           FROM due WHERE o.id = due.id
         RETURNING o.id, o.notification_id, o.user_id, o.attempts`,
        [BATCH, LEASE_MINUTES],
      ),
    );
    if (!rows.length) return 0;
    const nids = rows.map((r) => r.notification_id);
    const uids = [...new Set(rows.map((r) => r.user_id))];
    const [notifs, prefs, subs] = await withWorker(async (tx) => [
      await tx.q<Notif>("SELECT id, type, title, body, link FROM public.notifications WHERE id = ANY($1::uuid[])", [nids]),
      await tx.q<Prefs>("SELECT user_id, quiet_enabled, quiet_start, quiet_end FROM public.push_preferences WHERE user_id = ANY($1::uuid[])", [uids]),
      await tx.q<Sub>("SELECT id, user_id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = ANY($1::uuid[]) AND disabled_at IS NULL", [uids]),
    ] as const);
    const nById = new Map(notifs.map((n) => [n.id, n]));
    const pById = new Map(prefs.map((p) => [p.user_id, p]));
    const now = new Date();

    const handle = async (r: Claimed) => {
      const n = nById.get(r.notification_id);
      const mine = subs.filter((s) => s.user_id === r.user_id);
      if (!n || !mine.length) {
        await withWorker((tx) => tx.q("UPDATE public.push_outbox SET status = 'skipped', last_error = $2 WHERE id = $1", [r.id, n ? "Không có thiết bị" : "Thông báo không còn"]));
        return;
      }
      const p = pById.get(r.user_id);
      const until = p ? quietUntil(now, { enabled: p.quiet_enabled, start: p.quiet_start, end: p.quiet_end }) : null;
      if (until) {
        await withWorker((tx) => tx.q("UPDATE public.push_outbox SET next_attempt_at = $2 WHERE id = $1", [r.id, until.toISOString()]));
        return;
      }
      const payload: PushPayload = {
        title: n.title.slice(0, 120),
        body: viGrouping(n.body ?? "").slice(0, 200),
        url: safeLink(n.link) ?? "/thong-bao",
        nid: n.id,
        tag: n.id,
      };
      const results = await Promise.all(mine.map(async (s) => ({ s, r: await sendOne(s, payload) })));
      const delivered = results.filter((x) => x.r.ok).length;
      const allGone = results.every((x) => !x.r.ok && isGone((x.r as { status: number | null }).status));
      const lastStatus = results.map((x) => (x.r.ok ? null : (x.r as { status: number | null }).status)).filter((x) => x !== null).pop();
      await withWorker(async (tx) => {
        for (const x of results) await recordDevice(tx, x.s, x.r);
        if (delivered > 0) {
          await tx.q("UPDATE public.push_outbox SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1", [r.id]);
        } else if (allGone) {
          await tx.q("UPDATE public.push_outbox SET status = 'skipped', attempts = attempts + 1, last_error = 'Thiết bị đã hủy đăng ký' WHERE id = $1", [r.id]);
        } else if (r.attempts + 1 >= MAX_ATTEMPTS) {
          await tx.q("UPDATE public.push_outbox SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1", [r.id, `HTTP ${lastStatus ?? "?"}`]);
        } else {
          await tx.q(
            "UPDATE public.push_outbox SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + make_interval(mins => $3) WHERE id = $1",
            [r.id, `HTTP ${lastStatus ?? "?"}`, 2 ** (r.attempts + 1)],
          );
        }
      });
    };

    for (let i = 0; i < rows.length; i += CHUNK) await Promise.all(rows.slice(i, i + CHUNK).map(handle));
    return rows.length;
  } catch (e) {
    await recordErrorEvent({ source: "push", code: "dispatch", message: (e as Error).message });
    return 0;
  } finally {
    running = false;
  }
}

const lastTest = new Map<string, number>();

/** "Gửi thử": gửi một tin thử tới MỌI thiết bị đang bật của người dùng (không đi qua hàng đợi, không bị giờ yên tĩnh chặn). Mỗi người 1 lần/10 giây. */
export async function sendTestPush(userId: string): Promise<{ devices: number; sent: number; failed: number }> {
  if (!setup()) throw new ApiError(503, "WF-PUSH-DISABLED", "Máy chủ chưa bật thông báo đẩy (thiếu khóa VAPID).");
  const last = lastTest.get(userId) ?? 0;
  if (Date.now() - last < 10_000) throw new ApiError(429, "WF-RATE-LIMIT", "Bạn vừa gửi thử xong. Hãy đợi vài giây rồi thử lại.");
  const subs = await withWorker((tx) =>
    tx.q<Sub>("SELECT id, user_id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL", [userId]),
  );
  if (!subs.length) throw new ApiError(409, "WF-PUSH-NO-DEVICE", "Chưa có thiết bị nào bật thông báo. Hãy bật thông báo trên thiết bị này trước.");
  lastTest.set(userId, Date.now());
  const payload: PushPayload = { title: "WatchFlow", body: "Thông báo thử: thiết bị này đã nhận được thông báo.", url: "/cai-dat", tag: "test" };
  const results = await Promise.all(subs.map(async (s) => ({ s, r: await sendOne(s, payload) })));
  await withWorker(async (tx) => {
    for (const x of results) await recordDevice(tx, x.s, x.r);
  });
  const sent = results.filter((x) => x.r.ok).length;
  return { devices: subs.length, sent, failed: subs.length - sent };
}

/** Dọn hằng ngày: dòng hàng đợi đã xử lý > 14 ngày; thiết bị đã tắt > 30 ngày. */
export async function cleanupPush(tx: Tx): Promise<string> {
  const a = await tx.q("DELETE FROM public.push_outbox WHERE status <> 'queued' AND created_at < now() - interval '14 days' RETURNING 1");
  const b = await tx.q("DELETE FROM public.push_subscriptions WHERE disabled_at IS NOT NULL AND disabled_at < now() - interval '30 days' RETURNING 1");
  return `outbox ${a.length}, thiết bị ${b.length}`;
}
