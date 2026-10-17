// Dẫn xuất BƯỚC 3 từ BƯỚC 1, kiểm đủ biến, (tùy chọn --ping) thử nối DB Supabase. Không in giá trị bí mật.
// Dùng: pnpm env:check staging|production [--ping] [--no-write]
import { hasFlag } from "../lib/env.mjs";
import { ENVS, refresh, printResults } from "../lib/envfile.mjs";
import { connect } from "../lib/db.mjs";

export async function pingOwner(env, url = process.env.MIGRATE_DATABASE_URL) {
  const c = await connect(url);
  try {
    const me = (await c.query(`SELECT current_user AS usr, current_setting('server_version') AS ver, r.rolcreaterole AS cr, r.rolbypassrls AS bp, r.rolsuper AS su
                               FROM pg_roles r WHERE r.rolname = current_user`)).rows[0];
    const ext = (await c.query(`SELECT extname, extnamespace::regnamespace::text AS sch FROM pg_extension WHERE extname IN ('citext','pg_trgm','unaccent') ORDER BY 1`)).rows;
    const roles = (await c.query(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'wf\\_%' ORDER BY 1`)).rows.map((r) => r.rolname);
    const mig = (await c.query(`SELECT to_regclass('public.app_migrations') IS NOT NULL AS has`)).rows[0].has;
    const n = mig ? Number((await c.query(`SELECT count(*) AS n FROM public.app_migrations`)).rows[0].n) : 0;
    console.log(`\n  Nối DB (${env}) thành công:`);
    console.log(`    PostgreSQL ${me.ver} · đăng nhập bằng ${me.usr} · CREATEROLE=${me.cr} · BYPASSRLS=${me.bp}${me.su ? " · superuser" : ""}`);
    console.log(`    extension: ${ext.length ? ext.map((e) => `${e.extname}@${e.sch}`).join(", ") : "(chưa có — migration sẽ tạo)"}`);
    console.log(`    vai trò wf_*: ${roles.length ? roles.join(", ") : "(chưa có — db:deploy sẽ tạo)"}`);
    console.log(`    migration đã áp: ${n}`);
    const bad = [];
    if (!me.cr && !me.su) bad.push("vai trò đăng nhập thiếu CREATEROLE");
    if (!me.bp && !me.su) bad.push("vai trò đăng nhập thiếu BYPASSRLS (CQ-001) — DỪNG, báo chủ dự án");
    for (const e of ext) if (e.sch !== "public") bad.push(`extension ${e.extname} đang ở schema ${e.sch} (phải public) — db:deploy sẽ tự sửa`);
    for (const b of bad) console.log(`    ⚠ ${b}`);
    return bad.filter((b) => !b.includes("tự sửa")).length === 0;
  } finally {
    await c.end();
  }
}

export function explainDbError(e) {
  const m = String(e.message || e);
  if (/Tenant or user not found/i.test(m)) return "Pooler không nhận ra project: sai SB_PROJECT_REF hoặc SB_POOLER_HOST (thử đổi aws-0 ↔ aws-1 theo đúng nút Connect).";
  if (/password authentication failed/i.test(m)) return "Sai mật khẩu: kiểm SB_DB_PASSWORD (hoặc Reset database password trong dashboard rồi điền lại).";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return "Không phân giải được host: kiểm SB_POOLER_HOST (phải là host pooler, KHÔNG dùng db.<ref>.supabase.co vì chỉ có IPv6).";
  if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(m)) return "Hết thời gian/ bị từ chối: kiểm mạng/tường lửa và Network Restrictions của Supabase.";
  if (/certificate|self.signed|SSL/i.test(m)) return "Lỗi chứng chỉ TLS: kiểm certs/supabase-root-2021-ca.crt và SB_CA_FILE.";
  return null;
}

const isMain = process.argv[1] && /check-env\.mjs$/.test(process.argv[1]);
if (isMain) {
  const env = process.argv[2];
  if (!ENVS.includes(env)) { console.error("Dùng: pnpm env:check staging|production [--ping] [--no-write]"); process.exit(1); }
  let r;
  try { r = refresh(env, { write: !hasFlag("--no-write") }); } catch (e) { console.error("✘ " + e.message); process.exit(1); }
  console.log(`\nKiểm .env.${env}:`);
  const pass = printResults(r.results);
  if (pass && hasFlag("--ping")) {
    try { await pingOwner(env); } catch (e) { console.error(`\n  ✘ Không nối được DB: ${e.message}`); const h = explainDbError(e); if (h) console.error(`    → ${h}`); process.exit(1); }
  } else if (!pass) {
    console.log("\n  Sửa các mục ✘ ở BƯỚC 1 trong file rồi chạy lại lệnh này.");
  }
  process.exit(pass ? 0 : 1);
}
