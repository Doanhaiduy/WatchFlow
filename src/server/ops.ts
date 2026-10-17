import "server-only";
// Vận hành: ghi lỗi gộp (error_events), kiểm tra sức khỏe (/api/health), nhịp tim sao lưu.
import crypto from "node:crypto";
import { pool, withWorker } from "./db";

/** Ghi lỗi gộp theo dấu vân tay; không bao giờ ghi PII (chỉ mã + câu kỹ thuật đã cắt). */
export async function recordErrorEvent(e: { source: string; route?: string; code?: string; message?: string; requestId?: string; appVersion?: string }) {
  const msg = (e.message ?? "").replace(/\d{9,12}/g, "#").slice(0, 500);
  const fp = crypto.createHash("sha1").update([e.source, e.route, e.code, msg.slice(0, 120)].join("|")).digest("hex");
  try {
    await withWorker((tx) =>
      tx.q(
        `INSERT INTO public.error_events (fingerprint, source, route, code, message, request_id, app_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (fingerprint) DO UPDATE SET count = public.error_events.count + 1, last_seen = now(), request_id = EXCLUDED.request_id,
                                                  app_version = COALESCE(EXCLUDED.app_version, public.error_events.app_version)`,
        [fp, e.source, e.route ?? null, e.code ?? null, msg, e.requestId ?? null, e.appVersion?.slice(0, 32) ?? null],
      ),
    );
  } catch {
    /* không để lỗi ghi log làm hỏng request */
  }
}

export type HealthReport = {
  ok: boolean;
  version: string;
  time: string;
  checks: Record<string, { ok: boolean; ms?: number; note?: string }>;
};

export async function health(deep: boolean): Promise<HealthReport> {
  const checks: HealthReport["checks"] = {};
  const t0 = Date.now();
  try {
    const c = await pool().connect();
    try {
      await c.query("SELECT 1");
      checks.db = { ok: true, ms: Date.now() - t0 };
    } finally {
      c.release();
    }
  } catch {
    checks.db = { ok: false, ms: Date.now() - t0, note: "Không kết nối được cơ sở dữ liệu" };
  }
  if (deep && checks.db?.ok) {
    try {
      const r = await withWorker(async (tx) => {
        const mig = await tx.one<{ n: number; last: string }>("SELECT count(*)::int n, max(name) last FROM public.app_migrations");
        const hb = await tx.one<{ at: string | null }>("SELECT max(at)::text at FROM public.ops_heartbeats WHERE kind='backup' AND ok");
        const maxH = await tx.one<{ v: number }>("SELECT app.setting_int('backup.heartbeat_max_hours', 36) v");
        const jobs = await tx.one<{ failed: number }>("SELECT count(*)::int failed FROM public.job_runs WHERE status='failed' AND started_at > now() - interval '2 days'");
        const pend = await tx.one<{ n: number }>("SELECT count(*)::int n FROM public.domain_events WHERE processed_at IS NULL AND available_at < now() - interval '1 hour'");
        return { mig, hb, maxH: maxH?.v ?? 36, jobs, pend };
      });
      checks.migrations = { ok: (r.mig?.n ?? 0) > 0, note: r.mig?.last };
      const ageH = r.hb?.at ? (Date.now() - new Date(r.hb.at).getTime()) / 3_600_000 : null;
      const requireHb = process.env.OPS_REQUIRE_BACKUP_HEARTBEAT === "1";
      checks.backup = ageH === null
        ? { ok: !requireHb, note: "Chưa có nhịp tim sao lưu" }
        : { ok: ageH <= r.maxH, note: `Bản sao lưu gần nhất ${ageH.toFixed(1)} giờ trước` };
      checks.jobs = { ok: (r.jobs?.failed ?? 0) === 0, note: `${r.jobs?.failed ?? 0} job lỗi trong 2 ngày` };
      checks.outbox = { ok: (r.pend?.n ?? 0) < 100, note: `${r.pend?.n ?? 0} sự kiện tồn > 1 giờ` };
    } catch {
      checks.deep = { ok: false, note: "Kiểm tra sâu thất bại" };
    }
  }
  return {
    ok: Object.values(checks).every((c) => c.ok),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    time: new Date().toISOString(),
    checks,
  };
}
