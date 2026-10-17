import { api } from "@/server/http";
import { UNITS_COLLAB_SELECT } from "@/server/collab";

// CTV: hàng đang giữ kèm giá thu giao — KHÔNG giá vốn (PT-02)
export const GET = api({ perm: "collab.view_own" }, async ({ db }) => {
  const items = await db((tx) => tx.q(`${UNITS_COLLAB_SELECT} WHERE v.held_by_collaborator_id = app.current_user_id() ORDER BY v.assigned_date`));
  return { items };
});
