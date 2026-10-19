import { api } from "@/server/http";
import { importKind } from "@/server/import-guard";
import { ImportPreviewBody, previewCustomers, previewWatches } from "@/server/import";
import { ALL_IMPORT_PERMS } from "@/lib/import/perms";

// Nhập Excel — XEM TRƯỚC từng dòng (chỉ đọc, không ghi gì): hợp lệ / cảnh báo / lỗi / trùng. Trình duyệt đã đọc tệp và gửi các dòng (≤ 300).
export const POST = api({ perm: ALL_IMPORT_PERMS, body: ImportPreviewBody }, async ({ params, body, db, can }) => {
  const kind = importKind(params.kind, can);
  return db((tx) => {
    if (kind === "customers") return previewCustomers(tx, body.rows);
    return previewWatches(tx, body.rows, body.options ?? {}, can);
  });
});
