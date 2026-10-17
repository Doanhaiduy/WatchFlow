// MỘT LỆNH để đưa DB staging/production lên đúng phiên bản của mã — dùng cho lần đầu VÀ mọi lần phát hành sau (idempotent).
//   pnpm db:deploy:staging  [-- --seed] [--owner-email x --owner-name "Tên"]
//   pnpm db:deploy:production -- --yes [--backup-done]
// Các bước: kiểm .env → chuẩn bị Supabase (vai trò, extension) → migrate (đặt luôn mật khẩu wf_api) → db:audit
//           → thử nối bằng đường của ứng dụng (wf_api qua pooler 6543, SET ROLE wf_app) → tạo bucket Storage
//           → (tùy chọn) tạo chủ cửa hàng → (chỉ staging, tùy chọn) nạp dữ liệu demo.
// Production: BẮT BUỘC --yes; nếu DB đã có dữ liệu và có migration chờ áp thì cần --backup-done (bạn xác nhận đã sao lưu).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT, argValue, hasFlag, loadEnv } from "../lib/env.mjs";
import { ENVS, refresh, printResults } from "../lib/envfile.mjs";
import { connect, ownerUrl, targetEnv } from "../lib/db.mjs";
import { migrate } from "../db/migrate.mjs";
import { prepareSupabase } from "../db/prepare-supabase.mjs";
import { ensureBuckets } from "../ops/create-buckets.mjs";
import { explainDbError } from "../env/check-env.mjs";

const env = targetEnv();
const die = (msg, code = 1) => { console.error("\n✘ " + msg); process.exit(code); };
if (!ENVS.includes(env)) die("Dùng: pnpm db:deploy:staging | db:deploy:production");
const step = (n, t) => console.log(`\n[${n}] ${t}`);
const node = (script, args) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], { stdio: "inherit", cwd: ROOT });

console.log(`=== DEPLOY DB → ${env.toUpperCase()} ===`);
step(1, "Kiểm .env." + env);
const { vars, results } = refresh(env);
if (!printResults(results, { quiet: true })) die(`.env.${env} chưa đạt — sửa các mục ✘ rồi chạy: pnpm env:check ${env}`);
console.log("  ✔ đủ biến, không trùng với môi trường còn lại");

loadEnv(env, { override: true });
const url = ownerUrl({ env });
let c;
try {
  c = await connect(url);
} catch (e) {
  console.error(`\n✘ Không nối được DB: ${e.message}`);
  const h = explainDbError(e); if (h) console.error(`  → ${h}`);
  process.exit(1);
}
try {
  step(2, "Chuẩn bị Supabase (vai trò wf_*, quyền SET ROLE, extension)");
  await prepareSupabase(c);

  step(3, "Migration");
  const lines = [];
  const pending = await migrate({ url, dryRun: true, log: (l) => lines.push(l) });
  if (pending) console.log(`  ${pending} migration chờ áp:\n  ` + lines.join("\n  "));
  else console.log("  Không có migration mới.");
  const hasUsers = (await c.query(`SELECT to_regclass('public.users') IS NOT NULL AS t`)).rows[0].t
    && Number((await c.query(`SELECT count(*) AS n FROM public.users`)).rows[0].n) > 0;
  if (env === "production" && pending) {
    if (!hasFlag("--yes")) die("Production: thêm --yes để áp migration (xem danh sách ở trên).", 2);
    if (hasUsers && !hasFlag("--backup-done")) die("Production ĐÃ CÓ DỮ LIỆU: hãy sao lưu trước (Supabase → Database → Backups, hoặc pnpm db:backup -- --env production), rồi chạy lại với thêm --backup-done.", 2);
  }
  await migrate({ url, apiPassword: vars.WF_API_PASSWORD, log: (l) => console.log("  " + l) });
  console.log("  ✔ đã đặt mật khẩu cho vai trò wf_api");
} finally {
  await c.end();
}

step(4, "Kiểm cấu trúc DB (db:audit)");
if (node("scripts/db/audit.mjs", ["--env", env]).status !== 0) die("db:audit có vi phạm — dừng. Đọc lỗi ở trên; KHÔNG sửa file migration đã áp, tạo migration mới.");

step(5, "Thử nối bằng đường của ứng dụng (wf_api qua pooler 6543 → SET ROLE wf_app)");
try {
  const a = await connect(process.env.DATABASE_URL);
  try {
    await a.query("BEGIN");
    await a.query("SET LOCAL ROLE wf_app");
    const r = await a.query("SELECT current_user AS u");
    await a.query("COMMIT");
    console.log(`  ✔ nối được, vai trò hiệu lực trong giao dịch: ${r.rows[0].u}`);
  } finally { await a.end(); }
} catch (e) {
  die(`Ứng dụng sẽ KHÔNG nối được DB: ${e.message}\n  → Nếu "password authentication failed for user wf_api": mật khẩu wf_api chưa được đặt — chạy lại lệnh này; kiểm SB_POOLER_HOST/SB_PROJECT_REF.`);
}

if (hasFlag("--skip-buckets")) console.log("\n[6] Bỏ qua bucket (--skip-buckets)");
else {
  step(6, "Bucket Storage riêng tư");
  try { await ensureBuckets({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, log: (l) => console.log("  " + l) }); }
  catch (e) { die(e.message + "\n  → Kiểm SB_SERVICE_ROLE_KEY (đúng project, dạng JWT service_role)."); }
}

const email = argValue("--owner-email"), name = argValue("--owner-name");
if (email && name) {
  step(7, "Tạo chủ cửa hàng đầu tiên (mật khẩu tạm hiện MỘT lần ở dưới)");
  if (node("scripts/env/bootstrap-owner.mjs", ["--env", env, "--email", email, "--name", name]).status !== 0) console.error("  (không tạo được chủ — có thể đã có chủ hoạt động)");
}
if (hasFlag("--seed")) {
  if (env !== "staging") die("Chỉ nạp dữ liệu demo cho STAGING. Production không bao giờ nạp demo.");
  step(8, "Nạp dữ liệu demo (giả) lên staging");
  if (node("scripts/db/seed.mjs", ["--env", env]).status !== 0) die("seed lỗi — xem thông báo ở trên.");
}

console.log(`\n✔ DB ${env} sẵn sàng.`);
console.log(env === "staging"
  ? "  Tiếp theo: pnpm vercel:env:staging  →  git push origin staging  (Vercel tự build Preview)"
  : "  Tiếp theo: pnpm vercel:env:production  →  gộp staging vào main & push main (Vercel tự build Production)");
