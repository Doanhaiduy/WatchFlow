import { api } from "@/server/http";

export const POST = api({}, async ({ params, db }) => {
  const n = await db((tx) => tx.fn<number>("app.fn_mark_notifications_read", [[params.id]]));
  return { updated: n };
});
