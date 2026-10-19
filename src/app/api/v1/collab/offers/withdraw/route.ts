import { api } from "@/server/http";
import { WithdrawBody } from "@/lib/types/collab";

// Thu hồi chào hàng: một CTV hoặc tất cả CTV của chiếc (không thu hồi được khi có báo bán đang chờ)
export const POST = api({ perm: "collab.manage", body: WithdrawBody }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_withdraw_offer", [body.unitId, body.collaboratorId ?? null]));
});
