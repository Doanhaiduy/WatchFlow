// Quyền cho từng loại nhập Excel (dùng chung giao diện + máy chủ; máy chủ và DB luôn kiểm lại).
// Cần ĐỦ cả danh sách: ghi bằng quyền của người dùng (RLS), nên cũng cần quyền xem danh mục để đối chiếu hãng/loại/vị trí/danh mục.
import type { Permission } from "@/lib/permissions";
import type { ImportKind } from "./columns";

export const IMPORT_PERMS: Record<ImportKind, readonly Permission[]> = {
  // Cần xem TOÀN BỘ khách để báo trùng SĐT — CTV (chỉ customer.view_own) không nhập hàng loạt
  customers: ["customer.create", "customer.view"],
  watches: ["purchase.create", "purchase.confirm", "catalog.view"],
  parts: ["purchase.create", "purchase.confirm", "part.view"],
};

export const ALL_IMPORT_PERMS: Permission[] = ["customer.create", "purchase.create"];

export function canImport(kind: ImportKind, can: (p: Permission) => boolean): boolean {
  return IMPORT_PERMS[kind].every((p) => can(p));
}
