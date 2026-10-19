"use client";
import { ClipboardList, Wrench } from "lucide-react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import type { RepairListItem } from "../repairs/types";
import type { SaleListItem } from "../trade/types";
import { EmptyState } from "../ui/EmptyState";
import { InsetList, InsetRow } from "../ui/InsetList";
import { Skeleton } from "../ui/Skeleton";
import { StatusChip } from "../ui/StatusChip";

/** Lịch sử của khách: các đơn đã mua (kèm hạn bảo hành xem ở đơn) và các lần gửi sửa (chỉ người có quyền xem sửa chữa). */
export function CustomerHistory({ customerId }: { customerId: string }) {
  const { can } = useSession();
  const canSales = can("sale.view");
  const sales = useSWR<{ items: SaleListItem[]; total: number }>(canSales ? `/api/v1/sales?customerId=${customerId}&pageSize=10&status=confirmed` : null, swrFetcher);
  const repairs = useSWR<{ items: RepairListItem[] }>(can("repair.view") ? `/api/v1/repairs?customerId=${customerId}&pageSize=10` : null, swrFetcher);

  return (
    <div className="wf-stack">
      <section aria-label="Lịch sử mua hàng">
        <div className="wf-sec"><h3>Lịch sử mua hàng</h3></div>
        {!canSales ? <div className="g wf-pad"><EmptyState title="Bạn không xem được đơn bán" /></div> : sales.isLoading ? <Skeleton h={80} radius={20} /> : sales.data && sales.data.items.length > 0 ? (
          <InsetList>
            {sales.data.items.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<ClipboardList size={18} />} tone="ok" title={s.items ?? s.code} subtitle={[formatDateVn(s.docDate), s.code, s.collaboratorName ? `CTV ${s.collaboratorName}` : null].filter(Boolean).join(" · ")} end={formatVnd(s.grandTotal)} />)}
          </InsetList>
        ) : <div className="g wf-pad"><EmptyState title="Khách chưa mua gì" description="Đơn bán của khách sẽ hiện ở đây." /></div>}
      </section>
      {can("repair.view") && (
        <section aria-label="Lịch sử sửa chữa">
          <div className="wf-sec"><h3>Lịch sử sửa chữa</h3></div>
          {repairs.isLoading ? <Skeleton h={56} radius={20} /> : repairs.data && repairs.data.items.length > 0 ? (
            <InsetList>
              {repairs.data.items.map((r) => <InsetRow key={r.id} href={`/sua-chua/${r.id}`} icon={<Wrench size={18} />} tone="repair" title={r.code} subtitle={`${formatDateVn(r.receivedAt)} · ${r.complaint ?? ""}`} end={<StatusChip kind="repair" status={r.status} />} />)}
            </InsetList>
          ) : <div className="g wf-pad"><p className="wf-mute">Khách chưa gửi sửa máy nào.</p></div>}
        </section>
      )}
    </div>
  );
}
