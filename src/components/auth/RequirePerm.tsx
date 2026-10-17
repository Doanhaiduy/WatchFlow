"use client";
import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "@/lib/session";
import type { Permission } from "@/lib/permissions";
import { EmptyState } from "../ui/EmptyState";

/** Chỉ mount con khi có quyền ⇒ con không gọi API. Thiếu quyền: EmptyState (không phải lỗi). */
export function RequirePerm({ perm, children }: { perm?: Permission | Permission[]; children: ReactNode }) {
  const { can } = useSession();
  if (perm !== undefined && !can(perm)) {
    return (
      <div className="g wf-pad" style={{ marginTop: 12 }}>
        <EmptyState title="Bạn không có quyền xem mục này" description="Liên hệ chủ cửa hàng nếu bạn cần truy cập." icon={<ShieldOff size={24} aria-hidden="true" />} action={{ label: "Về trang chủ", href: "/" }} />
      </div>
    );
  }
  return <>{children}</>;
}
