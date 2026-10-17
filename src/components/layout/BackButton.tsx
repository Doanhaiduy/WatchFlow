"use client";
import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { guardedNavigate } from "@/components/ui/useDirtyGuard";

/** Trang cấp 2 trở lên nhưng là mục ngang hàng của dock (không cần nút quay lại) */
const NO_BACK = new Set(["/ctv/don", "/ctv/thong-ke", "/ctv/toi"]);

/** Đường dẫn cha (cắt đoạn cuối); trang gốc cấp 1 trả về null */
export function parentPath(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length < 2 || NO_BACK.has(pathname)) return null;
  return "/" + seg.slice(0, -1).join("/");
}

/**
 * Nút quay lại cho điện thoại ở các trang chi tiết/biểu mẫu. Có lịch sử thì lùi về trang trước
 * (giữ ngữ cảnh người dùng vừa đi qua), không thì đi lên trang cha.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const parent = parentPath(pathname);
  if (!parent) return null;
  return (
    <button
      type="button"
      className="wf-cb g g-flat wf-back"
      aria-label="Quay lại"
      onClick={() => guardedNavigate(() => (window.history.length > 1 ? router.back() : router.push(parent)))}
    >
      <ChevronLeft size={22} aria-hidden="true" />
    </button>
  );
}
