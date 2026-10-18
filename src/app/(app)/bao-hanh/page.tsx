"use client";
import { ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { useDebounced } from "@/components/trade/useDebounced";
import type { Warranty } from "@/components/trade/types";
import { PdfButtons } from "@/components/pdf/PdfButtons";
import { Button } from "@/components/ui/Button";
import { KeyValue } from "@/components/ui/Display";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { warrantyStatus } from "@/components/ui/status";
import { ApiClientError, newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { diffDays, formatDateVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { fetchStoreInfo } from "@/lib/store-info";

const PAGE = 25;

export default function WarrantiesPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [f, setF] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, f]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (f[0] === "expiring") p.set("expiring", "1");
  else if (f[0]) p.set("status", f[0]);
  const [sel, setSel] = useState<Warranty | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{ items: Warranty[] }>(can(["warranty.view", "repair.view"]) ? `/api/v1/warranties?${p}` : null, swrFetcher, { keepPreviousData: true });

  return (
    <>
      <PageHeader title="Bảo hành" description="Tra cứu theo mã, serial hoặc SĐT khách" />
      <RequirePerm perm={["warranty.view", "repair.view"]}>
        <SearchBar value={q} onChange={setQ} placeholder="Mã BH, mã phiếu, mã chiếc, serial, SĐT…" />
        <FilterChips ariaLabel="Lọc bảo hành" value={f} onChange={setF} options={[{ value: "active", label: "Còn hạn" }, { value: "expiring", label: "Sắp hết hạn" }, { value: "expired", label: "Hết hạn" }, { value: "voided", label: "Đã hủy" }]} />
        {isLoading ? <SkeletonList rows={5} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant={dq || f.length ? "search" : "plain"} icon={<ShieldCheck size={24} />} title={dq || f.length ? "Không tìm thấy bảo hành" : "Chưa có bảo hành nào"} description={dq || f.length ? "Kiểm tra lại mã hoặc số điện thoại." : "Bảo hành tự được cấp khi xác nhận phiếu bán."} /></div>
        ) : (
          <>
            <InsetList label="Kết quả bảo hành">
              {data?.items.map((w) => {
                const st = w.effectiveStatus === "active" ? warrantyStatus(w.daysLeft) : w.effectiveStatus;
                return (
                  <InsetRow
                    key={w.id}
                    onClick={() => setSel(w)}
                    {...(w.effectiveStatus === "active"
                      ? { thumb: <ProgressRing value={Math.max(6, Math.min(100, (w.daysLeft / Math.max(1, diffDays(w.startDate, w.endDate))) * 100))} size={46} stroke={5} tone={st === "expiring" ? "hold" : "ok"} label={w.daysLeft > 999 ? "999+" : `${w.daysLeft}n`} ariaLabel={`Còn ${w.daysLeft} ngày bảo hành`} /> }
                      : { icon: <ShieldCheck size={20} aria-hidden="true" />, tone: st === "voided" ? ("bad" as const) : ("neutral" as const) })}
                    title={w.modelName ?? ([w.brandText, w.modelText].filter(Boolean).join(" ") || "Đồng hồ")}
                    subtitle={[w.code, w.assetCode, w.customerName ?? "Khách lẻ", w.customerPhone, `đến ${formatDateVn(w.endDate)}`].filter(Boolean).join(" · ")}
                    end={<StatusChip kind="warranty" status={st} />}
                    endSub={w.effectiveStatus === "active" ? `còn ${w.daysLeft} ngày` : undefined}
                  />
                );
              })}
            </InsetList>
            <Pager page={page} pageSize={PAGE} total={data && data.items.length === PAGE ? page * PAGE + 1 : (page - 1) * PAGE + (data?.items.length ?? 0)} onPage={setPage} />
          </>
        )}
        <WarrantyModal w={sel} onClose={() => setSel(null)} />
      </RequirePerm>
    </>
  );
}

function WarrantyModal({ w, onClose }: { w: Warranty | null; onClose: () => void }) {
  const { can } = useSession();
  const router = useRouter();
  const [complaint, setComplaint] = useState("");
  const [cond, setCond] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ code: string; msg: string } | null>(null);
  const key = useRef("");
  useEffect(() => {
    if (w) { setComplaint(""); setCond(""); setErr(null); key.current = newIdempotencyKey(); }
  }, [w]);
  const open = async () => {
    if (!w) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await sapi<{ id: string }>(`/api/v1/warranties/${w.id}/open-repair`, { body: { complaint: complaint.trim(), intakeCondition: cond.trim() || null }, idempotencyKey: key.current });
      router.push(`/sua-chua/${r.id}`);
    } catch (e) {
      key.current = newIdempotencyKey();
      setErr({ code: e instanceof ApiClientError ? e.code : "", msg: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };
  const live = w ? (w.effectiveStatus === "active" ? warrantyStatus(w.daysLeft) : w.effectiveStatus) : "active";
  return (
    <Modal open={!!w} onClose={onClose} busy={busy} title={w ? `Bảo hành ${w.code}` : ""}>
      {w && (
        <>
          <div className="wf-dev-row" style={{ marginBottom: 8 }}><StatusChip kind="warranty" status={live} /></div>
          <KeyValue items={[
            { label: "Đồng hồ", value: `${w.modelName ?? [w.brandText, w.modelText].filter(Boolean).join(" ")}${w.assetCode ? ` · ${w.assetCode}` : ""}` },
            { label: "Serial", value: w.serialNo ?? "—" },
            { label: "Khách", value: `${w.customerName ?? "Khách lẻ"}${w.customerPhone ? ` · ${w.customerPhone}` : ""}` },
            { label: "Hiệu lực", value: `${formatDateVn(w.startDate)} – ${formatDateVn(w.endDate)}` },
            { label: "Phiếu bán", value: w.saleCode ?? "—" },
          ]} />
          <div className="wf-dev-row" style={{ margin: "10px 0" }}>
            {w.saleId && <Button sm href={`/ban-hang/${w.saleId}`}>Xem phiếu bán</Button>}
            {w.unitId && <Button sm href={`/dong-ho/${w.unitId}`}>Xem chiếc</Button>}
            <PdfButtons sm label="PDF phiếu bảo hành" build={async () => {
              const [{ buildWarrantyPdf }, info] = await Promise.all([import("@/lib/pdf/warranty"), fetchStoreInfo()]);
              return buildWarrantyPdf(w, info?.store ?? { name: "", address: "", phone: "", taxCode: "", receiptFooter: "", warrantyTerms: "", repairTerms: "" });
            }} />
          </div>
          {can("repair.create") && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "8px 0" }}>Nhận máy bảo hành</h3>
              <Field label="Lỗi khách phản ánh" required><Textarea rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} maxLength={1000} /></Field>
              <Field label="Tình trạng lúc nhận"><TextInput value={cond} onChange={(e) => setCond(e.target.value)} /></Field>
              {err && (
                <div className="wf-lock" role="alert" style={{ display: "block", background: "var(--wf-bad-t)", marginBottom: 8 }}>
                  {err.msg}
                  {err.code === "WF-WAR-EXPIRED" && <div style={{ marginTop: 6 }}>Bảo hành đã hết hạn — bạn có thể <Link href="/sua-chua/moi" style={{ color: "var(--wf-accent)", fontWeight: 700 }}>nhận máy tính phí</Link>.</div>}
                </div>
              )}
              <Button variant="primary" block loading={busy} disabled={!complaint.trim()} icon={<Wrench size={16} aria-hidden="true" />} onClick={() => void open()}>Nhận máy bảo hành (miễn phí)</Button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

