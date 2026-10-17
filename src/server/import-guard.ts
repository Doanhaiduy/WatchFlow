import "server-only";
import { ApiError } from "./errors";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/columns";
import { canImport } from "@/lib/import/perms";
import type { Permission } from "@/lib/permissions";

/** Loại nhập từ đường dẫn + kiểm quyền theo loại (đủ cả danh sách quyền) */
export function importKind(raw: string | undefined, can: (p: Permission) => boolean): ImportKind {
  if (!raw || !(IMPORT_KINDS as readonly string[]).includes(raw)) throw new ApiError(404, "WF-NOT-FOUND", "Không có loại nhập này.");
  const kind = raw as ImportKind;
  if (!canImport(kind, can)) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền nhập loại dữ liệu này.");
  return kind;
}
