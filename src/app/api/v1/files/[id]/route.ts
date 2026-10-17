import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getObject, type Bucket } from "@/server/storage";

// Proxy tệp: quyền đọc theo RLS bảng files (không lộ URL Storage). Ảnh giấy tờ chỉ người có quyền.
export const GET = api({}, async ({ params, db }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id ?? "")) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy tệp.");
  const f = await db((tx) => tx.one<{ bucket: Bucket; path: string; mime: string }>("SELECT bucket, path, mime FROM public.files WHERE id = $1", [params.id]));
  if (!f) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy tệp hoặc bạn không có quyền xem.");
  const data = await getObject(f.bucket, f.path);
  if (!data) throw new ApiError(404, "WF-NOT-FOUND", "Tệp không còn trong kho lưu trữ.");
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": f.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
});
