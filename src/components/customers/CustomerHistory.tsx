"use client";
import { Bookmark, ClipboardList } from "lucide-react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { errMsg } from "../auth/helpers";
import type { Reservation, SaleListItem } from "../trade/types";
import { EmptyState } from "../ui/EmptyState";
import { InsetList, InsetRow } from "../ui/InsetList";
import { Skeleton } from "../ui/Skeleton";
import { StatusChip } from "../ui/StatusChip";

/** Lịch sử của khách: phiếu bán, phiếu còn nợ + tổng nợ, giữ hàng/cọc đang giữ (sửa chữa xem ở màn Sửa chữa). */
export function CustomerHistory({ customerId }: { customerId: string }) {
  const { can } = useSession();
  const canSales = can(["sale.view", "sale.view_own"]);
  const sales = useSWR<{ items: SaleListItem[]; total: number }>(canSales ? `/api/v1/sales?customerId=${customerId}&pageSize=10&status=confirmed` : null, swrFetcher);
  const debts = useSWR<{ items: SaleListItem[]; dueTotal: number }>(canSales ? `/api/v1/sales?customerId=${customerId}&due=true&pageSize=20` : null, swrFetcher);
  const rsv = useSWR<{ items: Reservation[] }>(can("reservation.manage") ? `/api/v1/reservations?customerId=${customerId}&status=active,expired` : null, swrFetcher);

  return (
    <div className="wf-stack">
      {canSales && (
        <section aria-label="Phiếu còn nợ">
          <div className="wf-sec"><h3>Còn nợ</h3>{debts.data && debts.data.dueTotal > 0 && <b style={{ color: "var(--wf-hold-text)" }}>{formatVnd(debts.data.dueTotal)}</b>}</div>
          {debts.isLoading ? <Skeleton h={56} radius={20} /> : debts.error ? <p className="wf-fld-err">{errMsg(debts.error)}</p> : debts.data && debts.data.items.length > 0 ? (
            <InsetList>
              {debts.data.items.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<ClipboardList size={18} />} tone="hold" title={s.code ?? "Phiếu"} subtitle={`${formatDateVn(s.docDate)}${s.dueDate ? ` · hẹn ${formatDateVn(s.dueDate)}` : ""}`} end={formatVnd(s.due ?? 0)} endSub={`trên ${formatVnd(s.grandTotal)}`} />)}
            </InsetList>
          ) : <div className="g wf-pad"><p className="wf-mute">Khách không còn nợ.</p></div>}
        </section>
      )}
      {can("reservation.manage") && (
        <section aria-label="Giữ hàng đang giữ">
          <div className="wf-sec"><h3>Đang giữ & cọc</h3></div>
          {rsv.isLoading ? <Skeleton h={56} radius={20} /> : rsv.data && rsv.data.items.length > 0 ? (
            <InsetList>
              {rsv.data.items.map((r) => <InsetRow key={r.id} href="/giu-hang" icon={<Bookmark size={18} />} tone={r.overdue ? "bad" : "hold"} title={`${r.modelName} · ${r.assetCode}`} subtitle={`đến ${formatDateVn(r.holdUntil)}`} end={formatVnd(r.held ?? 0)} endSub={r.overdue ? <StatusChip tone="bad">Quá hạn</StatusChip> : "đã cọc"} />)}
            </InsetList>
          ) : <div className="g wf-pad"><p className="wf-mute">Không có chiếc nào đang giữ.</p></div>}
        </section>
      )}
      <section aria-label="Lịch sử mua hàng">
        <div className="wf-sec"><h3>Lịch sử mua hàng</h3></div>
        {!canSales ? <div className="g wf-pad"><EmptyState title="Bạn không xem được phiếu bán" /></div> : sales.isLoading ? <Skeleton h={80} radius={20} /> : sales.data && sales.data.items.length > 0 ? (
          <InsetList>
            {sales.data.items.map((s) => <InsetRow key={s.id} href={`/ban-hang/${s.id}`} icon={<ClipboardList size={18} />} tone="ok" title={s.code ?? "Phiếu"} subtitle={[formatDateVn(s.docDate), s.items].filter(Boolean).join(" · ")} end={formatVnd(s.grandTotal)} endSub={<StatusChip kind="doc" status={s.status} />} />)}
          </InsetList>
        ) : <div className="g wf-pad"><EmptyState title="Khách chưa mua gì" description="Phiếu bán của khách sẽ hiện ở đây." /></div>}
      </section>
    </div>
  );
}
