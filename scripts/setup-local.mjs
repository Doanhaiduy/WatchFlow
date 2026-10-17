// Dựng môi trường local: khởi động PG, sinh .env.local (chỉ trỏ DB local), tạo DB watchflow, migrate, seed demo.
// --reset: XÓA DB local watchflow (dữ liệu giả) và dựng lại.
import fs from "node:fs";
import path from "node:path";
import { ROOT, hasFlag, parseEnv, loadEnv } from "./lib/env.mjs";
import { start, PG_PORT, superuserPassword } from "./db/pg.mjs";
import { genKeys, toEnvLines } from "./env/gen-keys.mjs";
import { ensureDatabase, dropDatabase } from "./lib/db.mjs";
import { migrate } from "./db/migrate.mjs";
import { seed } from "./db/seed.mjs";

const ENV_FILE = path.join(ROOT, ".env.local");
const DB = "watchflow";

start();
let env = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, "utf8")) : {};
if (!env.AUTH_JWT_PRIVATE_KEY || !env.WF_API_PASSWORD) {
  const k = genKeys();
  const lines = [
    "# .env.local — SINH TỰ ĐỘNG bởi setup:local. CHỈ trỏ DB local. KHÔNG commit.",
    `DATABASE_URL="postgres://wf_api:${k.WF_API_PASSWORD}@127.0.0.1:${PG_PORT}/${DB}"`,
    `MIGRATE_DATABASE_URL="postgres://postgres:${encodeURIComponent(superuserPassword())}@127.0.0.1:${PG_PORT}/${DB}"`,
    "ALLOW_REMOTE_DB=false",
    "STORAGE_DRIVER=local",
    "COOKIE_SECURE=false",
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    toEnvLines(k),
  ];
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n");
  console.log("✔ Đã sinh .env.local (khóa mới, chỉ trỏ DB local).");
}
loadEnv("local", { override: true });
if (hasFlag("--reset")) { await dropDatabase(DB); console.log(`✔ Đã xóa DB local ${DB}.`); fs.rmSync(path.join(ROOT, ".local", "storage"), { recursive: true, force: true }); }
if (await ensureDatabase(DB)) console.log(`✔ Đã tạo DB ${DB}.`);
const ownerUrl = `postgres://postgres:${encodeURIComponent(superuserPassword())}@127.0.0.1:${PG_PORT}/${DB}`;
await migrate({ url: ownerUrl, apiPassword: process.env.WF_API_PASSWORD });
const acc = await seed({ url: ownerUrl });
console.log(`\nXong. Chạy: pnpm dev → http://localhost:3000\nTài khoản demo (mật khẩu chung ${acc.password}) — xem .local/demo-accounts.txt`);
