"use client";
import { Activity, FileClock, History, ListChecks, Settings, ShieldCheck, Tag, Users } from "lucide-react";
import { useMemo } from "react";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ADMIN_TABS, allowed, navItem } from "@/components/layout/nav";
import { ShortcutGrid } from "@/components/ui/ShortcutGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSession } from "@/lib/session";
import type { Tone } from "@/components/ui/cx";

const ICON: Record<string, [React.ReactNode, Tone, string]> = {
  "/quan-tri/nguoi-dung": [<Users key="u" size={20} />, "info", "Tạo tài khoản, đặt lại mật khẩu, khóa/mở"],
  "/quan-tri/vai-tro": [<ShieldCheck key="r" size={20} />, "check", "Ma trận quyền theo vai trò"],
  "/quan-tri/cai-dat": [<Settings key="s" size={20} />, "hold", "Hạn giữ hàng, bảo hành, bảo mật…"],
  "/quan-tri/nhat-ky": [<FileClock key="a" size={20} />, "repair", "Ai đã làm gì, khi nào"],
  "/quan-tri/hoat-dong": [<ListChecks key="o" size={20} />, "check", "Ai đã xem, in, xuất dữ liệu nhạy cảm"],
  "/quan-tri/he-thong": [<Activity key="h" size={20} />, "ok", "Sức khỏe, sao lưu, tác vụ nền"],
  "/quan-tri/phien-ban": [<History key="v" size={20} />, "neutral", "Những gì đã thay đổi"],
};

export default function AdminHome() {
  const { can } = useSession();
  const tabs = useMemo(() => ADMIN_TABS.filter((t) => allowed(t, can)), [can]);
  return (
    <>
      <PageHeader title="Quản trị" description="Người dùng, quyền, cài đặt và tình trạng hệ thống" />
      <div style={{ marginTop: 12 }}>
        <RequirePerm perm={navItem("admin")?.permission}>
          <ShortcutGrid
            ariaLabel="Mục quản trị"
            cols={3}
            items={tabs.map((t) => {
              const [icon, tone, sub] = ICON[t.href] ?? [<Tag key="t" size={20} />, "neutral" as Tone, ""];
              return { href: t.href, label: t.label, icon, tone, sub };
            })}
          />
        </RequirePerm>
      </div>
    </>
  );
}
