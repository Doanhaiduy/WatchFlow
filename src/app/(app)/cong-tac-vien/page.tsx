"use client";
import { Handshake, Package, Truck } from "lucide-react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { CollabTabs } from "@/components/collab/CollabTabs";
import { n, type CollabRow } from "@/components/collab/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { StatusChip } from "@/components/ui/StatusChip";
import { swrFetcher } from "@/lib/api-client";
import { formatVndShort } from "@/lib/money";
import { useSession } from "@/lib/session";

// Danh sách cộng tác viên: đang giao bao nhiêu chiếc, tháng này bán được bao nhiêu (CF-10…CF-12). Không giá thu/quyết toán.
export default function CollaboratorsPage() {
  const { can } = useSession();
  const { data, error, isLoading, mutate } = useSWR<{ items: CollabRow[] }>(can("collab.view") ? "/api/v1/collaborators" : null, swrFetcher);
  const items = data?.items ?? [];
  const sum = (k: "offered" | "pendingClaims" | "soldMonth") => items.reduce((a, c) => a + c[k], 0);
  return (
    <>
      <PageHeader
        title="Cộng tác viên"
        description="Giao đồng hồ cho CTV bán — ai báo bán trước được giữ chiếc"
        actions={can("collab.manage") ? <Button sm variant="primary" href="/cong-tac-vien/giao-hang" icon={<Truck size={16} aria-hidden="true" />}>Giao đồng hồ</Button> : undefined}
      />
      <RequirePerm perm="collab.view">
        <CollabTabs />
        {data && items.length > 0 && (
          <StatStrip
            items={[
              { label: "Cộng tác viên", value: items.filter((c) => c.isActive).length, icon: <Handshake size={16} />, tone: "info" },
              { label: "Chiếc đang giao", value: sum("offered"), icon: <Package size={16} />, tone: "check", href: "/cong-tac-vien/hang" },
              { label: "Báo bán chờ", value: sum("pendingClaims"), icon: <Handshake size={16} />, tone: sum("pendingClaims") > 0 ? "hold" : "neutral", href: "/cong-tac-vien/bao-ban" },
              { label: "CTV bán tháng này", value: `${sum("soldMonth")} chiếc`, icon: <Truck size={16} />, tone: "ok" },
            ]}
          />
        )}
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Handshake size={24} />} title="Chưa có cộng tác viên" description="Tạo người dùng với vai trò Cộng tác viên ở Quản trị → Người dùng, rồi giao đồng hồ cho họ." action={can("user.manage") ? { label: "Quản lý người dùng", href: "/quan-tri/nguoi-dung" } : undefined} /></div>
        ) : (
          <InsetList label="Danh sách cộng tác viên">
            {items.map((c) => (
              <InsetRow
                key={c.id}
                href={`/cong-tac-vien/${c.id}`}
                lead={<Avatar name={c.fullName} tone={c.isActive ? undefined : "neutral"} />}
                title={c.fullName}
                subtitle={`Đang giao ${c.offered} chiếc · tháng này bán ${c.soldMonth} chiếc${can("report.sales") ? ` · ${formatVndShort(n(c.revenueMonth))}` : ""}`}
                end={c.pendingClaims > 0 ? <StatusChip tone="hold">{c.pendingClaims} báo bán chờ</StatusChip> : undefined}
                endSub={c.isActive ? c.area ?? c.phone ?? undefined : "Đã tắt"}
              />
            ))}
          </InsetList>
        )}
        {data && items.length > 0 && can("report.sales") && <p className="wf-mute" style={{ padding: "8px 4px", fontSize: 13 }}>Doanh thu của chiếc CTV bán = giá bán chủ xác nhận (mặc định giá niêm yết). Xem theo ngày/tháng/quý/năm ở Báo cáo → Cộng tác viên.</p>}
      </RequirePerm>
    </>
  );
}
