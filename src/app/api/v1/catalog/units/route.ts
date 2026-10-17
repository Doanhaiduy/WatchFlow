import { api } from "@/server/http";
import { listUnits } from "@/server/catalog";
import { UnitListQuery } from "@/lib/types/catalog";

// Danh sách chiếc. Giá vốn chỉ có khi có cost.view (BR-SEC-02). Tạo chiếc = Nhập nhanh một chiếc (phiếu nhập, M4).
export const GET = api({ perm: "catalog.view", query: UnitListQuery }, async ({ query, db, can }) => {
  return db((tx) => listUnits(tx, query, can("cost.view")));
});
