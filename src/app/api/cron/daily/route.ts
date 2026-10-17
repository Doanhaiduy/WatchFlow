import { NextResponse, type NextRequest } from "next/server";
import { cronGuard } from "@/server/cron";
import { runJob, DAILY } from "@/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = cronGuard(req);
  if (deny) return deny;
  const slot = req.nextUrl.searchParams.get("slot") ?? undefined;
  return NextResponse.json(await runJob("daily", DAILY, slot));
}
