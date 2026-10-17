// pnpm test:e2e — dựng lại DB watchflow_e2e (migrate + seed demo), chạy máy chủ thử cổng 3300 (distDir .next-e2e), chạy Playwright.
// Tham số sau "--" chuyển cho Playwright (vd. pnpm test:e2e -- --project=mobile-390 -g POS).
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, loadEnv } from "./lib/env.mjs";
import { start as pgStart, superuserUrl, PG_PORT } from "./db/pg.mjs";
import { dropDatabase, ensureDatabase, connect } from "./lib/db.mjs";
import { migrate } from "./db/migrate.mjs";
import { seed } from "./db/seed.mjs";

const DB = "watchflow_e2e";
const PORT = 3300;
loadEnv("local");
pgStart({ quiet: true });
await dropDatabase(DB);
await ensureDatabase(DB);
const ownerUrl = superuserUrl(DB);
{ const c = await connect(ownerUrl); await c.query(`ALTER DATABASE ${DB} SET app.env = 'test'`); await c.end(); }
await migrate({ url: ownerUrl, apiPassword: process.env.WF_API_PASSWORD, log: () => {} });
const accounts = await seed({ url: ownerUrl, log: () => {} });
console.log(`✔ DB ${DB} sẵn sàng`);

const apiUrl = `postgres://wf_api:${encodeURIComponent(process.env.WF_API_PASSWORD)}@127.0.0.1:${PG_PORT}/${DB}`;
const env = { ...process.env, DATABASE_URL: apiUrl, NEXT_DIST_DIR: ".next-e2e", COOKIE_SECURE: "false", NEXT_TELEMETRY_DISABLED: "1", WF_ENABLE_DEV_DESIGN: "1", WF_TEST_MODE: "1" };
const server = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
process.on("exit", () => server.kill());
const t0 = Date.now();
for (;;) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) break; } catch { /* chờ */ }
  if (Date.now() - t0 > 180_000) { console.error(log.slice(-3000)); process.exit(1); }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`✔ Máy chủ e2e http://127.0.0.1:${PORT}`);
const args = process.argv.slice(2).filter((a) => a !== "--");
const pw = spawn(process.execPath, [path.join(ROOT, "node_modules", "@playwright", "test", "cli.js"), "test", ...args], {
  cwd: ROOT, stdio: "inherit",
  env: { ...process.env, E2E_BASE_URL: `http://127.0.0.1:${PORT}`, E2E_ACCOUNTS: JSON.stringify(accounts), E2E_OWNER_DB_URL: ownerUrl },
});
const code = await new Promise((r) => pw.on("exit", r));
server.kill();
{ const fs = await import("node:fs"); fs.mkdirSync("test-results", { recursive: true }); fs.writeFileSync("test-results/e2e-server.log", log); }
process.exit(code ?? 1);
