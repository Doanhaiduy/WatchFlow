"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/session";
import { ADMIN_TABS, allowed } from "./nav";

/** Hàng liên kết các mục Quản trị theo quyền (điện thoại; trên desktop sidebar cũng có). Mục đang chọn tự cuộn vào giữa để luôn thấy. */
export function AdminTabs() {
  const pathname = usePathname();
  const { can } = useSession();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const box = root.current;
    if (el && box) {
      const left = el.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
      box.scrollTo({ left: left - (box.clientWidth - el.offsetWidth) / 2, behavior: "auto" });
    }
  }, [pathname]);
  return (
    <nav ref={root} className="wf-tabs-l" aria-label="Mục quản trị">
      {ADMIN_TABS.filter((t) => allowed(t, can)).map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
