import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

// Chi tiết đợt kiểm kê: số hệ thống HIỆN TẠI (lấy lại lúc chốt — BR-INV-01) và số đếm
export const GET = api({ perm: "stocktake.manage" }, async ({ params, db, can }) => {
  return db(async (tx) => {
    const s = await tx.one(`SELECT s.id, s.code, s.scope, s.status, s.location_id AS "locationId", s.started_at AS "startedAt", s.reconciled_at AS "reconciledAt", s.note
      FROM public.stocktakes s WHERE s.id = $1`, [params.id]);
    if (!s) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy đợt kiểm kê.");
    const lines = await tx.q(
      `SELECT x.id, x.subject_type AS "subjectType", x.unit_id AS "unitId", u.asset_code AS "assetCode", u.serial_no AS "serialNo", m.name AS "modelName", u.status AS "unitStatus",
              loc.name AS "locationName", x.part_id AS "partId", p.code AS "partCode", p.name AS "partName",
              CASE WHEN x.subject_type = 'part' THEN p.qty_on_hand ELSE CASE WHEN u.status IN ('in_stock','reserved','inspecting','in_repair') THEN 1 ELSE 0 END END AS "systemQty",
              x.expected_qty AS "expectedQty", x.counted_qty AS "countedQty", x.diff_qty AS "diffQty", x.reason_code AS "reasonCode", x.note, x.applied
              ${can("cost.view") ? `, x.loss_vnd AS loss` : ""}
       FROM public.stocktake_lines x LEFT JOIN public.watch_units u ON u.id = x.unit_id LEFT JOIN public.watch_models m ON m.id = u.model_id
       LEFT JOIN public.storage_locations loc ON loc.id = u.location_id LEFT JOIN public.parts p ON p.id = x.part_id
       WHERE x.stocktake_id = $1 ORDER BY x.subject_type DESC, coalesce(u.asset_code, p.code)`, [params.id]);
    return { ...s, lines };
  });
});
