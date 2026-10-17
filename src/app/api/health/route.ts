import { NextResponse, type NextRequest } from "next/server";
import { health } from "@/server/ops";

export const dynamic = "force-dynamic";

// /api/health (công khai, tối giản) · /api/health?deep=1 (kiểm sâu: migration, sao lưu, job, outbox)
export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("deep") === "1";
  const r = await health(deep);
  const body = deep ? r : { ok: r.ok, version: r.version, time: r.time };
  return NextResponse.json(body, { status: r.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
