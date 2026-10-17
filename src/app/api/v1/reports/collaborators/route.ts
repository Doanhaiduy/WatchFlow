import { api } from "@/server/http";
import { collabStats } from "@/server/collab";
import { StatsQuery } from "@/lib/types/collab";

// R9 — Thống kê CTV (chủ: tất cả hoặc một CTV; CTV: chỉ của mình — hàm DB tự giới hạn)
export const GET = api({ perm: ["collab.view", "collab.view_own"], query: StatsQuery }, async ({ query, db }) => {
  return db((tx) => collabStats(tx, query));
});
