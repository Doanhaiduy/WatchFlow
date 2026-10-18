"use client";
import { BarChart3, Handshake, Truck } from "lucide-react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { Avatar } from "@/components/ui/Avatar";
import { n, type CollabRow } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

export default function CollaboratorsPage() {
  const { can } = useSession();
  const { data, error, isLoading, mutate } = useSWR<{ items: CollabRow[] }>(can("collab.view") ? "/api/v1/collaborators" : null, swrFetcher);
  return (
    <>
      <PageHeader
        title="Cộng tác viên"
        description="Giao hàng, đơn chờ xác nhận và quyết toán"
        actions={(<>
          {can("collab.view") && <Button sm href="/cong-tac-vien/thong-ke" icon={<BarChart3 size={16} aria-hidden="true" />}>Thống kê</Button>}
          {can("collab.manage") && <Button sm variant="primary" href="/cong-tac-vien/giao-hang/moi" icon={<Truck size={16} aria-hidden="true" />}>Giao hàng</Button>}
        </>)}
      />
      <RequirePerm perm="collab.view">
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Handshake size={24} />} title="Chưa có cộng tác viên" description="Tạo người dùng với vai trò Cộng tác viên ở Quản trị → Người dùng, rồi giao hàng cho họ." action={can("user.manage") ? { label: "Quản lý người dùng", href: "/quan-tri/nguoi-dung" } : undefined} /></div>
        ) : (
          <InsetList label="Danh sách cộng tác viên">
            {data?.items.map((c) => (
              <InsetRow
                key={c.id}
                href={`/cong-tac-vien/${c.id}`}
                lead={<Avatar name={c.fullName} tone={c.isActive ? undefined : "neutral"} />}
                title={c.fullName}
                subtitle={`Đang giữ ${c.holding} chiếc · ${formatVnd(n(c.holdingValue))} giá thu · chưa nộp ${formatVnd(n(c.unsettled))}`}
                end={c.pendingOrders > 0 ? <StatusChip tone="hold">{c.pendingOrders} đơn chờ</StatusChip> : undefined}
                endSub={c.isActive ? c.area ?? undefined : "Đã tắt"}
              />
            ))}
          </InsetList>
        )}
      </RequirePerm>
    </>
  );
}
