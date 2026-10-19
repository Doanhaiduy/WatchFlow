"use client";
import { ClipboardList, Undo2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import type { MyClaim } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";

// Các lần tôi báo đã bán và kết quả. Không có giá bán/doanh thu (CTV không xem).
export default function CtvClaimsPage() {
  const { can } = useSession();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ items: MyClaim[] }>(can("collab.view_own") ? "/api/v1/collab/me/claims" : null, swrFetcher, { refreshInterval: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await sapi(`/api/v1/collab/me/claims/${id}/cancel`, { body: {} });
      toast.success("Đã rút báo bán");
      await mutate();
    } catch (e) {
      toast.error("Không rút được", errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader title="Báo bán của tôi" description="Kết quả các chiếc bạn đã báo bán" />
      <RequirePerm perm="collab.view_own">
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<ClipboardList size={24} />} title="Bạn chưa báo bán chiếc nào" description="Bán được chiếc nào, vào “Hàng của tôi” và bấm “Đã bán”." action={{ label: "Hàng của tôi", href: "/ctv" }} /></div>
        ) : (
          <ul className="wf-rcards" aria-label="Báo bán của tôi">
            {data?.items.map((c) => (
              <li key={c.id} className="wf-rcard">
                <div className="wf-dev-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <b className="wf-rcard-h">{joinTitle(c.brandName, c.modelName)}</b>
                  <StatusChip kind="claim" status={c.status} />
                </div>
                <p className="wf-mute" style={{ fontSize: 12.5 }}>{c.assetCode} · khách {c.customerName} · {c.customerPhone}</p>
                <p className="wf-mute" style={{ fontSize: 12.5 }}>Báo lúc {formatDateTimeVn(c.createdAt)}{c.decidedAt ? ` · xử lý ${formatDateTimeVn(c.decidedAt)}` : ""}</p>
                {c.status === "rejected" && c.rejectReason && <p className="wf-fld-err">Lý do từ chối: {c.rejectReason}</p>}
                {c.status === "pending" && (
                  <div className="wf-dev-row" style={{ marginTop: 8 }}>
                    <Button sm icon={<Undo2 size={14} aria-hidden="true" />} loading={busy === c.id} onClick={() => void cancel(c.id)}>Rút lại báo bán</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </RequirePerm>
    </>
  );
}
