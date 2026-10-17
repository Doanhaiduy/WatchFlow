"use client";
import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** `navigator.onLine` dạng hook (SSR coi là online). Nút xác nhận phải khóa khi `false` (ux-and-navigation §6). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Biểu ngữ "Mất kết nối" — hiện khi offline (hoặc `force` để xem thử). */
export function OfflineBanner({ force }: { force?: boolean }) {
  const online = useOnline();
  if (online && !force) return null;
  return (
    <div className="wf-offline" role="status" aria-live="polite">
      <WifiOff size={18} aria-hidden="true" />
      <span>Mất kết nối — bạn vẫn nhập được, chưa thể xác nhận.</span>
    </div>
  );
}
