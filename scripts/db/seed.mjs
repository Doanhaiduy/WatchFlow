// Nạp dữ liệu DEMO (giả) — chỉ local/staging, TỪ CHỐI production. Chạy các bước db/seed/NN_*.mjs theo thứ tự.
// Dùng: node scripts/db/seed.mjs [--db <tên>] [--env staging]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ROOT, argValue, loadEnv } from "../lib/env.mjs";
import { ownerUrl, connect, targetEnv } from "../lib/db.mjs";

export async function seed({ url, log = console.log, only, env = "local" } = {}) {
  if (env === "local") loadEnv("local"); // staging: khóa PII/JWT phải là của .env.staging (đã nạp bởi ownerUrl), không lẫn khóa local
  const c = await connect(url);
  const suffix = env === "local" ? "" : "-" + env; // mỗi môi trường một bộ tài khoản demo riêng
  const accFile = path.join(ROOT, ".local", `demo-accounts${suffix}.json`);
  let accounts = fs.existsSync(accFile) ? JSON.parse(fs.readFileSync(accFile, "utf8")) : null;
  if (!accounts) {
    accounts = { password: "Demo-" + crypto.randomBytes(6).toString("base64url"), totpSecret: null };
  }
  const ctx = { accounts, env: process.env, log };
  try {
    const dir = path.join(ROOT, "db", "seed");
    for (const f of fs.readdirSync(dir).filter((f) => /^\d+_.*\.mjs$/.test(f)).sort()) {
      if (only && !f.includes(only)) continue;
      const mod = await import(pathToFileURL(path.join(dir, f)).href);
      await c.query("BEGIN");
      try { await mod.default(c, ctx); await c.query("COMMIT"); log(`✔ seed ${f}`); }
      catch (e) { await c.query("ROLLBACK"); throw new Error(`seed ${f}: ${e.message}`); }
    }
  } finally { await c.end(); }
  fs.mkdirSync(path.dirname(accFile), { recursive: true });
  fs.writeFileSync(accFile, JSON.stringify(ctx.accounts, null, 2));
  const txt = [
    `# Tài khoản DEMO (dữ liệu giả, môi trường ${env}) — mật khẩu chung: ` + ctx.accounts.password,
    ...(ctx.accounts.users || []).map((u) => `${u.role.padEnd(13)} ${u.email}`),
    "Chủ cửa hàng bật xác thực 2 bước — khóa TOTP (thêm vào ứng dụng Authenticator): " + ctx.accounts.totpSecret,
    "Mã khôi phục chủ (dùng một lần): " + (ctx.accounts.recoveryCodes || []).join(" "),
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, ".local", `demo-accounts${suffix}.txt`), txt + "\n");
  return ctx.accounts;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("db", "seed.mjs"))) {
  const env = targetEnv();
  if (env === "production") { console.error("Từ chối: không nạp dữ liệu demo lên production."); process.exit(1); }
  const accounts = await seed({ url: ownerUrl({ env, dbName: argValue("--db") }), only: argValue("--only"), env }).catch((e) => { console.error(e.message); process.exit(1); });
  console.log(`Tài khoản demo: .local/demo-accounts${env === "local" ? "" : "-" + env}.txt (mật khẩu chung ${accounts.password})`);
}
