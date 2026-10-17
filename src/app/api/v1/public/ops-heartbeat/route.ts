import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bearerOk } from "@/server/cron";
import { env } from "@/server/env";
import { withWorker } from "@/server/db";

export const dynamic = "force-dynamic";
const Body = z.object({ kind: z.enum(["backup", "restore_drill", "storage_backup"]), ok: z.boolean().default(true), note: z.string().max(500).optional() });

// Repo sao lưu báo "đã sao lưu" (BR-BAK-02). Bearer OPS_HEARTBEAT_SECRET.
export async function POST(req: NextRequest) {
  if (!bearerOk(req, env.opsHeartbeatSecret)) return NextResponse.json({ code: "WF-AUTH-UNAUTHENTICATED" }, { status: 401 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ code: "WF-VALIDATION" }, { status: 422 });
  await withWorker((tx) => tx.q("INSERT INTO public.ops_heartbeats (kind, ok, note) VALUES ($1,$2,$3)", [b.data.kind, b.data.ok, b.data.note ?? null]));
  return NextResponse.json({ ok: true });
}
