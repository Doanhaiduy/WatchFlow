import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { getPurchase, saveDraft } from "@/server/purchases";
import { PurchaseBody } from "@/lib/types/purchases";

export const GET = api({ perm: "purchase.view" }, async ({ params, db }) => {
  const r = await db((tx) => getPurchase(tx, params.id!));
  if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy phiếu nhập.");
  return r;
});

// Sửa nháp (thay toàn bộ dòng/chi phí) — If-Match: version
export const PATCH = api({ perm: "purchase.create", body: PurchaseBody }, async ({ req, params, body, db }) => {
  const v = req.headers.get("if-match");
  await db((tx) => saveDraft(tx, params.id!, body, v ? Number(v) : null));
  return { ok: true };
});

export const DELETE = api({ perm: "purchase.create" }, async ({ params, db }) => {
  const r = await db((tx) => tx.one("DELETE FROM public.purchase_receipts WHERE id = $1 AND status = 'draft' RETURNING id", [params.id]));
  if (!r) throw new ApiError(409, "WF-DOC-NOT-DRAFT", "Chỉ xóa được phiếu nhập nháp.");
  return { ok: true };
});
