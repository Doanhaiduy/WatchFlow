// Bộ kiểm cấu trúc DB (S1…S12) — security-model §9, migrations §3. Trả mã 1 nếu có vi phạm.
import path from "node:path";
import { argValue } from "../lib/env.mjs";
import { ownerUrl, connect } from "../lib/db.mjs";

// Bảng append-only bắt buộc có tg_immutable + tg_no_truncate (thêm khi có bảng mới)
export const APPEND_ONLY = ["audit_logs", "unit_status_history", "unit_price_history", "unit_movements", "unit_cost_entries",
  "part_stock_movements", "repair_status_history", "sale_line_costs", "repair_line_costs", "activity_logs"];
// Bảng không cần trigger audit (kỹ thuật/append-only/nhật ký)
const NO_AUDIT = new Set(["audit_logs", "app_migrations", "number_sequences", "domain_events", "notifications", "job_runs", "error_events",
  "rate_limit_hits", "push_subscriptions", "push_outbox", "idempotency_keys", "ops_heartbeats", "auth_sessions", "refresh_tokens", "trusted_devices", "permissions", "role_permissions", "user_roles",
  "settings", ...APPEND_ONLY]);
// Cột wf_app tuyệt đối không được UPDATE trực tiếp (mass-assignment, B1/B5)
const PROTECTED_COLS = [["watch_units", "status"], ["watch_units", "held_by_collaborator_id"], ["users", "status"], ["users", "must_change_password"],
  ["users", "email_verified_at"], ["files", "purge_after"], ["files", "purged_at"], ["files", "deleted_at"], ["users", "password_hash"], ["user_roles", "role_id"]];

export async function auditDb(client) {
  const v = [];
  const add = (code, msg) => v.push(`${code} ${msg}`);
  const q = async (sql, p) => (await client.query(sql, p)).rows;

  for (const r of await q(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) owner
                           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')`)) {
    if (!r.relrowsecurity || !r.relforcerowsecurity) add("S1", `bảng ${r.relname} thiếu ENABLE/FORCE RLS`);
    if (r.owner !== "wf_owner") add("S5", `bảng ${r.relname} owner=${r.owner} (phải wf_owner)`);
  }
  for (const r of await q(`SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' f, p.proconfig, pg_get_userbyid(p.proowner) owner
                           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','public') AND p.prosecdef`)) {
    if (!(r.proconfig || []).some((x) => x.startsWith("search_path="))) add("S2", `hàm SECURITY DEFINER ${r.f} thiếu SET search_path`);
    if (r.owner !== "wf_definer") add("S6", `hàm SECURITY DEFINER ${r.f} owner=${r.owner} (phải wf_definer)`);
  }
  for (const r of await q(`SELECT n.nspname||'.'||p.proname f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                           WHERE n.nspname='app' AND has_function_privilege('public', p.oid, 'EXECUTE')`)) add("S3", `hàm ${r.f} cấp EXECUTE cho PUBLIC`);
  // S4: mọi FK có index với cột đầu khớp
  for (const r of await q(`SELECT c.conrelid::regclass::text tbl, c.conname, c.conkey FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                           WHERE c.contype='f' AND n.nspname='public'
                           AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND (i.indkey::int2[])[0:cardinality(c.conkey)-1] = c.conkey)`))
    add("S4", `FK ${r.conname} trên ${r.tbl} thiếu index`);
  for (const r of await q(`SELECT table_name, grantee FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')`))
    add("S7", `bảng ${r.table_name} cấp quyền cho ${r.grantee}`);
  for (const [t, col] of PROTECTED_COLS) {
    const ex = await q(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1`, [t]);
    if (!ex.length) continue;
    const r = await q(`SELECT has_column_privilege('wf_app', $1, $2, 'UPDATE') u`, [`public.${t}`, col]);
    if (r[0].u) add("S8", `wf_app được UPDATE ${t}.${col}`);
  }
  for (const r of await q(`SELECT table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='wf_api'`))
    add("S10", `wf_api có quyền trực tiếp trên ${r.table_name}`);
  const trig = await q(`SELECT c.relname tbl, p.proname fn FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
                        JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='public' AND NOT t.tgisinternal`);
  const has = (tbl, fn) => trig.some((x) => x.tbl === tbl && x.fn === fn);
  const tables = (await q(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`)).map((r) => r.relname);
  for (const t of APPEND_ONLY.filter((t) => tables.includes(t))) {
    // activity_logs: DELETE chỉ qua app.fn_activity_purge ⇒ dùng tg_activity_immutable (cùng ý nghĩa, có ngoại lệ cho hàm dọn)
    if (!has(t, "tg_immutable") && !has(t, "tg_activity_immutable")) add("S11", `bảng append-only ${t} thiếu tg_immutable`);
    if (!has(t, "tg_no_truncate")) add("S11", `bảng append-only ${t} thiếu tg_no_truncate`);
  }
  for (const t of tables) if (!NO_AUDIT.has(t) && !has(t, "tg_audit")) add("S12", `bảng ${t} thiếu trigger tg_audit`);
  // S9: không còn hàm app.* có search_path mutable dùng bởi definer — (bao bởi S2). S9 kiểm view: security_invoker
  for (const r of await q(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
                           AND NOT coalesce((SELECT bool_or(o = 'security_invoker=true' OR o='security_invoker=on') FROM unnest(c.reloptions) o), false)`))
    add("S9", `view ${r.relname} thiếu security_invoker (sẽ bỏ qua RLS)`);
  return v;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("db", "audit.mjs"));
if (isMain) {
  const c = await connect(ownerUrl({ dbName: argValue("--db") }));
  try {
    const v = await auditDb(c);
    if (v.length) { console.error(`✘ db:audit — ${v.length} vi phạm:\n  ` + v.join("\n  ")); process.exitCode = 1; }
    else console.log("✔ db:audit sạch (S1–S12).");
  } finally { await c.end(); }
}
