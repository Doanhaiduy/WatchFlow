"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { ReauthProvider } from "@/components/auth/useReauth";
import { nextStep } from "@/components/auth/helpers";
import { AppShell } from "@/components/layout/AppShell";
import { ImageViewerHost } from "@/components/ImageViewerHost";
import { InAppBrowserBar, InstallHint } from "@/components/pwa/InstallPrompt";
import { NotificationDeepLink } from "@/components/pwa/NotificationDeepLink";
import { swrFetcher } from "@/lib/api-client";
import { syncAppBadge } from "@/lib/pwa";
import { SessionProvider, useSession } from "@/lib/session";

type Notifs = { unread: number };

function Gate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  // Chưa đăng nhập / còn dở 2FA hoặc đổi mật khẩu ⇒ chuyển đúng bước (kèm đường dẫn đích)
  useEffect(() => {
    if (loading) return;
    const next = encodeURIComponent(pathname);
    if (!user) router.replace(`/dang-nhap?next=${next}`);
    else {
      const step = nextStep(user);
      if (step) router.replace(`${step}?next=${next}`);
    }
  }, [user, loading, pathname, router]);

  // Số thông báo chưa đọc: chỉ gọi khi đã có phiên đủ điều kiện; làm mới mỗi 60 giây
  const ready = !!user && !nextStep(user);
  const { data } = useSWR<Notifs>(ready ? "/api/v1/notifications?page=1&pageSize=1" : null, swrFetcher, { refreshInterval: 60_000, shouldRetryOnError: false });

  // Số chưa đọc trên biểu tượng ứng dụng đã cài (Badging API; nơi không hỗ trợ thì bỏ qua)
  const unreadCount = data?.unread;
  useEffect(() => {
    if (unreadCount !== undefined) syncAppBadge(unreadCount);
  }, [unreadCount]);

  if (!loading && (!user || nextStep(user))) return null; // đang chuyển trang
  return (
    <>
      <InAppBrowserBar />
      <AppShell unread={(data?.unread ?? 0) > 0}>{children}</AppShell>
      {ready && <InstallHint />}
      {ready && <NotificationDeepLink />}
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ReauthProvider>
        <Gate>{children}</Gate>
        <ImageViewerHost />
      </ReauthProvider>
    </SessionProvider>
  );
}
