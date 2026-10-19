import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getRepair } from "@/server/repairs";
import { RepairInfoBody } from "@/lib/types/repairs";

export const GET = api({ perm: "repair.view" }, async ({ params, db }) => {
  const r = await db((tx) => getRepair(tx, params.id!));
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy phiếu sửa.");
  return r;
});

export const PATCH = api({ perm: "repair.update", body: RepairInfoBody }, async ({ req, params, body, db }) => {
  const v = req.headers.get("if-match");
  const r = await db((tx) =>
    tx.one(`UPDATE public.repair_orders SET intake_condition = coalesce($2, intake_condition), customer_complaint = coalesce($3, customer_complaint),
              findings = coalesce($4, findings), expected_date = coalesce($5::date, expected_date)
            WHERE id = $1 AND ($6::int IS NULL OR version = $6) RETURNING id`,
      [params.id, body.intakeCondition ?? null, body.complaint ?? null, body.findings ?? null, body.expectedDate ?? null, v ? Number(v) : null]),
  );
  if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Phiếu sửa vừa được cập nhật hoặc đã đóng. Hãy tải lại.");
  return { ok: true };
});
