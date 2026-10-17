"use client";
import { ClipboardList } from "lucide-react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { MySale } from "@/components/collab/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

const LABEL: Record<string, string> = { draft: "Chờ xác nhận", confirmed: "Đã xác nhận", voided: "Đã hủy" };

export default function CtvOrdersPage() {
  const { can } = useSession();
  const { data, error, isLoading, mutate } = useSWR<{ items: MySale[] }>(can("collab.view_own") ? "/api/v1/collab/me/sales" : null, swrFetcher);
  return (
    <>
      <PageHeader title="Đơn của tôi" description="Trạng thái, phần bạn hưởng và đã nộp chưa" />
      <RequirePerm perm="collab.view_own">
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<ClipboardList size={24} />} title="Bạn chưa có đơn nào" description="Tạo đơn khi bán được một chiếc đang giữ." action={can("sale.create_draft") ? { label: "Tạo đơn", href: "/ctv/tao-don" } : undefined} /></div>
        ) : (
          <div className="wf-stack">
            {data?.items.map((s) => (
              <section key={s.id} className="g wf-pad" aria-label={s.code ?? "Đơn chờ xác nhận"}>
                <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <b>{s.code ?? "Đơn chờ xác nhận"}</b>
                  <StatusChip kind="doc" status={s.status} label={LABEL[s.status]} />
                </div>
                <p className="wf-mute" style={{ fontSize: 12.5 }}>{s.customerName ?? "Khách"}{s.customerPhone ? ` · ${s.customerPhone}` : ""} · {formatDateVn(s.docDate)}</p>
                {s.voidReason && <p className="wf-fld-err">Lý do hủy: {s.voidReason}</p>}
                {s.lines.map((l, i) => (
                  <div key={i} className="wf-cart-line">
                    <div className="wf-dev-row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{l.modelName} · {l.assetCode}</span><b className="wf-num" style={{ flex: "none" }}>{formatVnd(l.salePrice)}</b></div>
                    {l.basePrice != null && (
                      <p className="wf-mute" style={{ fontSize: 12.5 }}>
                        Giá thu {formatVnd(l.basePrice)} · phần bạn hưởng <b style={{ color: "var(--wf-ink)" }}>{formatVnd(l.salePrice - l.basePrice)}</b> · {s.status === "confirmed" ? (l.settled ? "đã nộp" : "chưa nộp") : "chờ xác nhận"}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </RequirePerm>
    </>
  );
}
