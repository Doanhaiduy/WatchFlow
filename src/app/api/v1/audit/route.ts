import { api } from "@/server/http";
import { AuditQuery } from "@/lib/types/admin";

export const GET = api({ perm: "audit.view", query: AuditQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const conds: string[] = [];
    const p: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      p.push(v);
      conds.push(sql.replace("?", "$" + p.length));
    };
    if (query.entity) add("a.entity_table = ?", query.entity);
    if (query.entityId) add("a.entity_id = ?", query.entityId);
    if (query.actor) add("a.actor_id = ?", query.actor);
    if (query.action) add("a.action LIKE ? || '%'", query.action);
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const items = await tx.q(
      `SELECT a.id, a.at, a.action, a.entity_table AS "entityTable", a.entity_id AS "entityId", a.reason, a.before, a.after, a.level,
              a.request_id AS "requestId", u.full_name AS "actorName"
       FROM public.audit_logs a LEFT JOIN public.users u ON u.id = a.actor_id ${where}
       ORDER BY a.at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      p,
    );
    const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.audit_logs a ${where}`, p))?.n ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total };
  });
});
