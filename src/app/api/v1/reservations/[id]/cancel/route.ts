import { api } from "@/server/http";
import { CancelReservationBody } from "@/lib/types/sales";
import { ApiError } from "@/server/errors";

// Hủy giữ: hoàn cọc (refund) hoặc tịch thu (forfeit: reservation.forfeit + lý do + xác thực lại) — BR-RSV-05
export const POST = api({ perm: "reservation.manage", body: CancelReservationBody, idempotent: "required" }, async ({ params, body, db, requireReauth, can }) => {
  if (body.mode === "forfeit") {
    if (!can("reservation.forfeit")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền tịch thu cọc.");
    requireReauth();
  }
  return db((tx) => tx.fn("app.fn_cancel_reservation", [params.id, body.mode, body.method, body.reason ?? null]));
});
