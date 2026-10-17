import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

// Ghi đếm: quét/gõ mã nội bộ/serial (chiếc ⇒ đếm 1) hoặc linh kiện + số lượng; "không thấy" ⇒ counted 0 + lý do
const Body = z.object({
  code: z.string().trim().max(200).optional(),
  unitId: z.string().uuid().optional(),
  partId: z.string().uuid().optional(),
  counted: z.number().int().min(0).max(1_000_000).default(1),
  reasonCode: z.enum(["lost", "damaged", "input_error", "count_error", "found", "other"]).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});
export const POST = api({ perm: "stocktake.manage", body: Body }, async ({ params, body, db }) => {
  return db(async (tx) => {
    let unitId = body.unitId ?? null;
    if (!unitId && !body.partId && body.code) {
      const raw = body.code.replace(/^.*\/units\//, "");
      const u = await tx.one<{ id: string }>(`SELECT id FROM public.watch_units WHERE upper(asset_code) = upper($1) OR (serial_norm IS NOT NULL AND serial_norm = app.norm_serial($1))
        ORDER BY (upper(asset_code) = upper($1)) DESC LIMIT 1`, [raw]);
      if (!u) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy chiếc với mã này.");
      unitId = u.id;
    }
    return tx.fn("app.fn_stocktake_count", [params.id, unitId, body.partId ?? null, body.counted, body.reasonCode ?? null, body.note ?? null]);
  });
});
