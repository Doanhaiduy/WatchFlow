import { api } from "@/server/http";
import { collabStats } from "@/server/collab";
import { StatsQuery } from "@/lib/types/collab";

// Thống kê của tôi (CTV) theo tháng/quý/năm (BR-COL-10)
export const GET = api({ perm: "collab.view_own", query: StatsQuery }, async ({ query, db }) => {
  return db((tx) => collabStats(tx, { ...query, collaborator: null }));
});
