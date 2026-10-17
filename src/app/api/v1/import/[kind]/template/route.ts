import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { importKind } from "@/server/import-guard";
import { buildTemplate } from "@/server/import-template";
import { ALL_IMPORT_PERMS } from "@/lib/import/perms";

// Tệp mẫu .xlsx cho từng loại nhập (sheet Dữ liệu + Hướng dẫn + Danh mục lấy từ cửa hàng). Chỉ cần quyền nhập loại đó.
export const GET = api({ perm: ALL_IMPORT_PERMS }, async ({ params, db, can }) => {
  const kind = importKind(params.kind, can);
  const { buffer, fileName } = await db((tx) => buildTemplate(tx, kind));
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fileName}"` },
  });
});
