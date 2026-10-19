import { z } from "zod";
import { api } from "@/server/http";

// Bảo hành còn hạn của một khách — để chọn khi nhận máy sửa MIỄN PHÍ theo bảo hành (chủ). Không có màn tra cứu bảo hành riêng (CF-15).
export const GET = api({ perm: "repair.create", query: z.object({ customerId: z.string().uuid() }) }, async ({ query, db }) => {
  const items = await db((tx) =>
    tx.q(
      `SELECT w.id, w.code, w.start_date AS "startDate", w.end_date AS "endDate", u.asset_code AS "assetCode", u.serial_no AS "serialNo", m.name AS "modelName",
              s.code AS "saleCode"
       FROM public.warranties w JOIN public.watch_units u ON u.id = w.unit_id JOIN public.watch_models m ON m.id = u.model_id
       LEFT JOIN public.sale_lines sl ON sl.id = w.sale_line_id LEFT JOIN public.sales s ON s.id = sl.sale_id
       WHERE w.customer_id = $1 AND w.status = 'active' AND w.end_date >= app.today_vn() AND w.repair_order_id IS NULL
       ORDER BY w.end_date DESC LIMIT 20`,
      [query.customerId],
    ),
  );
  return { items };
});
