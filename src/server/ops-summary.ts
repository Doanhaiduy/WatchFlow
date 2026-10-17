import "server-only";
// Tóm tắt vận hành cho dải cảnh báo (FR-NAV-03): cron quá hạn/lỗi, sao lưu lỗi/quá hạn, lỗi hệ thống mới, dung lượng lưu trữ.
// Chỉ gọi cho người có system.health (route kiểm quyền; các bảng nguồn cũng có RLS system.health). Không trả PII/chuỗi lỗi chi tiết —
// chỉ tiêu đề ngắn; chi tiết xem ở Quản trị → Hệ thống.
import type { Tx } from "./db";
import { loadStorageSummary } from "./storage-monitor";

export type OpsIssue = { key: string; level: "error" | "warn"; title: string };
export type OpsSummary = { level: "ok" | "warn" | "error"; issues: OpsIssue[]; checkedAt: string };

const JOB_LABEL: Record<string, string> = { daily: "buổi sáng", evening: "buổi tối" };
/** Job chạy mỗi ngày một lần: quá 36 giờ chưa có lượt mới = quá hạn */
const JOB_MAX_HOURS = 36;

export async function loadOpsSummary(tx: Tx): Promise<OpsSummary> {
  const issues: OpsIssue[] = [];

  // Cron: chỉ cảnh báo khi job ĐÃ TỪNG chạy (máy mới/local chưa có cron không bị báo đỏ oan)
  const jobs = await tx.q<{ job: string; status: string; started_at: string; age_h: number }>(
    `SELECT DISTINCT ON (job) job, status, started_at::text, extract(epoch FROM (now() - started_at)) / 3600 AS age_h
     FROM public.job_runs ORDER BY job, started_at DESC`,
  );
  for (const j of jobs) {
    const label = JOB_LABEL[j.job] ?? j.job;
    if (j.status === "failed") issues.push({ key: `job_failed_${j.job}`, level: "error", title: `Job ${label} chạy lỗi ở lượt gần nhất` });
    else if (j.status === "running" && Number(j.age_h) > 1) issues.push({ key: `job_stuck_${j.job}`, level: "error", title: `Job ${label} không chạy xong` });
    else if (Number(j.age_h) > JOB_MAX_HOURS) issues.push({ key: `job_overdue_${j.job}`, level: "error", title: `Job ${label} quá hạn, chưa chạy ${Math.floor(Number(j.age_h))} giờ` });
  }

  // Sao lưu: nhịp tim gần nhất lỗi hoặc quá hạn (nếu bắt buộc, thiếu nhịp tim cũng là lỗi)
  const hb = await tx.one<{ ok: boolean; age_h: number }>(
    `SELECT ok, extract(epoch FROM (now() - at)) / 3600 AS age_h FROM public.ops_heartbeats WHERE kind = 'backup' ORDER BY at DESC LIMIT 1`,
  );
  const maxH = (await tx.one<{ v: number }>("SELECT app.setting_int('backup.heartbeat_max_hours', 36) AS v"))?.v ?? 36;
  if (hb) {
    if (!hb.ok) issues.push({ key: "backup_failed", level: "error", title: "Bản sao lưu gần nhất thất bại" });
    else if (Number(hb.age_h) > maxH) issues.push({ key: "backup_overdue", level: "error", title: `Chưa có bản sao lưu mới ${Math.floor(Number(hb.age_h))} giờ` });
  } else if (process.env.OPS_REQUIRE_BACKUP_HEARTBEAT === "1") {
    issues.push({ key: "backup_missing", level: "error", title: "Chưa có bản sao lưu nào được ghi nhận" });
  }

  // Lỗi hệ thống mới trong 24 giờ qua (vàng)
  const err = await tx.one<{ n: number }>("SELECT count(*)::int AS n FROM public.error_events WHERE last_seen > now() - interval '24 hours'");
  if ((err?.n ?? 0) > 0) issues.push({ key: "errors_new", level: "warn", title: `${err!.n} lỗi hệ thống mới trong 24 giờ qua` });

  // Dung lượng lưu trữ
  try {
    const s = await loadStorageSummary(tx);
    if (s.level === "critical") issues.push({ key: "storage_critical", level: "error", title: `Kho ảnh sắp đầy (${s.percent === null ? "?" : s.percent.toFixed(0)}%)` });
    else if (s.level === "warn") issues.push({ key: "storage_warn", level: "warn", title: `Kho ảnh đã dùng ${s.percent === null ? "?" : s.percent.toFixed(0)}% hạn mức` });
  } catch {
    /* không đo được dung lượng thì bỏ qua — không làm hỏng dải cảnh báo */
  }

  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  const level = issues.some((i) => i.level === "error") ? "error" : issues.length ? "warn" : "ok";
  return { level, issues, checkedAt: new Date().toISOString() };
}
