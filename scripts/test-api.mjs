// Test tích hợp trên DB thật + máy chủ thử cổng 3100 (dev-setup §3). Dựng lại DB watchflow_test (dữ liệu giả) mỗi lần.
// Dùng: pnpm test:api [-- --only <tên bộ>] [--no-server] [--keep]
//   --only pt07     chỉ chạy tests/api/*pt07*.test.mjs
//   --no-server     chỉ chạy bộ DB (bỏ qua bộ cần HTTP)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { ROOT, argValue, hasFlag, loadEnv } from "./lib/env.mjs";
import { start as pgStart, superuserUrl, PG_PORT } from "./db/pg.mjs";
import { dropDatabase, ensureDatabase, connect } from "./lib/db.mjs";
import { migrate } from "./db/migrate.mjs";
import { seed } from "./db/seed.mjs";
import { auditDb } from "./db/audit.mjs";

// Chạy song song nhiều bản (vd. nhiều người/agent): đặt TEST_API_SUFFIX=a ⇒ DB watchflow_test_a, distDir .next-test-a; TEST_API_PORT đổi cổng.
const SUFFIX = (process.env.TEST_API_SUFFIX || "").replace(/[^a-z0-9]/g, "");
const DB = SUFFIX ? `watchflow_test_${SUFFIX}` : "watchflow_test";
const PORT = Number(process.env.TEST_API_PORT || 3100);
// Bộ gửi thông báo đẩy GIẢ (src/server/push.ts): ghi tin vào tệp này thay vì gọi dịch vụ đẩy của trình duyệt
const PUSH_FAKE_FILE = path.join(os.tmpdir(), `wf-push-fake${SUFFIX ? "-" + SUFFIX : ""}.jsonl`);
fs.rmSync(PUSH_FAKE_FILE, { force: true });
const DIST = SUFFIX ? `.next-test-${SUFFIX}` : ".next-test";
loadEnv("local");
if (!process.env.WF_API_PASSWORD) { console.error("Chưa có .env.local — chạy pnpm setup:local trước."); process.exit(1); }

pgStart({ quiet: true });
await dropDatabase(DB);
await ensureDatabase(DB);
const ownerUrl = superuserUrl(DB);
{
  const c = await connect(ownerUrl);
  await c.query(`ALTER DATABASE ${DB} SET app.env = 'test'`);
  await c.end();
}
await migrate({ url: ownerUrl, apiPassword: process.env.WF_API_PASSWORD, log: () => {} });
const accounts = await seed({ url: ownerUrl, log: () => {} });
{
  const c = await connect(ownerUrl);
  const v = await auditDb(c);
  await c.end();
  if (v.length) { console.error("✘ db:audit trên DB test:\n  " + v.join("\n  ")); process.exit(1); }
}
console.log(`✔ DB test ${DB} sẵn sàng (migrate + seed + audit sạch)`);

const only = argValue("--only");
const files = fs.readdirSync(path.join(ROOT, "tests", "api")).filter((f) => f.endsWith(".test.mjs") && (!only || f.includes(only))).sort();
const needServer = !hasFlag("--no-server") && files.some((f) => !f.startsWith("db-"));
const apiUrl = `postgres://wf_api:${encodeURIComponent(process.env.WF_API_PASSWORD)}@127.0.0.1:${PG_PORT}/${DB}`;

let server;
if (needServer) {
  const env = { ...process.env, DATABASE_URL: apiUrl, NEXT_DIST_DIR: DIST, COOKIE_SECURE: "false", PORT: String(PORT), NEXT_TELEMETRY_DISABLED: "1", WF_ENABLE_DEV_DESIGN: "1", WF_TEST_MODE: "1", WF_PUSH_FAKE: "1", WF_PUSH_FAKE_FILE: PUSH_FAKE_FILE };
  server = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.status === 200) break;
    } catch { /* chưa sẵn sàng */ }
    if (Date.now() - t0 > 180_000) { console.error("Máy chủ thử không lên sau 180 giây:\n" + log.slice(-3000)); server.kill(); process.exit(1); }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`✔ Máy chủ thử http://127.0.0.1:${PORT} (${Math.round((Date.now() - t0) / 1000)} giây)`);
  process.on("exit", () => server?.kill());
}

const testEnv = {
  ...process.env,
  TEST_BASE_URL: `http://127.0.0.1:${PORT}`,
  TEST_OWNER_DB_URL: ownerUrl,
  TEST_API_DB_URL: apiUrl,
  TEST_ACCOUNTS: JSON.stringify(accounts),
  TEST_NO_SERVER: needServer ? "" : "1",
  WF_PUSH_FAKE_FILE: PUSH_FAKE_FILE,
};
const runFiles = files.filter((f) => needServer || f.startsWith("db-")).map((f) => path.join("tests", "api", f));
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=spec", ...runFiles], { cwd: ROOT, env: testEnv, stdio: "inherit" });
const code = await new Promise((r) => child.on("exit", r));
server?.kill();
process.exit(code ?? 1);
