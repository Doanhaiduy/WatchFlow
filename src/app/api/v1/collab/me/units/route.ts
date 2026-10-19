import { api } from "@/server/http";

// CTV: chiếc được giao cho tôi — giá niêm yết tham khảo, KHÔNG giá vốn/doanh thu (PT-02). Hàm DB chỉ trả cột an toàn.
export const GET = api({ perm: "collab.view_own" }, async ({ db }) => {
  const rows = await db((tx) => tx.q<Record<string, unknown>>("SELECT * FROM app.fn_my_offers()"));
  return {
    items: rows.map((r) => ({
      id: r.unit_id, assetCode: r.asset_code, serialNo: r.serial_no, condition: r.condition, conditionGrade: r.condition_grade, modelName: r.model_name, brandName: r.brand_name,
      listPrice: r.list_price_vnd, offeredAt: r.offered_at, claimId: r.claim_id, taken: r.taken, thumbUrl: r.photo_id ? `/api/v1/files/${r.photo_id}/thumb` : null,
    })),
  };
});
