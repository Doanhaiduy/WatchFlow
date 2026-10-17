// Đẩy biến môi trường từ .env.<env> lên Vercel bằng CLI (khỏi dán tay trên dashboard). Biến bí mật đặt kiểu Sensitive.
//   staging    → môi trường Preview, GIỚI HẠN theo nhánh `staging`
//   production → môi trường Production
// Dùng: pnpm vercel:env:staging | vercel:env:production   [-- --dry-run] [--only TÊN_BIẾN]
// Yêu cầu: đã `vercel login` và `vercel link --yes --project watchflow` (thư mục .vercel/); nhánh `staging` đã có trên GitHub.
// Chạy lại bao nhiêu lần cũng được (--force ghi đè). Giá trị đi qua stdin — không xuất hiện trên màn hình hay trong lệnh.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, argValue, hasFlag } from "../lib/env.mjs";
import { ENVS, refresh, printResults } from "../lib/envfile.mjs";

const env = process.argv[2];
const die = (m) => { console.error("✘ " + m); process.exit(1); };
if (!ENVS.includes(env)) die("Dùng: pnpm vercel:env:staging | vercel:env:production");
if (!fs.existsSync(path.join(ROOT, ".vercel", "project.json"))) die("Chưa liên kết Vercel. Chạy: vercel link --yes --project watchflow");

const { vars, results } = refresh(env);
if (!printResults(results, { quiet: true })) die(`.env.${env} chưa đạt — chạy pnpm env:check ${env} và sửa các mục ✘.`);

// [tên, bí mật?, tùy chọn?]
const VARS = [
  ["DATABASE_URL", true], ["DB_SSL_CA", false], ["DB_POOL_MAX", false], ["DB_AUX_POOL_MAX", false],
  ["AUTH_JWT_PRIVATE_KEY", true], ["AUTH_JWT_PUBLIC_KEY", false], ["AUTH_JWT_KID", false],
  ["PII_KEY_V1", true], ["PII_BIDX_KEY", true], ["CRON_SECRET", true], ["OPS_HEARTBEAT_SECRET", true],
  ["STORAGE_DRIVER", false], ["SUPABASE_URL", false], ["SUPABASE_SERVICE_ROLE_KEY", true],
  ["VAPID_PUBLIC_KEY", false], ["VAPID_PRIVATE_KEY", true], ["VAPID_SUBJECT", false],
  ["NEXT_PUBLIC_APP_URL", false, true], ["OPS_REQUIRE_BACKUP_HEARTBEAT", false, true],
];
const target = env === "staging" ? ["preview", "staging"] : ["production"];
const only = argValue("--only");
const dry = hasFlag("--dry-run");
console.log(`\nĐẩy biến lên Vercel → ${env === "staging" ? "Preview (nhánh staging)" : "Production"}${dry ? " [dry-run]" : ""}\n`);

let okN = 0, skipN = 0, failN = 0, planN = 0;
for (const [name, secret, optional] of VARS) {
  if (only && only !== name) continue;
  const raw = vars[name];
  if (!raw) {
    if (optional) { console.log(`  – ${name.padEnd(30)} bỏ qua (chưa có giá trị${name === "NEXT_PUBLIC_APP_URL" ? " — điền APP_URL rồi chạy lại" : ""})`); skipN++; continue; }
    console.error(`  ✘ ${name.padEnd(30)} trống`); failN++; continue;
  }
  const value = raw.replace(/\r?\n/g, "\\n"); // PEM/CA một dòng với \n (ứng dụng tự đổi lại)
  if (dry) { console.log(`  ○ ${name.padEnd(30)} ${secret ? "Sensitive" : "plain    "} (${value.length} ký tự)`); planN++; continue; }
  const r = spawnSync("vercel", ["env", "add", name, ...target, "--force", ...(secret ? ["--sensitive"] : [])], {
    input: value, encoding: "utf8", shell: process.platform === "win32",
  });
  if (r.status === 0) { console.log(`  ✔ ${name.padEnd(30)} ${secret ? "Sensitive" : "plain"}`); okN++; }
  else { console.error(`  ✘ ${name.padEnd(30)} ${(r.stderr || r.stdout || "").split("\n").find((l) => /error/i.test(l)) || "lỗi không rõ"}`); failN++; }
}
console.log(`\n${dry ? "Sẽ đặt" : "Đã đặt"} ${dry ? planN : okN} biến · bỏ qua ${skipN} · lỗi ${failN}`);
if (failN) process.exit(1);
if (!dry) console.log(env === "staging"
  ? "Tiếp theo: git push origin staging (hoặc Vercel dashboard → Deployments → Redeploy nếu đã có bản build trước đó)."
  : "Tiếp theo: gộp staging vào main và push main (Vercel tự build Production).");
