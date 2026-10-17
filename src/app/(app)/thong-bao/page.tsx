"use client";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { errMsg } from "@/components/auth/helpers";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null };
type Res = { items: Notif[]; unread: number };
const UNREAD_KEY = "/api/v1/notifications?page=1&pageSize=1";

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [size, setSize] = useState(20);
  const key = `/api/v1/notifications?page=1&pageSize=${size}`;
  const { data, error, isLoading, mutate } = useSWR<Res>(key, swrFetcher, { refreshInterval: 60_000 });

  const refresh = async () => {
    await Promise.all([mutate(), globalMutate(UNREAD_KEY)]);
  };
  const open = async (n: Notif) => {
    try {
      if (!n.readAt) {
        await api(`/api/v1/notifications/${n.id}/read`, { method: "POST" });
        void refresh();
      }
    } catch (e) {
      toast.error("Không đánh dấu đã đọc được", errMsg(e));
    }
    if (n.link && n.link.startsWith("/") && !n.link.startsWith("//")) router.push(n.link);
  };
  const readAll = async () => {
    try {
      await api("/api/v1/notifications/read-all", { method: "POST" });
      await refresh();
      toast.success("Đã đánh dấu tất cả là đã đọc");
    } catch (e) {
      toast.error("Không thực hiện được", errMsg(e));
    }
  };

  const unread = data?.unread ?? 0;
  return (
    <>
      <PageHeader
        title="Thông báo"
        description={unread ? `${unread} thông báo chưa đọc` : "Bạn đã xem hết"}
        actions={
          unread > 0 ? (
            <Button sm icon={<CheckCheck size={16} aria-hidden="true" />} onClick={() => void readAll()}>
              Đọc hết
            </Button>
          ) : undefined
        }
      />
      <div style={{ marginTop: 12 }}>
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : error ? (
          <div className="g wf-pad">
            <ErrorState description={errMsg(error)} onRetry={async () => ((await mutate()) !== undefined)} />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState title="Chưa có thông báo nào" description="Cảnh báo hết hạn giữ hàng, đơn CTV chờ xác nhận… sẽ hiện ở đây." icon={<BellOff size={24} aria-hidden="true" />} />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách thông báo">
              {data?.items.map((n) => (
                <InsetRow
                  key={n.id}
                  onClick={() => void open(n)}
                  icon={<Bell size={20} aria-hidden="true" />}
                  tone={n.readAt ? "neutral" : "info"}
                  title={n.title}
                  subtitle={n.body ?? undefined}
                  end={n.readAt ? undefined : <span className="wf-row-dot" role="img" aria-label="Chưa đọc" />}
                  endSub={formatDateTimeVn(n.createdAt)}
                />
              ))}
            </InsetList>
            {data && data.items.length >= size && size < 100 && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <Button onClick={() => setSize((s) => Math.min(100, s + 20))}>Xem thêm</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
