"use client";
import { Package, Truck, Undo2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import { CollabTabs } from "@/components/collab/CollabTabs";
import type { OfferedUnit } from "@/components/collab/types";
import { useDebounced } from "@/components/trade/useDebounced";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

// Hàng đang giao cho CTV: một chiếc có thể nằm ở nhiều CTV cùng lúc; chiếc vẫn là "Sẵn sàng bán" ở kho (BR-COL-12).
export default function OfferedUnitsPage() {
  const { can } = useSession();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const { data, error, isLoading, mutate } = useSWR<{ items: OfferedUnit[] }>(can("collab.view") ? `/api/v1/collab/offers${dq ? `?q=${encodeURIComponent(dq)}` : ""}` : null, swrFetcher, { keepPreviousData: true });
  const [sel, setSel] = useState<OfferedUnit | null>(null);
  const [busy, setBusy] = useState(false);

  const withdraw = async (u: OfferedUnit, collaboratorId?: string) => {
    setBusy(true);
    try {
      await sapi("/api/v1/collab/offers/withdraw", { body: { unitId: u.id, collaboratorId: collaboratorId ?? null } });
      toast.success(collaboratorId ? "Đã thu hồi chiếc khỏi CTV này" : "Đã thu hồi chiếc khỏi mọi CTV");
      const fresh = await mutate();
      setSel(fresh?.items.find((x) => x.id === u.id) ?? null);
    } catch (e) {
      toast.error("Không thu hồi được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const items = data?.items ?? [];
  const live = sel ? items.find((x) => x.id === sel.id) ?? null : null;

  return (
    <>
      <PageHeader title="Hàng đang giao CTV" description="Mỗi chiếc có thể giao nhiều CTV; ai báo bán trước được giữ" actions={can("collab.manage") ? <Button sm variant="primary" href="/cong-tac-vien/giao-hang" icon={<Truck size={16} aria-hidden="true" />}>Giao đồng hồ</Button> : undefined} />
      <RequirePerm perm="collab.view">
        <CollabTabs />
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã, serial, tên đồng hồ…" />
        {isLoading ? <SkeletonList rows={5} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Package size={24} />} variant={dq ? "search" : "plain"} title={dq ? "Không có chiếc khớp" : "Chưa giao chiếc nào cho CTV"} description={dq ? "Thử từ khóa khác." : "Bấm “Giao đồng hồ”, chọn chiếc và các CTV được bán chiếc đó."} action={!dq && can("collab.manage") ? { label: "Giao đồng hồ", href: "/cong-tac-vien/giao-hang" } : undefined} /></div>
        ) : (
          <InsetList label="Hàng đang giao">
            {items.map((u) => {
              const claimed = u.collaborators.find((c) => c.claimId);
              return (
                <InsetRow key={u.id} wrap onClick={() => setSel(u)}
                  thumb={u.thumbUrl ? <img src={u.thumbUrl} alt="" loading="lazy" width={48} height={48} /> : <WatchArt crop="head" seed={artSeed(u.brandName, u.modelName)} brand={u.brandName} model={u.modelName} />}
                  title={joinTitle(u.brandName, u.modelName)}
                  subtitle={`${u.assetCode} · ${u.collaborators.map((c) => c.name ?? "CTV").join(", ")}`}
                  end={formatVnd(u.listPrice)}
                  endSub={claimed ? <StatusChip tone="hold">{claimed.name ?? "CTV"} báo bán</StatusChip> : `${u.collaborators.length} CTV`} />
              );
            })}
          </InsetList>
        )}
        <Modal open={!!live} onClose={() => setSel(null)} busy={busy} title={live ? `${live.assetCode} · ${joinTitle(live.brandName, live.modelName)}` : ""}>
          {live && (
            <div className="wf-stack">
              <p className="wf-mute">Giá niêm yết {formatVnd(live.listPrice)} · giao từ {formatDateVn(live.offeredAt.slice(0, 10))}. Chiếc vẫn ở kho cho tới khi có CTV báo bán và bạn xác nhận.</p>
              <InsetList label="Cộng tác viên được giao chiếc này">
                {live.collaborators.map((c) => (
                  <InsetRow key={c.collaboratorId} title={c.name ?? "CTV"} subtitle={c.claimId ? "Đã báo bán — xem ở tab Báo bán" : `Được giao ${formatDateVn(c.offeredAt.slice(0, 10))}`}
                    end={c.claimId ? <StatusChip tone="hold">Chờ xác nhận</StatusChip> : can("collab.manage") ? <Button sm icon={<Undo2 size={14} aria-hidden="true" />} disabled={busy} onClick={() => void withdraw(live, c.collaboratorId)}>Thu hồi</Button> : undefined} />
                ))}
              </InsetList>
              <div className="wf-modal-f">
                <ModalClose disabled={busy}>Đóng</ModalClose>
                {can("collab.manage") && live.collaborators.length > 1 && !live.collaborators.some((c) => c.claimId) && <Button disabled={busy} onClick={() => void withdraw(live)}>Thu hồi khỏi tất cả</Button>}
                {live.collaborators.some((c) => c.claimId) && <Button variant="primary" href="/cong-tac-vien/bao-ban">Xử lý báo bán</Button>}
              </div>
            </div>
          )}
        </Modal>
      </RequirePerm>
    </>
  );
}
