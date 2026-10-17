import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { health } from "@/server/ops";
import { loadOpsSummary } from "@/server/ops-summary";

const Q = z.object({ summary: z.enum(["1"]).optional() });

// Đầy đủ: system.health hoặc system.backup. `?summary=1` (dải cảnh báo vận hành): CHỈ system.health, một vòng DB, không có chi tiết lỗi.
export const GET = api({ perm: ["system.health", "system.backup"], query: Q }, async ({ db, query, can }) => {
  if (query.summary) {
    if (!can("system.health")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    return db((tx) => loadOpsSummary(tx));
  }
  const h = await health(true);
  const extra = await db(async (tx) => ({
    jobs: await tx.q(`SELECT job, slot, status, started_at AS "startedAt", finished_at AS "finishedAt", note FROM public.job_runs ORDER BY started_at DESC LIMIT 20`),
    errors: await tx.q(`SELECT source, code, route, message, count, last_seen AS "lastSeen", app_version AS "appVersion" FROM public.error_events ORDER BY last_seen DESC LIMIT 20`),
    backups: await tx.q(`SELECT kind, at, ok, note FROM public.ops_heartbeats ORDER BY at DESC LIMIT 10`),
  }));
  return { health: h, ...extra };
});
