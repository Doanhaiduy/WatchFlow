import { api } from "@/server/http";
import { ActivityQuery, listActivity } from "@/server/activity";

/** Nhật ký hoạt động cấp request (ai làm gì, từ đâu) — chỉ audit.view; RLS activity_logs chặn lần hai. */
export const GET = api({ perm: "audit.view", query: ActivityQuery }, async ({ query, db }) => db((tx) => listActivity(tx, query)));
