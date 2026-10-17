// Kiểu dữ liệu kết quả xem trước / ghi của nhập Excel (dùng chung giao diện + máy chủ)
import type { ImportKind } from "./columns";

export type RowStatus = "ok" | "warning" | "error" | "duplicate";
export type PreviewRow = { line: number; label: string; detail: string; status: RowStatus; messages: string[]; include: boolean };
export type Preview = { kind: ImportKind; total: number; counts: Record<RowStatus, number>; rows: PreviewRow[]; notices: string[] };
export type CommitItem = { line: number; id: string; code: string | null; label: string; href: string; note?: string };
export type CommitResult = {
  kind: ImportKind;
  receipt: { id: string; code: string; href: string } | null;
  items: CommitItem[];
  failed: { line: number; label: string; message: string }[];
  skipped: number;
};
export type ImportOptionsIn = { createMissingModels?: boolean; defaultLocationId?: string | null };
