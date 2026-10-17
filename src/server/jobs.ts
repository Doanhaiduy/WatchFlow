import "server-only";
// Job định kỳ: mỗi (job, slot) chạy đúng một lần (job_runs unique). Chạy dưới wf_worker.
// Mốc sau đăng ký thêm bước vào DAILY/EVENING (cảnh báo, kiểm bất biến…).
import { withWorker, type Tx } from "./db";
import { dispatchEvents } from "./outbox";
import { registerEventHandlers } from "./event-handlers";
import { recordErrorEvent } from "./ops";
import { todayVn } from "@/lib/dates";
import { purgeStorageFiles, type Bucket } from "./storage";
import { loadStorageSummaryWorker, notifyStorageLevel } from "./storage-monitor";
import { cleanupPush, dispatchPendingPush } from "./push";

export type JobStep = { name: string; run: (tx: Tx) => Promise<string | void> };

export const DAILY: JobStep[] = [
  {
    name: "cleanup",
    run: async (tx) => {
      const a = await tx.q("DELETE FROM public.idempotency_keys WHERE created_at < now() - interval '48 hours' RETURNING 1");
      const b = await tx.q("DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '2 days' RETURNING 1");
      const c = await tx.q("DELETE FROM public.refresh_tokens WHERE expires_at < now() - interval '7 days' RETURNING 1");
      return `idempotency ${a.length}, rate ${b.length}, refresh ${c.length}`;
    },
  },
];

// Dọn tệp đã xóa khỏi kho lưu trữ (PII: ảnh giấy tờ khi ẩn danh khách xóa ngay lượt này; ảnh thường sau storage.purge_after_days).
// Tệp bất biến (purge_after NULL) không bao giờ có trong danh sách. Chỉ chốt purged_at SAU khi kho xác nhận; lỗi từng tệp ⇒ lượt sau thử lại.
DAILY.push({
  name: "storage-purge",
  run: async (tx) => {
    const list = await tx.q<{ id: string; bucket: Bucket; path: string; thumb_path: string | null }>("SELECT id, bucket, path, thumb_path FROM app.fn_storage_purge_candidates(500)");
    if (!list.length) return "0 tệp";
    const done = await purgeStorageFiles(list);
    if (done.length) await tx.q("SELECT app.fn_storage_mark_purged($1::uuid[])", [done]);
    return `đã xóa ${done.length}/${list.length} tệp` + (done.length < list.length ? " (phần còn lại thử lại lượt sau)" : "");
  },
});

// Nhật ký hoạt động (0021): dọn dòng quá activity.retention_days (chỉ qua hàm definer có kiểm — bảng append-only) + thiết bị tin cậy hết hạn/thu hồi > 7 ngày
DAILY.push({
  name: "activity-purge",
  run: async (tx) => {
    const r = await tx.one<{ n: number }>("SELECT app.fn_activity_purge() AS n");
    const t = await tx.q("DELETE FROM public.trusted_devices WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days' RETURNING 1");
    return `activity ${r?.n ?? 0}, thiết bị tin cậy ${t.length}`;
  },
});

// Theo dõi dung lượng kho: vượt ngưỡng ⇒ thông báo trong app cho người có system.health (mỗi mức tối đa một lần/tuần)
DAILY.push({
  name: "storage-monitor",
  run: async (tx) => {
    const s = await loadStorageSummaryWorker(tx);
    const d = todayVn();
    const sent = await notifyStorageLevel(tx, s, `${d.slice(0, 7)}-w${Math.ceil(Number(d.slice(8, 10)) / 7)}`);
    return `${s.percent === null ? "?" : s.percent.toFixed(1)}% (${s.level})${sent ? ", đã báo" : ""}`;
  },
});

// Cảnh báo hằng ngày (M7): giữ hàng/bảo hành quá hạn, nợ đến hạn, máy chưa lấy, linh kiện thấp, tồn lâu, CTV quá hạn → thông báo
DAILY.push({
  name: "alerts",
  run: async (tx) => {
    const r = await tx.one<{ r: Record<string, number> }>("SELECT app.fn_daily_alerts() AS r");
    return Object.entries(r?.r ?? {}).map(([k, v]) => `${k}=${v}`).join(", ");
  },
});

// Dọn hàng đợi thông báo đẩy đã xử lý (>14 ngày) và thiết bị đã tắt (>30 ngày)
DAILY.push({ name: "push-cleanup", run: (tx) => cleanupPush(tx) });

// Buổi tối: kiểm bất biến I1–I12 (integrity §7); lệch ⇒ thông báo chủ + error_events (job vẫn "ok" để không chặn sao lưu)
export const EVENING: JobStep[] = [
  {
    name: "consistency",
    run: async (tx) => {
      const v = await tx.q<{ check_code: string; entity_id: string; detail: string }>("SELECT * FROM app.fn_consistency_check()");
      if (v.length) {
        const codes = [...new Set(v.map((x) => x.check_code))].join(", ");
        await tx.q("SELECT app.fn_notify_permission('system.health', 'system.consistency', $1, $2, '/quan-tri/he-thong', $3)",
          [`Phát hiện ${v.length} sai lệch dữ liệu`, `Kiểm tra bất biến lỗi: ${codes}. Xem chi tiết ở Hệ thống.`, "cons:" + new Date().toISOString().slice(0, 10)]);
        await recordErrorEvent({ source: "consistency", code: codes, message: v.slice(0, 5).map((x) => `${x.check_code} ${x.detail}`).join(" | ") });
      }
      return `${v.length} vi phạm`;
    },
  },
];

registerEventHandlers();

export async function runJob(job: "daily" | "evening", steps: JobStep[], slot = todayVn()): Promise<{ skipped: boolean; notes: string[]; ok: boolean }> {
  const started = await withWorker((tx) =>
    tx.one<{ id: string }>("INSERT INTO public.job_runs (job, slot) VALUES ($1,$2) ON CONFLICT (job, slot) DO NOTHING RETURNING id", [job, slot]),
  );
  if (!started) return { skipped: true, notes: [], ok: true };
  const notes: string[] = [];
  let ok = true;
  for (const s of steps) {
    try {
      const n = await withWorker((tx) => s.run(tx));
      notes.push(`${s.name}: ${n ?? "ok"}`);
    } catch (e) {
      ok = false;
      notes.push(`${s.name}: LỖI`);
      await recordErrorEvent({ source: "job", route: `${job}/${s.name}`, message: (e as Error).message });
    }
  }
  const d = await dispatchEvents().catch(() => ({ processed: 0, failed: 1 }));
  notes.push(`events ${d.processed}/${d.failed} lỗi`);
  notes.push(`push ${await dispatchPendingPush().catch(() => 0)}`);
  await withWorker((tx) =>
    tx.q("UPDATE public.job_runs SET finished_at = now(), status = $2, note = $3 WHERE id = $1", [started.id, ok ? "ok" : "failed", notes.join("; ").slice(0, 2000)]),
  );
  return { skipped: false, notes, ok };
}
