import { api } from "@/server/http";
import { ClaimBody } from "@/lib/types/collab";

// CTV: các lần tôi báo đã bán và kết quả (chờ / đã xác nhận / bị từ chối). Không có giá bán.
export const GET = api({ perm: "collab.view_own" }, async ({ db }) => {
  const rows = await db((tx) => tx.q<Record<string, unknown>>("SELECT * FROM app.fn_my_claims(200)"));
  return {
    items: rows.map((r) => ({
      id: r.id, unitId: r.unit_id, assetCode: r.asset_code, modelName: r.model_name, brandName: r.brand_name, customerName: r.customer_name, customerPhone: r.customer_phone,
      note: r.note, status: r.status, rejectReason: r.reject_reason, createdAt: r.created_at, decidedAt: r.decided_at, thumbUrl: r.photo_id ? `/api/v1/files/${r.photo_id}/thumb` : null,
    })),
  };
});

// Báo đã bán: tên + SĐT khách. Ai báo trước thì được giữ chiếc (BR-COL-13); chủ xác nhận sau.
export const POST = api({ perm: "collab.view_own", body: ClaimBody, idempotent: "required" }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_collab_claim", [body.unitId, body.customerName, body.customerPhone, body.note ?? null]));
});
