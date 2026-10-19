import { api } from "@/server/http";
import { claimsList } from "@/server/collab";
import { ClaimListQuery } from "@/lib/types/collab";

// Báo đã bán của CTV, chờ cửa hàng xác nhận (người có sale.confirm hoặc collab.view)
export const GET = api({ perm: ["sale.confirm", "collab.view"], query: ClaimListQuery }, async ({ query, db }) => {
  return db((tx) => claimsList(tx, query));
});
