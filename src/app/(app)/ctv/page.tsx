"use client";
import { Package, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import type { CollabUnit } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { ProductCard } from "@/components/ui/ProductCard";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";
import { Watch } from "lucide-react";

/** Màn của CTV: hàng đang giữ kèm GIÁ THU (không có giá vốn). */
function CtvHomeView() {
  const { can } = useSession();
  const focusSearch = useSearchParams().get("tim") === "1";
  const [q, setQ] = useState("");
  const { data, error, isLoading, mutate } = useSWR<{ items: CollabUnit[] }>(can("collab.view_own") ? "/api/v1/collab/me/units" : null, swrFetcher);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const items = (data?.items ?? []).filter((u) => !q.trim() || norm(`${joinTitle(u.brandName, u.modelName)} ${u.assetCode}`).includes(norm(q.trim())));
  return (
    <>
      <PageHeader title="Hàng đang giữ" description="Các chiếc cửa hàng giao cho bạn, kèm giá thu" actions={can("collab.view_own") && can("sale.create_draft") ? <Button sm variant="primary" href="/ctv/tao-don" icon={<Plus size={16} aria-hidden="true" />}>Tạo đơn</Button> : undefined} />
      <RequirePerm perm="collab.view_own">
        {data && data.items.length > 0 && (data.items.length > 3 || focusSearch) && <SearchBar value={q} onChange={setQ} autoFocus={focusSearch} placeholder="Tìm theo tên hoặc mã chiếc…" />}
        {isLoading ? (
          <SkeletonGroup className="wf-pgrid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="wf-pc g"><Skeleton h={150} radius={18} /></div>)}</SkeletonGroup>
        ) : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Package size={24} />} title="Bạn chưa có hàng đang giữ" description="Khi cửa hàng giao đồng hồ cho bạn, danh sách kèm giá thu sẽ hiện ở đây." /></div>
        ) : items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant="search" icon={<Package size={24} />} title="Không có chiếc khớp" description="Thử tên hoặc mã chiếc khác." /></div>
        ) : (
          <div className="wf-pgrid">
            {items.map((u) => (
              <ProductCard
                key={u.id}
                href={can("sale.create_draft") ? `/ctv/tao-don?unit=${u.id}` : undefined}
                name={joinTitle(u.brandName, u.modelName)}
                code={`${u.assetCode} · giữ ${u.daysHeld} ngày`}
                price={u.basePrice}
                imageSrc={u.thumbUrl ?? undefined}
                placeholder={<Watch size={52} aria-hidden="true" style={{ color: "var(--wf-accent)", opacity: 0.8 }} />}
              />
            ))}
          </div>
        )}
        {data && data.items.length > 0 && <p className="wf-mute" style={{ marginTop: 10 }}>Giá hiển thị là giá thu bạn phải nộp cho cửa hàng.</p>}
      </RequirePerm>
    </>
  );
}

export default function CtvHome() {
  return (
    <Suspense fallback={null}>
      <CtvHomeView />
    </Suspense>
  );
}
