import { api } from "@/server/http";
import { unsettledLines } from "@/server/collab";
import { SettleBody } from "@/lib/types/collab";

// Dòng đã bán chưa nộp (để chọn quyết toán)
export const GET = api({ perm: "collab.view" }, async ({ params, db }) => {
  return db(async (tx) => ({ unsettled: await unsettledLines(tx, params.id!) }));
});

// Quyết toán (BR-COL-06): Σ giá thu các dòng chọn ⇒ một thanh toán collab_settlement
export const POST = api({ perm: "collab.manage", body: SettleBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_settle_collaborator", [params.id, body.lineIds, body.method, body.docDate ?? null, body.note ?? null]));
});
