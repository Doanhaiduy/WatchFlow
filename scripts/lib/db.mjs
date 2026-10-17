// Kết nối DB cho script (quyền chủ DB). Mặc định local; --env staging|production đọc .env.<env> (MIGRATE_DATABASE_URL).
import pg from "pg";
import { loadEnv, argValue, assertLocalUrl } from "./env.mjs";
import { superuserUrl } from "../db/pg.mjs";

export function targetEnv() { return argValue("--env", "local"); }

/** Chuỗi kết nối chủ DB cho môi trường đích. dbName ghi đè tên DB (vd. watchflow_test). */
export function ownerUrl({ env = targetEnv(), dbName } = {}) {
  let url;
  if (env === "local") {
    loadEnv("local");
    url = superuserUrl(dbName || dbNameFromEnv() || "watchflow");
  } else {
    const vars = loadEnv(env, { override: true });
    url = vars.MIGRATE_DATABASE_URL;
    if (!url) throw new Error(`Thiếu MIGRATE_DATABASE_URL trong .env.${env}`);
  }
  assertLocalUrl(url, { allowRemote: env !== "local" });
  if (dbName && env !== "local") { const u = new URL(url); u.pathname = "/" + dbName; url = u.toString(); }
  return url;
}

function dbNameFromEnv() {
  try { return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : undefined; } catch { return undefined; }
}

/** Cấu hình kết nối: DB local để trần; DB ngoài máy BẮT BUỘC TLS có kiểm chứng chỉ bằng DB_SSL_CA (giống src/server/db.ts). */
export function connConfig(url) {
  const u = new URL(url);
  if (["127.0.0.1", "localhost", "::1"].includes(u.hostname)) return { connectionString: url };
  const ca = process.env.DB_SSL_CA;
  if (!ca) throw new Error("DB ngoài máy cần TLS có kiểm chứng chỉ: thiếu DB_SSL_CA — chạy `pnpm env:check <staging|production>` để dẫn xuất từ certs/supabase-root-2021-ca.crt.");
  u.searchParams.delete("sslmode");
  u.searchParams.delete("sslrootcert");
  return { connectionString: u.toString(), ssl: { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true } };
}

export async function connect(url) {
  const c = new pg.Client({ ...connConfig(url), application_name: "wf-script" });
  await c.connect();
  return c;
}

export async function ensureDatabase(name) {
  const c = await connect(superuserUrl("postgres"));
  try {
    const r = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
    if (!r.rowCount) await c.query(`CREATE DATABASE "${name.replace(/"/g, "")}" ENCODING 'UTF8' TEMPLATE template0`);
    return !r.rowCount;
  } finally { await c.end(); }
}

export async function dropDatabase(name) {
  const c = await connect(superuserUrl("postgres"));
  try { await c.query(`DROP DATABASE IF EXISTS "${name.replace(/"/g, "")}" WITH (FORCE)`); } finally { await c.end(); }
}
