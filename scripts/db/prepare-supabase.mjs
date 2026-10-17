// Chuẩn bị DB Supabase MỚI trước migration đầu tiên — idempotent, chạy lại bao nhiêu lần cũng được.
//  1) Kiểm vai trò đăng nhập có CREATEROLE + BYPASSRLS (CQ-001).
//  2) Tạo sẵn các vai trò wf_* và cấp cho người chạy migration (PostgreSQL 16+ cần SET TRUE, nếu không migration lỗi
//     "must be able to SET ROLE" khi ALTER … OWNER TO) — deploy-staging-production §3.4.
//  3) Đưa extension citext/pg_trgm/unaccent đang nằm ở schema `extensions` về `public` (mã gọi public.unaccent).
// Dùng riêng: node scripts/db/prepare-supabase.mjs --env staging|production   (thường đã gọi trong pnpm db:deploy:<env>)
import { connect, ownerUrl, targetEnv } from "../lib/db.mjs";

const ROLES_DDL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_owner')   THEN CREATE ROLE wf_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_definer') THEN CREATE ROLE wf_definer NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_app')     THEN CREATE ROLE wf_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_auth')    THEN CREATE ROLE wf_auth NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_worker')  THEN CREATE ROLE wf_worker NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_api')     THEN CREATE ROLE wf_api LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_backup')  THEN CREATE ROLE wf_backup NOLOGIN BYPASSRLS; END IF;
END $$;`;

export async function prepareSupabase(c, log = console.log) {
  const me = (await c.query(`SELECT current_user AS usr, current_setting('server_version_num')::int AS vnum, r.rolcreaterole AS cr, r.rolbypassrls AS bp, r.rolsuper AS su
                             FROM pg_roles r WHERE r.rolname = current_user`)).rows[0];
  if (!me.cr && !me.su) throw new Error(`Vai trò ${me.usr} không có CREATEROLE — không tạo được vai trò wf_*. Dừng.`);
  if (!me.bp && !me.su) throw new Error(`Vai trò ${me.usr} không có BYPASSRLS (CQ-001): thiết kế wf_definer/wf_worker/wf_backup cần BYPASSRLS. Dừng và báo chủ dự án.`);

  const before = new Set((await c.query(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'wf\\_%'`)).rows.map((r) => r.rolname));
  await c.query(ROLES_DDL);
  const members = "wf_owner, wf_definer, wf_app, wf_auth, wf_worker, wf_backup"; // wf_api KHÔNG cấp cho người chạy migration
  // PG16+: INHERIT TRUE *và* SET TRUE. Migration đổi chủ sở hữu schema/bảng/hàm sang wf_owner rồi vẫn tiếp tục
  // CREATE/ALTER trên chúng; người chạy (postgres của Supabase, KHÔNG phải superuser) chỉ làm được nếu thừa hưởng quyền
  // của wf_owner. INHERIT FALSE (như bản nháp tài liệu) ⇒ "permission denied for schema app" ở 0001.
  await c.query(me.vnum >= 160000 ? `GRANT ${members} TO CURRENT_USER WITH INHERIT TRUE, SET TRUE` : `GRANT ${members} TO CURRENT_USER`);
  const created = ["wf_owner", "wf_definer", "wf_app", "wf_auth", "wf_worker", "wf_api", "wf_backup"].filter((r) => !before.has(r));
  log(`✔ vai trò wf_*: ${created.length ? "đã tạo " + created.join(", ") : "đã đủ"} · quyền SET ROLE cho ${me.usr} (PostgreSQL ${Math.floor(me.vnum / 10000)})`);

  const moved = [];
  for (const e of (await c.query(`SELECT extname FROM pg_extension WHERE extname IN ('citext','pg_trgm','unaccent') AND extnamespace::regnamespace::text <> 'public'`)).rows) {
    await c.query(`ALTER EXTENSION "${e.extname}" SET SCHEMA public`);
    moved.push(e.extname);
  }
  log(moved.length ? `✔ đã chuyển extension về schema public: ${moved.join(", ")}` : "✔ extension: không cần chuyển");
  return { created, moved };
}

const isMain = process.argv[1] && /prepare-supabase\.mjs$/.test(process.argv[1]);
if (isMain) {
  const env = targetEnv();
  if (env === "local") { console.error("Chỉ dùng cho staging|production: --env staging"); process.exit(1); }
  const c = await connect(ownerUrl({ env }));
  try { await prepareSupabase(c); } catch (e) { console.error("✘ " + e.message); process.exitCode = 1; } finally { await c.end(); }
}
