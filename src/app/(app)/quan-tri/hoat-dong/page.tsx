"use client";
// Quản trị → Hoạt động: ai làm gì, lúc nào, từ đâu (activity_logs, ghi sau phản hồi) + lịch sử đăng nhập (đọc lại audit_logs auth.*).
// Chỉ audit.view. Không có nội dung gửi lên/giá trị tham số: chỉ route mẫu + nhãn tiếng Việt. Điện thoại: mỗi dòng là một thẻ.
import { Activity, CheckCircle2, FileClock, LogIn, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateRange } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, swrFetcher } from "@/lib/api-client";
import { ACTIVITY_AREAS } from "@/lib/activity-labels";
import { addDays, formatDateTimeVn, todayVn } from "@/lib/dates";
import type { ActivityItem, ActivityPage, ActivityUser, LoginItem } from "@/server/activity";

type Tab = "actions" | "logins";

/** Tải theo con trỏ: đổi bộ lọc ⇒ tải lại từ đầu; "Xem thêm" nối trang kế. */
function usePaged<T>(path: string, qs: string | null) {
  const key = qs === null ? null : `${path}?${qs}`;
  const first = useSWR<ActivityPage<T>>(key, swrFetcher, { keepPreviousData: true });
  const [extra, setExtra] = useState<{ key: string; items: T[]; next: string | null } | null>(null);
  const [more, setMore] = useState(false);
  const [moreErr, setMoreErr] = useState<string | null>(null);
  useEffect(() => { setExtra(null); setMoreErr(null); }, [key]);
  const cont = extra && key && extra.key === key ? extra : null;
  const items = [...(first.data?.items ?? []), ...(cont?.items ?? [])];
  const next = cont ? cont.next : (first.data?.next ?? null);
  const loadMore = async () => {
    if (!next || !qs) return;
    setMore(true);
    setMoreErr(null);
    try {
      const page = await api<ActivityPage<T>>(`${path}?${qs}&before=${encodeURIComponent(next)}`);
      setExtra({ key: key!, items: [...(cont?.items ?? []), ...page.items], next: page.next });
    } catch (e) {
      setMoreErr(errMsg(e));
    } finally {
      setMore(false);
    }
  };
  return { items, next, loading: first.isLoading, error: first.error, reload: first.mutate, more, moreErr, loadMore };
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>("actions");
  const [to, setTo] = useState(todayVn());
  const [from, setFrom] = useState(addDays(todayVn(), -6));
  const [userId, setUserId] = useState("");
  const [area, setArea] = useState("");
  const [result, setResult] = useState("all");
  const [sensitive, setSensitive] = useState(false);

  const range = new URLSearchParams({ from, to });
  const users = useSWR<{ items: ActivityUser[] }>(`/api/v1/activity/users?${range}`, swrFetcher);
  const qs = new URLSearchParams({ from, to, limit: "40" });
  if (userId) qs.set("userId", userId);
  if (result !== "all") qs.set("result", result);
  if (tab === "actions") {
    if (area) qs.set("area", area);
    if (sensitive) qs.set("sensitive", "1");
  }
  const actions = usePaged<ActivityItem>("/api/v1/activity", tab === "actions" ? qs.toString() : null);
  const logins = usePaged<LoginItem>("/api/v1/activity/logins", tab === "logins" ? qs.toString() : null);
  const cur = tab === "actions" ? actions : logins;
  const filtered = !!(userId || area || sensitive || result !== "all");
  const clear = () => { setUserId(""); setArea(""); setSensitive(false); setResult("all"); };

  const rows = cur.items as Array<ActivityItem | LoginItem>;
  let lastDay = "";

  return (
    <>
      <PageHeader title="Hoạt động người dùng" description="Ai đã làm gì, lúc nào, từ máy nào — không ghi nội dung gửi lên, không sửa được" />
      <RequirePerm perm="audit.view">
        <AdminTabs />
        <div style={{ marginBottom: 10 }}>
          <SegmentedControl<Tab>
            ariaLabel="Loại nhật ký"
            options={[{ value: "actions", label: "Thao tác" }, { value: "logins", label: "Đăng nhập" }]}
            value={tab}
            onChange={setTab}
          />
        </div>

        <div className="g wf-pad" style={{ marginBottom: 12 }}>
          <div className="wf-dev-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 0 }}>
            <Field label="Khoảng ngày">
              <DateRange from={from} to={to} onChange={(r) => { setFrom(r.from); setTo(r.to); }} max={todayVn()} />
            </Field>
            <Field label="Người dùng">
              <Select
                placeholder="Mọi người"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                options={(users.data?.items ?? []).map((u) => ({ value: u.userId, label: u.name, sublabel: `${u.total} thao tác${u.errors ? ` · ${u.errors} lỗi` : ""}` }))}
              />
            </Field>
            {tab === "actions" && (
              <Field label="Khu vực">
                <Select placeholder="Mọi khu vực" value={area} onChange={(e) => setArea(e.target.value)} options={Object.entries(ACTIVITY_AREAS).map(([value, label]) => ({ value, label }))} />
              </Field>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <FilterChips
              ariaLabel="Kết quả"
              value={[result]}
              onChange={(v) => setResult(v[0] ?? "all")}
              options={[{ value: "all", label: "Tất cả" }, { value: "ok", label: tab === "actions" ? "Thành công" : "Bình thường" }, { value: "error", label: tab === "actions" ? "Lỗi / bị từ chối" : "Thất bại / đáng ngờ" }]}
            />
          </div>
          {tab === "actions" && (
            <Checkbox checked={sensitive} onChange={setSensitive} label="Chỉ sự kiện nhạy cảm (xuất Excel, in, xem giá vốn / CCCD / báo cáo)" />
          )}
          {filtered && (
            <div className="wf-dev-row" style={{ marginTop: 6 }}>
              <Button sm onClick={clear}>Bỏ lọc</Button>
            </div>
          )}
        </div>

        {cur.loading ? (
          <SkeletonList rows={6} />
        ) : cur.error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(cur.error)} onRetry={async () => (await cur.reload()) !== undefined} /></div>
        ) : rows.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={filtered ? "search" : "plain"} title={filtered ? "Không có bản ghi khớp bộ lọc" : "Chưa có hoạt động nào trong khoảng này"} description={filtered ? "Thử bỏ bớt điều kiện lọc hoặc mở rộng khoảng ngày." : undefined} icon={<FileClock size={24} aria-hidden="true" />} />
          </div>
        ) : (
          <>
            <ul className="wf-ig g g-flat" aria-label={tab === "actions" ? "Thao tác của người dùng" : "Lịch sử đăng nhập"} style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {rows.map((r) => {
                const day = dayLabel(r.at);
                const head = day !== lastDay;
                lastDay = day;
                return (
                  <li key={r.id} style={{ listStyle: "none" }}>
                    {head && <p className="wf-dev-cap" style={{ margin: "10px 14px 2px", textTransform: "capitalize" }}>{day}</p>}
                    {tab === "actions" ? <ActionRow r={r as ActivityItem} /> : <LoginRow r={r as LoginItem} />}
                  </li>
                );
              })}
            </ul>
            {cur.next && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Button loading={cur.more} onClick={() => void cur.loadMore()}>Xem thêm</Button>
              </div>
            )}
            {cur.moreErr && <p role="alert" className="wf-mute" style={{ textAlign: "center", marginTop: 8 }}>{cur.moreErr}</p>}
          </>
        )}
      </RequirePerm>
    </>
  );
}

const timeOf = (iso: string) => formatDateTimeVn(iso).replace(/^.*?(\d{1,2}:\d{2}.*)$/, "$1");

function ActionRow({ r }: { r: ActivityItem }) {
  const bits = [timeOf(r.at), r.userName, r.areaLabel, r.ipTag ? `máy #${r.ipTag}` : null, r.durationMs !== null ? `${r.durationMs} ms` : null].filter(Boolean).join(" · ");
  return (
    <div className="wf-ir" role="presentation" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <span className="wf-ib" data-tone={r.ok ? (r.action ? "hold" : "ok") : "bad"} aria-hidden="true">
        {r.ok ? r.action ? <ShieldAlert size={20} /> : <Activity size={20} /> : <XCircle size={20} />}
      </span>
      <span className="wf-irm" style={{ minWidth: 0, flex: "1 1 220px" }}>
        <b style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{r.label}</b>
        <span style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{bits}</span>
        {r.entityId && <span className="wf-mute" style={{ fontSize: 11.5 }} title={r.entityId}>Đối tượng #{r.entityId.slice(0, 8)}</span>}
      </span>
      <span className="wf-ire" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {r.actionLabel && <StatusChip tone="hold">{r.actionLabel}</StatusChip>}
        <StatusChip tone={r.ok ? "ok" : "bad"}>{r.ok ? r.status : `${r.status}${r.errorCode ? ` · ${r.errorCode}` : ""}`}</StatusChip>
      </span>
    </div>
  );
}

function LoginRow({ r }: { r: LoginItem }) {
  return (
    <InsetRow
      icon={r.tone === "bad" ? <XCircle size={20} aria-hidden="true" /> : r.tone === "ok" ? <CheckCircle2 size={20} aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
      tone={r.tone === "bad" ? "bad" : r.tone === "ok" ? "ok" : r.tone === "hold" ? "hold" : "info"}
      title={r.label}
      subtitle={[timeOf(r.at), r.userName, r.actorName ? `do ${r.actorName}` : null, r.ipTag ? `máy #${r.ipTag}` : null].filter(Boolean).join(" · ")}
    />
  );
}
