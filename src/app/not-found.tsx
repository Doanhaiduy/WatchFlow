import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Không tìm thấy trang" };

export default function NotFound() {
  return (
    <main className="wf-auth">
      <div className="wf-auth-in g wf-auth-card">
        <EmptyState
          title="Không tìm thấy trang này"
          description="Đường dẫn có thể đã đổi hoặc bạn không có quyền xem. Quay về trang chủ để tiếp tục."
          icon={<Compass size={24} aria-hidden="true" />}
          action={{ label: "Về trang chủ", href: "/" }}
        />
      </div>
    </main>
  );
}
