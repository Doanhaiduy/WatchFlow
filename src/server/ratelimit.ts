import "server-only";
// Giới hạn tốc độ (security-model §7). Nhóm nhạy cảm (auth, xuất file, tải ảnh) lưu DB (rate_limit_hits, khóa băm — không lưu IP thô).
// Giới hạn chung 300/phút/người đếm trong bộ nhớ từng instance (đủ chống vòng lặp lỗi; CONFIRM CQ-004).
import crypto from "node:crypto";
import { withWorker } from "./db";
import { ApiError } from "./errors";
import { env } from "./env";

export const LIMITS = {
  authIp: { limit: 10, windowSec: 15 * 60 },
  authAccount: { limit: 10, windowSec: 15 * 60 },
  export: { limit: 5, windowSec: 3600 },
  upload: { limit: 30, windowSec: 60 },
  // Lỗi trình duyệt báo về (public/client-error): theo ipHash 30/phút + trần toàn hệ thống 600/giờ (chống đổ rác nhật ký)
  clientError: { limit: 30, windowSec: 60 },
  clientErrorAll: { limit: 600, windowSec: 3600 },
  general: { limit: 300, windowSec: 60 },
} as const;

function keyHash(bucket: string, key: string) {
  return crypto.createHmac("sha256", env.rateLimitPepper).update(bucket + ":" + key).digest("hex").slice(0, 40);
}

function windowOf(bucket: keyof typeof LIMITS): { now: number; win: string } {
  const { windowSec } = LIMITS[bucket];
  const now = Math.floor(Date.now() / 1000);
  return { now, win: new Date((now - (now % windowSec)) * 1000).toISOString() };
}

async function bump(bucket: keyof typeof LIMITS, key: string, win: string): Promise<number> {
  const r = await withWorker((tx) =>
    tx.one<{ count: number }>(
      `INSERT INTO public.rate_limit_hits (key_hash, window_start, count) VALUES ($1,$2,1)
       ON CONFLICT (key_hash, window_start) DO UPDATE SET count = public.rate_limit_hits.count + 1 RETURNING count`,
      [keyHash(bucket, key), win],
    ),
  );
  return r?.count ?? 0;
}

/** Đếm +1 và ném WF-RATE-LIMIT nếu vượt. */
export async function hitDb(bucket: keyof typeof LIMITS, key: string): Promise<void> {
  const { limit, windowSec } = LIMITS[bucket];
  const { now, win } = windowOf(bucket);
  if ((await bump(bucket, key, win)) > limit) {
    const retry = windowSec - (now % windowSec);
    throw new ApiError(429, "WF-RATE-LIMIT", `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retry / 60)} phút.`, undefined, {
      "Retry-After": String(retry),
    });
  }
}

type Slot = { bucket: keyof typeof LIMITS; key: string; win: string };

/** Trả lại đúng lượt đã giữ (cùng cửa sổ lúc giữ; không xuống dưới 0). */
async function release(slot: Slot): Promise<void> {
  await withWorker((tx) =>
    tx.q("UPDATE public.rate_limit_hits SET count = greatest(count - 1, 0) WHERE key_hash=$1 AND window_start=$2", [keyHash(slot.bucket, slot.key), slot.win]),
  );
}

/**
 * Chạy fn; chỉ tính lần SAI (mật khẩu/mã sai). Chống đua: giữ chỗ +1 ở mọi bucket TRƯỚC khi chạy (nguyên tử; vượt ⇒ 429),
 * rồi trả lại đúng chỗ đã giữ nếu kết quả không phải lần sai — N yêu cầu song song không lách được ngưỡng.
 */
export async function limitFailures<T>(
  buckets: [keyof typeof LIMITS, string][],
  failCodes: string[],
  fn: () => Promise<T>,
  message = "Nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
): Promise<T> {
  const held: Slot[] = [];
  let over = false;
  for (const [bucket, key] of buckets) {
    const { win } = windowOf(bucket);
    const n = await bump(bucket, key, win); // lỗi kết nối ⇒ ném luôn, chỉ trả lại các chỗ đã giữ chắc chắn
    held.push({ bucket, key, win });
    if (n > LIMITS[bucket].limit) over = true;
  }
  let failed = false;
  try {
    if (over) throw new ApiError(429, "WF-RATE-LIMIT", message, undefined, { "Retry-After": "900" });
    return await fn();
  } catch (e) {
    failed = e instanceof ApiError && failCodes.includes(e.code);
    throw e;
  } finally {
    if (!failed) await Promise.all(held.map((h) => release(h).catch(() => {})));
  }
}

const mem = new Map<string, { win: number; n: number }>();
export function hitMemory(key: string): void {
  const { limit, windowSec } = LIMITS.general;
  const w = Math.floor(Date.now() / 1000 / windowSec);
  const cur = mem.get(key);
  if (!cur || cur.win !== w) {
    mem.set(key, { win: w, n: 1 });
    if (mem.size > 5000) mem.clear();
    return;
  }
  cur.n++;
  if (cur.n > limit) throw new ApiError(429, "WF-RATE-LIMIT", "Bạn thao tác quá nhanh. Vui lòng chờ một chút.", undefined, { "Retry-After": "30" });
}
