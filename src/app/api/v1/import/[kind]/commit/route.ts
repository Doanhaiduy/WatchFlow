import { api } from "@/server/http";
import { importKind } from "@/server/import-guard";
import { ImportCommitBody, commitCustomers, commitWatches } from "@/server/import";
import { ALL_IMPORT_PERMS } from "@/lib/import/perms";

// Nhập Excel — GHI. Kiểm tra lại toàn bộ dòng (không tin xem trước). Khách: từng dòng trong điểm lưu riêng; đồng hồ: MỘT phiếu nhập `opening`
// (nháp → fn_confirm_purchase) trong cùng transaction. Bắt buộc Idempotency-Key (bấm đúp không nhập hai lần).
export const POST = api({ perm: ALL_IMPORT_PERMS, body: ImportCommitBody, idempotent: "required" }, async ({ params, body, db, can }) => {
  const kind = importKind(params.kind, can);
  return db((tx) => {
    if (kind === "customers") return commitCustomers(tx, body.rows, body.include);
    return commitWatches(tx, body.rows, body.options ?? {}, body.include, can);
  });
});
