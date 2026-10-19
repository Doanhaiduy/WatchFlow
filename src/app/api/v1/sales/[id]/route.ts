import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getSale } from "@/server/sales";

// Chi tiết đơn bán (chiếc + khách + giá + ngày + hạn bảo hành). Không giá vốn/lãi/thanh toán.
export const GET = api({ perm: "sale.view" }, async ({ params, db }) => {
  const s = await db((tx) => getSale(tx, params.id!));
  if (!s) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy đơn bán.");
  return s;
});
