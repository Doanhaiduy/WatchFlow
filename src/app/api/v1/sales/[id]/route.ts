import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getSale, saveSaleDraft } from "@/server/sales";
import { SaleBody } from "@/lib/types/sales";

// Chi tiết phiếu (nháp: kèm xem trước tổng/giảm %); giá vốn & lãi chỉ khi có quyền (BR-SALE-16)
export const GET = api({ perm: ["sale.view", "sale.view_own"] }, async ({ params, db, can, user }) => {
  const s = await db((tx) => getSale(tx, params.id!, { cost: can("cost.view"), profit: can("profit.view"), collab: can("collab.view"), userId: user.userId }));
  if (!s) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy phiếu bán.");
  return s;
});

export const PATCH = api({ perm: "sale.create_draft", body: SaleBody }, async ({ req, params, body, db }) => {
  const v = req.headers.get("if-match");
  await db((tx) => saveSaleDraft(tx, params.id!, body, v ? Number(v) : null));
  return { ok: true };
});

export const DELETE = api({ perm: "sale.create_draft" }, async ({ params, db }) => {
  const r = await db((tx) => tx.one("DELETE FROM public.sales WHERE id = $1 AND status = 'draft' RETURNING id", [params.id]));
  if (!r) throw new ApiError(409, "WF-DOC-NOT-DRAFT", "Chỉ xóa được phiếu nháp của bạn.");
  return { ok: true };
});
