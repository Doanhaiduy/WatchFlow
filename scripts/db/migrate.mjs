// Áp migration db/migrations/*.sql theo thứ tự; ghi app_migrations (tên + sha256). Mỗi file một transaction (tự BEGIN/COMMIT).
// Dùng: node scripts/db/migrate.mjs [--dry-run] [--env local|staging|production] [--db <tên>] [--api-password <pw>]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT, hasFlag, argValue } from "../lib/env.mjs";
import { ownerUrl, connect, targetEnv } from "../lib/db.mjs";

const DIR = path.join(ROOT, "db", "migrations");

export async function migrate({ url, dryRun = false, apiPassword, log = console.log } = {}) {
  const c = await connect(url);
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS public.app_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Map((await c.query("SELECT name, sha256 FROM public.app_migrations")).rows.map((r) => [r.name, r.sha256]));
    const files = fs.readdirSync(DIR).filter((f) => /^\d{4}[a-z]?_.*\.sql$/.test(f)).sort();
    let applied = 0;
    for (const f of files) {
      const sql = fs.readFileSync(path.join(DIR, f), "utf8");
      const sha = crypto.createHash("sha256").update(sql).digest("hex");
      if (done.get(f) === sha) continue;
      const why = done.has(f) ? "sha256 đổi — chạy lại" : "mới";
      if (dryRun) { log(`[dry-run] sẽ áp ${f} (${why})`); applied++; continue; }
      const t0 = Date.now();
      try {
        await c.query(sql);
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw new Error(`Lỗi khi áp ${f}: ${e.message}${e.where ? "\n  tại: " + e.where : ""}`);
      }
      await c.query(`INSERT INTO public.app_migrations (name, sha256) VALUES ($1,$2)
                     ON CONFLICT (name) DO UPDATE SET sha256=EXCLUDED.sha256, applied_at=now()`, [f, sha]);
      log(`✔ ${f} (${why}, ${Date.now() - t0} ms)`);
      applied++;
    }
    if (!dryRun && apiPassword) {
      await c.query(`ALTER ROLE wf_api WITH LOGIN PASSWORD ${c.escapeLiteral(apiPassword)}`);
    }
    if (!applied) log("Không có migration mới.");
    return applied;
  } finally {
    await c.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("db", "migrate.mjs"));
if (isMain) {
  const env = targetEnv();
  const dbName = argValue("--db");
  const url = ownerUrl({ env, dbName });
  let apiPassword = argValue("--api-password");
  if (!apiPassword && env === "local" && process.env.DATABASE_URL) apiPassword = decodeURIComponent(new URL(process.env.DATABASE_URL).password || "") || undefined;
  console.log(`Migrate → ${env}${dbName ? " / " + dbName : ""}${hasFlag("--dry-run") ? " (dry-run)" : ""}`);
  migrate({ url, dryRun: hasFlag("--dry-run"), apiPassword }).catch((e) => { console.error(e.message); process.exit(1); });
}
