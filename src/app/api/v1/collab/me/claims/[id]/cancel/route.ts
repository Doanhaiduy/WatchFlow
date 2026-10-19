import { api } from "@/server/http";

// CTV rút lại báo bán còn chờ
export const POST = api({ perm: "collab.view_own" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_cancel_claim", [params.id]));
});
