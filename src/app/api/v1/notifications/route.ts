import { api } from "@/server/http";
import { Paging } from "@/lib/types/admin";
import { viGrouping } from "@/server/errors";

export const GET = api({ query: Paging }, async ({ query, db }) => {
  return db(async (tx) => {
    const rows = await tx.q<{ body: string | null }>(
      `SELECT id, type, title, body, link, created_at AS "createdAt", read_at AS "readAt" FROM public.notifications
       WHERE user_id = app.current_user_id() ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [query.pageSize, (query.page - 1) * query.pageSize],
    );
    const items = rows.map((r) => ({ ...r, body: r.body ? viGrouping(r.body) : r.body }));
    const unread =
      (await tx.one<{ n: number }>("SELECT count(*)::int n FROM public.notifications WHERE user_id = app.current_user_id() AND read_at IS NULL"))?.n ?? 0;
    return { items, unread, page: query.page, pageSize: query.pageSize };
  });
});
