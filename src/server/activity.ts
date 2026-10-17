import "server-only";
// Nhật ký hoạt động cấp request (0021_activity.sql; security-model §8b). Ghi SAU khi trả phản hồi và GỘP nhiều request thành một INSERT
// dưới wf_worker (pool phụ) ⇒ không làm chậm request. Đọc: RLS chỉ cho quyền audit.view. Không ghi nội dung/query/giá trị tham số.
import { after } from "next/server";
import { z } from "zod";
import { withWorker, type Tx } from "./db";
import { ACTIVITY_ACTIONS, AUTH_EVENT_ACTIONS, AUTH_EVENT_LABEL, activityLabel, routesMatching, routesOfArea } from "@/lib/activity-labels";
import { ROUTE_RE, actionOf, entityIdOf, routeOf, shouldRecord } from "@/lib/activity-route";

export type ActivityRecord = {
  userId: string;
  method: string;
  pathname: string;
  query: URLSearchParams;
  params: Record<string, string>;
  status: number;
  errorCode: string | null;
  durationMs: number;
  ipHash: string | null;
  requestId: string;
  at: Date;
};

type Row = {
  at: string; userId: string; method: string; route: string; action: string | null; entityId: string | null; status: number;
  errorCode: string | null; durationMs: number; ipHash: string | null; requestId: string;
};

const MAX_BUFFER = 500;
const g = globalThis as unknown as { __wfActivityBuf?: Row[]; __wfActivityFlushing?: Promise<void> | null };
const buf = (): Row[] => (g.__wfActivityBuf ??= []);

/** Ghi tất cả dòng đang chờ bằng MỘT câu INSERT. Không bao giờ ném lỗi (nhật ký hỏng không được làm hỏng thao tác của người dùng). */
export async function flushActivity(): Promise<void> {
  if (g.__wfActivityFlushing) return g.__wfActivityFlushing;
  const rows = buf().splice(0, MAX_BUFFER);
  if (!rows.length) return;
  g.__wfActivityFlushing = (async () => {
    try {
      await withWorker((tx) =>
        tx.q(
          `INSERT INTO public.activity_logs (at, user_id, method, route, action, entity_id, status, error_code, duration_ms, ip_hash, request_id)
           SELECT * FROM unnest($1::timestamptz[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[], $7::smallint[], $8::text[], $9::int[], $10::text[], $11::text[])`,
          [
            rows.map((r) => r.at), rows.map((r) => r.userId), rows.map((r) => r.method), rows.map((r) => r.route), rows.map((r) => r.action),
            rows.map((r) => r.entityId), rows.map((r) => r.status), rows.map((r) => r.errorCode), rows.map((r) => r.durationMs),
            rows.map((r) => r.ipHash), rows.map((r) => r.requestId),
          ],
        ),
      );
    } catch (e) {
      console.error("[activity] không ghi được nhật ký:", (e as Error).message);
    } finally {
      g.__wfActivityFlushing = null;
    }
    if (buf().length) void flushActivity();
  })();
  return g.__wfActivityFlushing;
}

/** Xếp một request vào hàng chờ ghi (đồng bộ, rất rẻ) rồi hẹn ghi sau khi phản hồi đã gửi. */
export function recordActivity(r: ActivityRecord): void {
  try {
    const method = r.method.toUpperCase();
    const route = routeOf(r.pathname, r.params);
    if (!ROUTE_RE.test(route)) return;
    const action = actionOf(method, route, r.query);
    if (!shouldRecord(method, route, r.status, r.errorCode, action)) return;
    const b = buf();
    if (b.length >= MAX_BUFFER * 4) return; // DB chậm/hỏng kéo dài: bỏ bớt, không phình bộ nhớ
    b.push({
      at: r.at.toISOString(), userId: r.userId, method, route, action, entityId: entityIdOf(r.params), status: r.status,
      errorCode: r.errorCode && /^[A-Z0-9-]{1,40}$/.test(r.errorCode) ? r.errorCode : null,
      durationMs: Math.max(0, Math.round(r.durationMs)), ipHash: r.ipHash && /^[0-9a-f]{8,64}$/.test(r.ipHash) ? r.ipHash : null,
      requestId: /^[0-9a-f-]{8,40}$/.test(r.requestId) ? r.requestId : "",
    });
    try {
      after(() => flushActivity());
    } catch {
      void flushActivity(); // ngoài ngữ cảnh request (script/test)
    }
  } catch {
    /* không bao giờ làm hỏng request */
  }
}

// ---------------------------------------------------------------------
// Đọc (RLS: audit.view; API cũng kiểm quyền sớm)
// ---------------------------------------------------------------------
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD");
export const ActivityQuery = z.object({
  userId: z.string().uuid().optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  result: z.enum(["all", "ok", "error"]).optional(),
  area: z.string().trim().max(30).optional(),
  q: z.string().trim().max(80).optional(),
  /** Chỉ sự kiện nhạy cảm (xuất file, in, xem giá vốn/CCCD/báo cáo…) */
  sensitive: z.enum(["1"]).optional(),
  before: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ActivityFilter = z.infer<typeof ActivityQuery>;

export type ActivityPage<T> = { items: T[]; next: string | null };
export type ActivityItem = {
  id: string; at: string; cursor: string; userId: string | null; userName: string; method: string; route: string; label: string;
  area: string; areaLabel: string; action: string | null; actionLabel: string | null; entityId: string | null; status: number; ok: boolean;
  errorCode: string | null; durationMs: number | null; ipTag: string | null; requestId: string | null;
};
export type LoginItem = {
  id: string; at: string; cursor: string; userId: string | null; userName: string; action: string; label: string; tone: "ok" | "bad" | "hold" | "info";
  ipTag: string | null; actorName: string | null;
};

function parseCursor(before?: string): { at: string; id: string } | null {
  if (!before) return null;
  const i = before.lastIndexOf("|");
  if (i < 1) return null;
  const at = before.slice(0, i);
  const id = before.slice(i + 1);
  if (!/^\d{4}-\d{2}-\d{2}[ T][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)?$/.test(at) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { at, id };
}

class Where {
  parts: string[] = [];
  params: unknown[] = [];
  add(sql: string, value: unknown) { this.params.push(value); this.parts.push(sql.replace("?", `$${this.params.length}`)); }
  raw(sql: string) { this.parts.push(sql); }
  get sql() { return this.parts.length ? `WHERE ${this.parts.join(" AND ")}` : ""; }
}

const VN = "'Asia/Ho_Chi_Minh'";
function addRange(w: Where, col: string, f: ActivityFilter) {
  if (f.from) w.add(`${col} >= (?::date)::timestamp AT TIME ZONE ${VN}`, f.from);
  if (f.to) w.add(`${col} < ((?::date) + 1)::timestamp AT TIME ZONE ${VN}`, f.to);
}
const ipTagOf = (h: string | null) => (h ? h.slice(0, 8) : null);
const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function listActivity(tx: Tx, f: ActivityFilter): Promise<ActivityPage<ActivityItem>> {
  const limit = f.limit ?? 40;
  const w = new Where();
  if (f.userId) w.add("a.user_id = ?::uuid", f.userId);
  addRange(w, "a.at", f);
  if (f.result === "ok") w.raw("a.status < 400");
  if (f.result === "error") w.raw("a.status >= 400");
  if (f.sensitive) w.raw("a.action IS NOT NULL");
  if (f.area && f.area !== "all") {
    const { keys, prefixes } = routesOfArea(f.area);
    if (f.area === "other") {
      w.params.push(keys, prefixes.map((p) => p + "%"));
      w.raw(`NOT ((a.method || ' ' || a.route) = ANY($${w.params.length - 1}::text[]) OR a.route LIKE ANY($${w.params.length}::text[]))`);
    } else {
      w.params.push(keys, prefixes.map((p) => p + "%"));
      w.raw(`((a.method || ' ' || a.route) = ANY($${w.params.length - 1}::text[]) OR a.route LIKE ANY($${w.params.length}::text[]))`);
    }
  }
  if (f.q) {
    w.params.push(routesMatching(f.q), `%${esc(f.q)}%`);
    const a = w.params.length - 1;
    const b = w.params.length;
    w.raw(`((a.method || ' ' || a.route) = ANY($${a}::text[]) OR a.route ILIKE $${b})`);
  }
  const cur = parseCursor(f.before);
  if (cur) {
    w.params.push(cur.at, cur.id);
    w.raw(`(a.at, a.id) < ($${w.params.length - 1}::timestamptz, $${w.params.length}::uuid)`);
  }
  w.params.push(limit + 1);
  const rows = await tx.q<{
    id: string; cursor: string; at: Date; user_id: string | null; user_name: string | null; method: string; route: string; action: string | null;
    entity_id: string | null; status: number; error_code: string | null; duration_ms: number | null; ip_hash: string | null; request_id: string | null;
  }>(
    `SELECT a.id, a.at::text AS cursor, a.at, a.user_id, app.user_display_name(a.user_id) AS user_name, a.method, a.route, a.action, a.entity_id,
            a.status, a.error_code, a.duration_ms, a.ip_hash, nullif(a.request_id, '') AS request_id
       FROM public.activity_logs a ${w.sql}
      ORDER BY a.at DESC, a.id DESC
      LIMIT $${w.params.length}`,
    w.params,
  );
  const more = rows.length > limit;
  const items: ActivityItem[] = (more ? rows.slice(0, limit) : rows).map((r) => {
    const l = activityLabel(r.method, r.route, r.action);
    return {
      id: r.id, at: new Date(r.at).toISOString(), cursor: r.cursor, userId: r.user_id, userName: r.user_name ?? "Tài khoản đã xóa",
      method: r.method, route: r.route, label: l.label, area: l.area, areaLabel: l.areaLabel, action: r.action,
      actionLabel: r.action ? (ACTIVITY_ACTIONS[r.action] ?? r.action) : null, entityId: r.entity_id, status: r.status, ok: r.status < 400,
      errorCode: r.error_code, durationMs: r.duration_ms, ipTag: ipTagOf(r.ip_hash), requestId: r.request_id,
    };
  });
  const last = items[items.length - 1];
  return { items, next: more && last ? `${last.cursor}|${last.id}` : null };
}

const FAIL = new Set(["auth.login_failed", "auth.locked", "auth.mfa_failed", "auth.refresh_reuse", "auth.reauth_failed"]);

/** Lịch sử đăng nhập/bảo mật tài khoản: TÁI DÙNG audit_logs (action auth.* do tầng xác thực ghi) — không nhân đôi dữ liệu. */
export async function listLogins(tx: Tx, f: ActivityFilter): Promise<ActivityPage<LoginItem>> {
  const limit = f.limit ?? 40;
  const w = new Where();
  w.add("al.action = ANY(?::text[])", AUTH_EVENT_ACTIONS);
  if (f.userId) {
    w.params.push(f.userId);
    w.raw(`(al.entity_id = $${w.params.length}::text OR al.actor_id = $${w.params.length}::uuid)`);
  }
  addRange(w, "al.at", f);
  if (f.result === "ok") w.add("NOT (al.action = ANY(?::text[]))", [...FAIL]);
  if (f.result === "error") w.add("al.action = ANY(?::text[])", [...FAIL]);
  const cur = parseCursor(f.before);
  if (cur) {
    w.params.push(cur.at, cur.id);
    w.raw(`(al.at, al.id) < ($${w.params.length - 1}::timestamptz, $${w.params.length}::uuid)`);
  }
  w.params.push(limit + 1);
  const rows = await tx.q<{
    id: string; cursor: string; at: Date; action: string; entity_id: string | null; actor_id: string | null; ip_hash: string | null;
    subject_name: string | null; actor_name: string | null;
  }>(
    `SELECT al.id, al.at::text AS cursor, al.at, al.action, al.entity_id, al.actor_id, al.ip_hash,
            app.user_display_name(CASE WHEN al.entity_id ~ '^[0-9a-f-]{36}$' THEN al.entity_id::uuid END) AS subject_name,
            app.user_display_name(al.actor_id) AS actor_name
       FROM public.audit_logs al ${w.sql}
      ORDER BY al.at DESC, al.id DESC
      LIMIT $${w.params.length}`,
    w.params,
  );
  const more = rows.length > limit;
  const items: LoginItem[] = (more ? rows.slice(0, limit) : rows).map((r) => {
    const meta = AUTH_EVENT_LABEL[r.action] ?? { label: r.action, tone: "info" as const };
    const subject = r.subject_name ?? r.actor_name ?? "Không rõ";
    return {
      id: r.id, at: new Date(r.at).toISOString(), cursor: r.cursor, userId: r.entity_id && /^[0-9a-f-]{36}$/.test(r.entity_id) ? r.entity_id : r.actor_id,
      userName: subject, action: r.action, label: meta.label, tone: meta.tone, ipTag: ipTagOf(r.ip_hash),
      // Người thực hiện khác người bị tác động (vd. chủ đặt lại mật khẩu cho nhân viên)
      actorName: r.actor_id && r.actor_name && r.actor_name !== subject ? r.actor_name : null,
    };
  });
  const last = items[items.length - 1];
  return { items, next: more && last ? `${last.cursor}|${last.id}` : null };
}

export type ActivityUser = { userId: string; name: string; total: number; errors: number; lastAt: string };

/** Người có hoạt động trong khoảng ngày (cho ô lọc theo người). */
export async function listActivityUsers(tx: Tx, f: ActivityFilter): Promise<ActivityUser[]> {
  const w = new Where();
  w.raw("a.user_id IS NOT NULL");
  addRange(w, "a.at", f);
  const rows = await tx.q<{ user_id: string; name: string | null; total: number; errors: number; last_at: Date }>(
    `SELECT a.user_id, app.user_display_name(a.user_id) AS name, count(*)::int AS total, (count(*) FILTER (WHERE a.status >= 400))::int AS errors, max(a.at) AS last_at
       FROM public.activity_logs a ${w.sql}
      GROUP BY a.user_id ORDER BY max(a.at) DESC LIMIT 200`,
    w.params,
  );
  return rows.map((r) => ({ userId: r.user_id, name: r.name ?? "Tài khoản đã xóa", total: r.total, errors: r.errors, lastAt: new Date(r.last_at).toISOString() }));
}
