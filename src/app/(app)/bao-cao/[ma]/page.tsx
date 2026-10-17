"use client";
import { Download, Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { byCode } from "@/components/reports/meta";
import { ReportTable } from "@/components/reports/ReportTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { DateRange } from "@/components/ui/DateInput";
import { Select, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, swrFetcher } from "@/lib/api-client";
import { addDays, formatDateVn, todayVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { ShieldOff } from "lucide-react";

type Res = { code: string; title: string; from: string; to: string; generatedAt: string; data: unknown };
type Preset = "7" | "30" | "month" | "quarter" | "year" | "custom";

function presetRange(p: Preset, today: string): [string, string] {
  const y = today.slice(0, 4), m = Number(today.slice(5, 7));
  if (p === "7") return [addDays(today, -6), today];
  if (p === "month") return [`${today.slice(0, 7)}-01`, today];
  if (p === "quarter") return [`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`, today];
  if (p === "year") return [`${y}-01-01`, today];
  return [addDays(today, -29), today];
}

export default function ReportPage() {
  const { ma } = useParams<{ ma: string }>();
  const meta = byCode(ma);
  const { can } = useSession();
  const toast = useToast();
  const today = todayVn();
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState("day");
  const [days, setDays] = useState("");
  const [exporting, setExporting] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (meta?.dates || meta?.group) { p.set("from", from); p.set("to", to); }
    if (meta?.group) p.set("group", group);
    if (meta?.days && days) p.set("days", days);
    return p.toString();
  }, [meta, from, to, group, days]);
  const { data, error, isLoading, mutate } = useSWR<Res>(meta && can(meta.perm) ? `/api/v1/reports/${ma}?${qs}` : null, swrFetcher, { shouldRetryOnError: false });
  const forbidden = error instanceof ApiClientError && error.status === 403;

  const pick = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const [a, b] = presetRange(p, today);
      setFrom(a);
      setTo(b);
    }
  };
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const r = await fetch(`/api/v1/reports/${ma}?${qs}&format=xlsx`, { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.detail ?? "Không xuất được file.");
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bao-cao-${ma}-${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error("Không xuất được Excel", e instanceof Error ? e.message : "");
    } finally {
      setExporting(false);
    }
  };

  const gen = data ? new Date(data.generatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : null;
  const rowsOf = (path: string | undefined, kv?: boolean): Array<Record<string, unknown>> => {
    const d = data?.data as unknown;
    const x = path ? (d as Record<string, unknown> | null)?.[path] : d;
    if (kv && x && typeof x === "object" && !Array.isArray(x)) return Object.entries(x as Record<string, unknown>).map(([k, v]) => ({ k, v }));
    return Array.isArray(x) ? (x as Array<Record<string, unknown>>) : [];
  };

  if (!meta) {
    return (
      <>
        <PageHeader title="Báo cáo" />
        <div className="g wf-pad"><EmptyState title="Không có báo cáo này" action={{ label: "Danh sách báo cáo", href: "/bao-cao" }} /></div>
      </>
    );
  }
  return (
    <>
      <PageHeader title={meta.title} context="Báo cáo" description={meta.desc} />
      <RequirePerm perm={meta.perm}>
        <section className="g wf-pad wf-no-print" aria-label="Bộ lọc báo cáo" style={{ marginBottom: 12 }}>
          {(meta.dates || meta.group) && (
            <>
              <SegmentedControl ariaLabel="Khoảng thời gian" value={preset} onChange={pick} options={[{ value: "7", label: "7 ngày" }, { value: "30", label: "30 ngày" }, { value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }, { value: "custom", label: "Tùy chọn" }]} />
              <div style={{ marginTop: 10 }}>
                <Field label="Khoảng ngày"><DateRange from={from} to={to} max={today} onChange={(r) => { setPreset("custom"); setFrom(r.from); setTo(r.to); }} /></Field>
              </div>
            </>
          )}
          {meta.group && <Field label="Nhóm theo"><Select value={group} onChange={(e) => setGroup(e.target.value)} options={[{ value: "day", label: "Ngày" }, { value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]} /></Field>}
          {meta.days && <Field label="Ngưỡng số ngày" hint="Để trống = theo cài đặt cửa hàng"><TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></Field>}
          <div className="wf-dev-row" style={{ marginTop: 6 }}>
            {can("report.export") && <Button loading={exporting} icon={<Download size={16} aria-hidden="true" />} onClick={() => void exportXlsx()}>Xuất Excel</Button>}
            <Button icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>In / Lưu PDF</Button>
          </div>
        </section>

        <p className="wf-mute" style={{ margin: "0 4px 10px" }}>
          {data ? `${meta.dates || meta.group ? `Từ ${formatDateVn(data.from.slice(0, 10))} đến ${formatDateVn(data.to.slice(0, 10))} · ` : ""}Dữ liệu đến lúc ${gen}` : ""}
        </p>
        {isLoading ? <Skeleton h={220} radius={26} /> : forbidden ? (
          <div className="g wf-pad"><EmptyState icon={<ShieldOff size={24} />} title="Bạn không có quyền xem báo cáo này" description={errMsg(error)} /></div>
        ) : error || !data ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            {meta.sections.map((s) => (
              <ReportTable key={s.title} title={s.title} rows={rowsOf(s.path, s.kv)} cols={s.cols} totals={s.totals} />
            ))}
          </div>
        )}
      </RequirePerm>
    </>
  );
}
