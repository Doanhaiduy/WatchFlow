import { api } from "@/server/http";
import { listUnits } from "@/server/catalog";
import { UnitListQuery } from "@/lib/types/catalog";

// Danh sách chiếc (không có giá vốn). Tạo chiếc = Thêm đồng hồ (phiếu nhập 1 dòng) hoặc Nhập từ Excel.
export const GET = api({ perm: "catalog.view", query: UnitListQuery }, async ({ query, db }) => {
  return db((tx) => listUnits(tx, query));
});
