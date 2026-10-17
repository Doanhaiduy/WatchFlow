// Hàm thuần theo dõi dung lượng kho lưu trữ (mẫu Lưu Xá src/lib/storage-monitor.ts) — dùng chung máy chủ (job cảnh báo) và giao diện.
export type MonitorLevel = "ok" | "warn" | "critical" | "unknown";
export const DAY_MS = 24 * 3600 * 1000;

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const b = Math.max(0, bytes);
  if (b < 1024) return `${Math.round(b)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(digits)} ${units[i]}`;
}

/** % đã dùng (có thể > 100); null nếu thiếu số liệu hoặc hạn mức <= 0 */
export function percentOf(used: number | null | undefined, limit: number | null | undefined): number | null {
  if (used === null || used === undefined || !limit || limit <= 0) return null;
  return (used / limit) * 100;
}

export function levelOf(percent: number | null, limits: { warnPercent: number; criticalPercent: number }): MonitorLevel {
  if (percent === null || !Number.isFinite(percent)) return "unknown";
  if (percent >= limits.criticalPercent) return "critical";
  if (percent >= limits.warnPercent) return "warn";
  return "ok";
}

export const LEVEL_LABEL: Record<MonitorLevel, string> = { ok: "Ổn", warn: "Cần chú ý", critical: "Sắp đầy", unknown: "Chưa đo được" };

/** Số ngày nữa thì đầy theo tốc độ tăng/ngày. null = không dự báo được (không tăng / thiếu số liệu); 0 = đã đầy. */
export function daysUntilFull(used: number | null, limit: number | null, bytesPerDay: number | null): number | null {
  if (used === null || !limit || limit <= 0) return null;
  if (used >= limit) return 0;
  if (!bytesPerDay || bytesPerDay <= 0) return null;
  return Math.ceil((limit - used) / bytesPerDay);
}

export function formatDaysLeft(days: number | null): string {
  if (days === null) return "chưa đủ dữ liệu để dự báo";
  if (days === 0) return "đã đầy";
  if (days > 365 * 3) return "hơn 3 năm";
  if (days >= 365) return `~${(days / 365).toFixed(1)} năm`;
  if (days >= 60) return `~${Math.round(days / 30)} tháng`;
  return `~${days} ngày`;
}

export type DailyPoint = { day: string; bytes: number; files?: number };

/** Ngày dương lịch (YYYY-MM-DD) → số ngày kể từ epoch, tính theo UTC (không phụ thuộc múi giờ máy). */
const dayNum = (s: string) => Math.floor(Date.parse(s + "T00:00:00Z") / DAY_MS);

/**
 * Tốc độ tăng byte/ngày = tổng byte tải lên trong cửa sổ `windowDays` (tính đến `today`) / số ngày đã có dữ liệu (tối đa windowDays).
 * Ngày đầu tiên có tệp mở đầu khoảng đo; cần ≥ 3 ngày kể từ tệp đầu tiên mới coi là đáng tin (ít hơn ⇒ null).
 */
export function growthPerDay(daily: DailyPoint[], today: string, windowDays = 30): number | null {
  if (!daily.length) return null;
  const t = dayNum(today);
  const inWin = daily.filter((p) => dayNum(p.day) > t - windowDays && dayNum(p.day) <= t);
  if (!inWin.length) return null;
  const first = Math.min(...inWin.map((p) => dayNum(p.day)));
  const span = Math.min(windowDays, t - first + 1);
  if (span < 3) return null;
  return inWin.reduce((a, p) => a + p.bytes, 0) / span;
}

export type StorageUsageRaw = {
  buckets: { bucket: string; files: number; bytes: number }[];
  pending: { files: number; bytes: number };
  purged: { files: number; bytes: number };
  daily: DailyPoint[];
  quotaMb: number;
  warnPercent: number;
  criticalPercent: number;
  today: string;
};

export type StorageSummary = StorageUsageRaw & {
  totalBytes: number;
  totalFiles: number;
  quotaBytes: number;
  percent: number | null;
  level: MonitorLevel;
  bytesPerDay: number | null;
  daysLeft: number | null;
};

/** Gộp số liệu thô từ DB thành tóm tắt hiển thị/cảnh báo. */
export function summarizeStorage(raw: StorageUsageRaw): StorageSummary {
  const totalBytes = raw.buckets.reduce((a, b) => a + b.bytes, 0);
  const totalFiles = raw.buckets.reduce((a, b) => a + b.files, 0);
  const quotaBytes = raw.quotaMb * 1024 * 1024;
  const percent = percentOf(totalBytes, quotaBytes);
  const bytesPerDay = growthPerDay(raw.daily, raw.today);
  return {
    ...raw,
    totalBytes,
    totalFiles,
    quotaBytes,
    percent,
    level: levelOf(percent, raw),
    bytesPerDay,
    daysLeft: daysUntilFull(totalBytes, quotaBytes, bytesPerDay),
  };
}
