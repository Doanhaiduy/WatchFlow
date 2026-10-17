import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getObject, type Bucket } from "@/server/storage";

export const GET = api({}, async ({ params, db }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id ?? "")) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy tệp.");
  const f = await db((tx) =>
    tx.one<{ bucket: Bucket; thumb_path: string | null; path: string; mime: string }>("SELECT bucket, thumb_path, path, mime FROM public.files WHERE id = $1", [params.id]),
  );
  if (!f) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy tệp hoặc bạn không có quyền xem.");
  const data = await getObject(f.bucket, f.thumb_path ?? f.path);
  if (!data) throw new ApiError(404, "WF-NOT-FOUND", "Tệp không còn trong kho lưu trữ.");
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": f.thumb_path ? "image/webp" : f.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});
