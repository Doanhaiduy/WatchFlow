import { api } from "@/server/http";

export const GET = api({ auth: "auth" }, async ({ user, db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT id, created_at, last_seen_at, user_agent, (id = $1) AS current FROM public.auth_sessions
          WHERE user_id = app.current_user_id() AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50`, [user.sessionId]),
  );
  return { items };
});
