"use client";
import { RefreshCw } from "lucide-react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { formatBytes, formatDaysLeft, LEVEL_LABEL, type MonitorLevel, type StorageSummary } from "@/lib/storage-monitor";

type Check = { ok: boolean; ms?: number; note?: string };
type Res = {
  health: { ok: boolean; version: string; checks: Record<string, Check> };
  jobs: Array<{ job: string; slot: string | null; status: string; startedAt: string; finishedAt: string | null; note: string | null }>;
  errors: Array<{ code: string | null; route: string | null; message: string; count: number; lastSeen: string }>;
  backups: Array<{ kind: string; at: string; ok: boolean; note: string | null }>;
};

const CHECK_LABEL: Record<string, string> = { db: "Cơ sở dữ liệu", migrations: "Phiên bản dữ liệu", backup: "Sao lưu", storage: "Lưu trữ ảnh", jobs: "Tác vụ nền", outbox: "Hàng đợi sự kiện" };
const JOB_LABEL: Record<string, string> = { ok: "Thành công", success: "Thành công", done: "Xong", running: "Đang chạy", skipped: "Bỏ qua", failed: "Lỗi", error: "Lỗi" };
const JOB_TONE = (s: string) => (s === "ok" || s === "success" || s === "done" ? "ok" : s === "running" ? "info" : s === "skipped" ? "neutral" : "bad");

const BUCKET_LABEL: Record<string, string> = { "unit-photos": "Ảnh đồng hồ", "repair-photos": "Ảnh nhận máy sửa chữa", documents: "Giấy tờ & chứng từ", branding: "Logo cửa hàng" };
const LEVEL_TONE: Record<MonitorLevel, "ok" | "hold" | "bad" | "neutral"> = { ok: "ok", warn: "hold", critical: "bad", unknown: "neutral" };
const LEVEL_COLOR: Record<MonitorLevel, string> = { ok: "var(--wf-ok)", warn: "var(--wf-hold)", critical: "var(--wf-bad)", unknown: "var(--wf-mute)" };

/** Dung lượng kho lưu trữ (ảnh/giấy tờ): đã dùng so với hạn mức, tăng trưởng/ngày, ước tính ngày đầy; cần system.health */
function StorageSection() {
  const { data, error, isLoading } = useSWR<StorageSummary>("/api/v1/system/storage", swrFetcher, { refreshInterval: 120_000 });
  if (isLoading) return <SkeletonList rows={3} />;
  if (error || !data) return <div className="g wf-pad"><ErrorState description={errMsg(error)} /></div>;
  const pct = data.percent ?? 0;
  return (
    <section aria-label="Dung lượng lưu trữ">
      <div className="wf-sec"><h3>Dung lượng lưu trữ</h3><span className="wf-mute">{data.totalFiles} tệp</span></div>
      <div className="g wf-pad">
        <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <b className="wf-num">{formatBytes(data.totalBytes)} / {formatBytes(data.quotaBytes, 0)}{data.percent !== null ? ` (${pct.toFixed(1)}%)` : ""}</b>
          <StatusChip tone={LEVEL_TONE[data.level]}>{LEVEL_LABEL[data.level]}</StatusChip>
        </div>
        <div role="progressbar" aria-label="Dung lượng đã dùng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} style={{ height: 10, borderRadius: 999, background: "var(--wf-line)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: LEVEL_COLOR[data.level], borderRadius: 999 }} />
        </div>
        <KeyValue
          items={[
            { label: "Tăng trưởng trung bình", value: data.bytesPerDay === null ? "chưa đủ dữ liệu" : `${formatBytes(data.bytesPerDay)}/ngày` },
            { label: "Ước tính đầy sau", value: formatDaysLeft(data.daysLeft) },
            { label: "Ngưỡng cảnh báo / khẩn", value: `${data.warnPercent}% / ${data.criticalPercent}%` },
            { label: "Chờ xóa thật", value: `${data.pending.files} tệp · ${formatBytes(data.pending.bytes)}` },
            { label: "Đã xóa thật khỏi kho", value: `${data.purged.files} tệp · ${formatBytes(data.purged.bytes)}` },
          ]}
        />
        {data.level !== "ok" && data.level !== "unknown" && (
          <p className="wf-mute" style={{ marginTop: 10 }}>
            Kho sắp đầy: xóa ảnh cũ không còn cần, hoặc nâng gói lưu trữ / tăng hạn mức ở Cài đặt (storage.quota_mb). Ảnh giấy tờ của khách đã ẩn danh được xóa thật ở lượt tác vụ nền kế tiếp.
          </p>
        )}
      </div>
      {data.buckets.length > 0 && (
        <InsetList label="Dung lượng theo nhóm">
          {data.buckets.map((b) => (
            <InsetRow key={b.bucket} title={BUCKET_LABEL[b.bucket] ?? b.bucket} subtitle={`${b.files} tệp`} end={formatBytes(b.bytes)} />
          ))}
        </InsetList>
      )}
    </section>
  );
}

export default function SystemPage() {
  const { can } = useSession();
  const { data, error, isLoading, mutate, isValidating } = useSWR<Res>("/api/v1/system/status", swrFetcher, { refreshInterval: 30_000 });
  const lastBackup = data?.backups.find((b) => b.ok);

  return (
    <>
      <PageHeader
        title="Hệ thống & sao lưu"
        description="Tình trạng máy chủ, sao lưu và tác vụ nền"
        actions={<Button sm loading={isValidating && !isLoading} icon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => void mutate()}>Làm mới</Button>}
      />
      <RequirePerm perm={["system.health", "system.backup"]}>
        <AdminTabs />
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : error || !data ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            <section className="g wf-pad" aria-label="Sức khỏe">
              <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Sức khỏe</h2>
                <StatusChip tone={data.health.ok ? "ok" : "bad"}>{data.health.ok ? "Bình thường" : "Có vấn đề"}</StatusChip>
              </div>
              <KeyValue
                items={[
                  { label: "Phiên bản", value: data.health.version },
                  ...Object.entries(data.health.checks).map(([k, c]) => ({
                    label: CHECK_LABEL[k] ?? k,
                    value: (
                      <span className="wf-dev-row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        {c.note && <span className="wf-mute" style={{ fontWeight: 400 }}>{c.note}</span>}
                        {c.ms !== undefined && <span className="wf-mute wf-num" style={{ fontWeight: 400 }}>{c.ms} ms</span>}
                        <StatusChip tone={c.ok ? "ok" : "bad"}>{c.ok ? "Tốt" : "Lỗi"}</StatusChip>
                      </span>
                    ),
                  })),
                ]}
              />
            </section>

            {can("system.health") && <StorageSection />}

            <section aria-label="Sao lưu">
              <div className="wf-sec"><h3>Sao lưu</h3><span className="wf-mute">{lastBackup ? `Gần nhất ${formatDateTimeVn(lastBackup.at)}` : "Chưa có bản sao lưu thành công"}</span></div>
              {data.backups.length === 0 ? (
                <div className="g wf-pad"><EmptyState title="Chưa có nhật ký sao lưu" description="Tác vụ sao lưu tự ghi lại mỗi lần chạy." /></div>
              ) : (
                <InsetList label="Lần sao lưu gần đây">
                  {data.backups.map((b, i) => (
                    <InsetRow key={i} title={b.kind} subtitle={b.note ?? formatDateTimeVn(b.at)} end={<StatusChip tone={b.ok ? "ok" : "bad"}>{b.ok ? "Thành công" : "Thất bại"}</StatusChip>} endSub={b.note ? formatDateTimeVn(b.at) : undefined} />
                  ))}
                </InsetList>
              )}
            </section>

            <section aria-label="Tác vụ nền">
              <div className="wf-sec"><h3>Tác vụ nền</h3></div>
              {data.jobs.length === 0 ? (
                <div className="g wf-pad"><EmptyState title="Chưa có tác vụ nào chạy" /></div>
              ) : (
                <InsetList label="Tác vụ nền gần đây">
                  {data.jobs.map((j, i) => (
                    <InsetRow key={i} title={j.job} subtitle={`${formatDateTimeVn(j.startedAt)}${j.note ? ` · ${j.note}` : ""}`} end={<StatusChip tone={JOB_TONE(j.status)}>{JOB_LABEL[j.status] ?? j.status}</StatusChip>} />
                  ))}
                </InsetList>
              )}
            </section>

            <section aria-label="Lỗi gần đây">
              <div className="wf-sec"><h3>Lỗi gần đây</h3></div>
              {data.errors.length === 0 ? (
                <div className="g wf-pad"><EmptyState title="Không có lỗi nào được ghi" description="Hệ thống chưa gặp lỗi cần chú ý." /></div>
              ) : (
                <InsetList label="Lỗi gần đây">
                  {data.errors.map((e, i) => (
                    <InsetRow key={i} tone="bad" icon={<span aria-hidden="true">!</span>} title={e.message} subtitle={`${e.code ?? "—"} · ${e.route ?? "—"} · ${formatDateTimeVn(e.lastSeen)}`} end={`×${e.count}`} />
                  ))}
                </InsetList>
              )}
            </section>
          </div>
        )}
      </RequirePerm>
    </>
  );
}
