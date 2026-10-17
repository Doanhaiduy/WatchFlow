import "server-only";
// Theo dõi dung lượng kho lưu trữ: số liệu từ bảng files (DB), không gọi Storage. Dùng cho API hệ thống và job cảnh báo.
import type { Tx } from "./db";
import { summarizeStorage, formatBytes, formatDaysLeft, type StorageSummary, type StorageUsageRaw } from "@/lib/storage-monitor";

/** Người dùng có system.health (kiểm quyền trong hàm DB) */
export async function loadStorageSummary(tx: Tx): Promise<StorageSummary> {
  const r = await tx.one<{ r: StorageUsageRaw }>("SELECT app.fn_storage_usage() AS r");
  return summarizeStorage(r!.r);
}

/** Job (wf_worker, không có người dùng) */
export async function loadStorageSummaryWorker(tx: Tx): Promise<StorageSummary> {
  const r = await tx.one<{ r: StorageUsageRaw }>("SELECT app.fn_storage_usage_raw() AS r");
  return summarizeStorage(r!.r);
}

/** Cảnh báo trong app cho người có system.health khi vượt ngưỡng; mỗi mức nhắc tối đa một lần/tuần (dedupe). Trả true nếu có gửi. */
export async function notifyStorageLevel(tx: Tx, s: StorageSummary, weekKey: string): Promise<boolean> {
  if (s.level !== "warn" && s.level !== "critical") return false;
  const pct = s.percent === null ? "?" : s.percent.toFixed(0);
  const title = s.level === "critical" ? `Kho ảnh sắp đầy (${pct}%)` : `Kho ảnh đã dùng ${pct}% hạn mức`;
  const body = `Đã dùng ${formatBytes(s.totalBytes)} / ${formatBytes(s.quotaBytes, 0)}; dự báo đầy sau ${formatDaysLeft(s.daysLeft)}. Xem Hệ thống để biết cách xử lý.`;
  await tx.q("SELECT app.fn_notify_permission('system.health', 'system.storage', $1, $2, '/quan-tri/he-thong', $3)", [title, body, `storage:${s.level}:${weekKey}`]);
  return true;
}
