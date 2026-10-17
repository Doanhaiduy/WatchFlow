"use client";
// Lucian UX/UI Prompt #074 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#074
// Chuông thông báo: lắc + huy hiệu nảy khi có thông báo mới, bấm mở bảng thả xuống (mới nhất trước, chấm chưa đọc, bấm để đánh dấu đã đọc và mở liên kết).
import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { api } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import "./lucian-074.css";

type N = { id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null };
const KEY = "/api/v1/notifications?page=1&pageSize=8";
export const UNREAD_KEY = "/api/v1/notifications?page=1&pageSize=1";

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { data, mutate } = useSWR<{ items: N[]; unread: number }>(KEY, (p: string) => api<{ items: N[]; unread: number }>(p, { noRedirect: true }), { refreshInterval: 60_000, shouldRetryOnError: false });
  const unread = data?.unread ?? 0;
  const prev = useRef<number | null>(null);

  // Có thông báo mới (số chưa đọc tăng) ⇒ chuông lắc
  useEffect(() => {
    if (prev.current !== null && unread > prev.current) {
      setRing(false);
      const r = requestAnimationFrame(() => setRing(true));
      const t = setTimeout(() => setRing(false), 1000);
      prev.current = unread;
      return () => (cancelAnimationFrame(r), clearTimeout(t));
    }
    prev.current = unread;
  }, [unread]);

  // Đóng khi bấm ra ngoài / Esc
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => (document.removeEventListener("pointerdown", down), document.removeEventListener("keydown", key));
  }, [open]);

  const refresh = async () => {
    await Promise.all([mutate(), globalMutate(UNREAD_KEY)]);
  };
  const openItem = async (n: N) => {
    if (!n.readAt) {
      await api(`/api/v1/notifications/${n.id}/read`, { method: "POST", noRedirect: true }).catch(() => undefined);
      void refresh();
    }
    setOpen(false);
    if (n.link && n.link.startsWith("/") && !n.link.startsWith("//")) router.push(n.link);
  };
  const readAll = async () => {
    await api("/api/v1/notifications/read-all", { method: "POST", noRedirect: true }).catch(() => undefined);
    void refresh();
  };

  return (
    <div ref={root} className={`ux u074${open ? "" : " is-closed"} ${className ?? ""}`.trim()}>
      <button type="button" className={`u074-bell${ring ? " ring" : ""}`} aria-expanded={open} aria-haspopup="true" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"} onClick={() => setOpen((o) => !o)}>
        <Bell size={22} aria-hidden="true" />
        <span className={`u074-badge${unread === 0 ? " zero" : ""}`} aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
      </button>
      <div className="u074-pan" role="region" aria-label="Danh sách thông báo" {...(open ? {} : ({ inert: true } as object))}>
        <div className="u074-ph">
          <b style={{ fontSize: 15, fontWeight: 800 }}>Thông báo</b>
          <button type="button" className="u074-all" disabled={unread === 0} onClick={() => void readAll()}>Đọc hết</button>
        </div>
        <ul className="u074-list" aria-live="polite">
          {data && data.items.length === 0 && <li className="wf-mute" style={{ padding: "16px 12px" }}>Chưa có thông báo nào.</li>}
          {data?.items.map((n) => (
            <li key={n.id} className="u074-it">
              <div>
                <button type="button" className={`u074-row${n.readAt ? " read" : ""}`} onClick={() => void openItem(n)}>
                  <span className="u074-tx">
                    <b>{n.title}</b>
                    {n.body ? ` ${n.body}` : ""}
                    <small>{formatDateTimeVn(n.createdAt)}</small>
                  </span>
                  <i className="u074-dot" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div style={{ padding: "0 14px 12px" }}>
          <Link href="/thong-bao" className="u074-all" style={{ marginLeft: 0 }} onClick={() => setOpen(false)}>Xem tất cả</Link>
        </div>
      </div>
    </div>
  );
}
