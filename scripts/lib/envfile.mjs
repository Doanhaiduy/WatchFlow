// Đọc/ghi/dẫn xuất/kiểm .env.<env> cho staging & production. KHÔNG bao giờ in giá trị bí mật ra màn hình.
// Mô hình: người dùng chỉ điền ~5 ô lấy từ dashboard (SB_*, APP_URL); mọi chuỗi kết nối được DẪN XUẤT từ đó.
import fs from "node:fs";
import path from "node:path";
import { ROOT, parseEnv } from "./env.mjs";

export const ENVS = ["staging", "production"];
export const envPath = (env) => path.join(ROOT, `.env.${env}`);
export const DEFAULT_CA_FILE = "certs/supabase-root-2021-ca.crt";

/** Các khóa do script dẫn xuất (ghi đè mỗi lần chạy env:check). */
export const DERIVED_KEYS = [
  "MIGRATE_DATABASE_URL", "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
  "DB_SSL_CA", "DB_POOL_MAX", "DB_AUX_POOL_MAX", "STORAGE_DRIVER", "NEXT_PUBLIC_APP_URL",
];

export function readVars(env) {
  const f = envPath(env);
  return fs.existsSync(f) ? parseEnv(fs.readFileSync(f, "utf8")) : null;
}

const fmt = (v) => {
  const s = String(v);
  return /[\s"'#]/.test(s) || s.includes("\n") ? `"${s.replace(/\n/g, "\\n")}"` : s;
};

/** Ghi/đè từng dòng KEY=… (giữ chú thích & thứ tự); khóa chưa có ⇒ thêm cuối. */
export function setVars(env, kv) {
  const f = envPath(env);
  let text = fs.readFileSync(f, "utf8");
  for (const [k, v] of Object.entries(kv)) {
    const line = `${k}=${fmt(v)}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, () => line) : text.replace(/\s*$/, "\n") + line + "\n";
  }
  fs.writeFileSync(f, text, { mode: 0o600 });
}

/** Dẫn xuất các biến kết nối từ ô điền tay. Trả về đủ DERIVED_KEYS (rỗng nếu chưa đủ dữ kiện, để không còn giá trị cũ). */
export function derive(v) {
  const out = Object.fromEntries(DERIVED_KEYS.map((k) => [k, ""]));
  const ref = (v.SB_PROJECT_REF || "").trim();
  const host = (v.SB_POOLER_HOST || "").trim();
  const dbpw = v.SB_DB_PASSWORD || "";
  if (ref) out.SUPABASE_URL = `https://${ref}.supabase.co`;
  // Session pooler 5432 (migrate/backup từ máy dev). sslmode=require giữ cho pg_dump; script Node tự dùng DB_SSL_CA.
  if (ref && host && dbpw) out.MIGRATE_DATABASE_URL = `postgres://postgres.${ref}:${encodeURIComponent(dbpw)}@${host}:5432/postgres?sslmode=require`;
  // Transaction pooler 6543, vai trò wf_api (ứng dụng trên Vercel).
  if (ref && host && v.WF_API_PASSWORD) out.DATABASE_URL = `postgres://wf_api.${ref}:${encodeURIComponent(v.WF_API_PASSWORD)}@${host}:6543/postgres`;
  if (v.SB_SERVICE_ROLE_KEY) out.SUPABASE_SERVICE_ROLE_KEY = v.SB_SERVICE_ROLE_KEY.trim();
  const caFile = path.resolve(ROOT, (v.SB_CA_FILE || DEFAULT_CA_FILE).trim());
  if (fs.existsSync(caFile)) out.DB_SSL_CA = fs.readFileSync(caFile, "utf8").trim();
  out.DB_POOL_MAX = "3";
  out.DB_AUX_POOL_MAX = "2";
  out.STORAGE_DRIVER = "supabase";
  if (v.APP_URL) out.NEXT_PUBLIC_APP_URL = v.APP_URL.trim().replace(/\/+$/, "");
  if (v.VAPID_CONTACT_EMAIL) out.VAPID_SUBJECT = `mailto:${v.VAPID_CONTACT_EMAIL.trim()}`;
  return out;
}

function jwtPayload(t) {
  try { return JSON.parse(Buffer.from(String(t).split(".")[1], "base64url").toString("utf8")); } catch { return null; }
}

/** Kiểm toàn bộ. Trả về [{level:'ok'|'warn'|'fail', key, msg}] — msg không chứa giá trị bí mật. */
export function validate(v, env, { other } = {}) {
  const r = [];
  const ok = (key, msg) => r.push({ level: "ok", key, msg });
  const warn = (key, msg) => r.push({ level: "warn", key, msg });
  const fail = (key, msg) => r.push({ level: "fail", key, msg });
  const filled = (k) => (v[k] || "").trim() !== "";

  // — Ô điền tay (BƯỚC 1)
  const ref = (v.SB_PROJECT_REF || "").trim();
  if (!ref) fail("SB_PROJECT_REF", "chưa điền (Supabase → Project Settings → General → Project ID)");
  else if (!/^[a-z0-9]{20}$/.test(ref)) fail("SB_PROJECT_REF", "phải là chuỗi 20 ký tự chữ thường/số (Project ID), không phải tên project");
  else ok("SB_PROJECT_REF", "hợp lệ");

  if (!filled("SB_DB_PASSWORD")) fail("SB_DB_PASSWORD", "chưa điền (mật khẩu database đặt lúc tạo project)");
  else if (v.SB_DB_PASSWORD.length < 12) warn("SB_DB_PASSWORD", "ngắn hơn 12 ký tự — nên đặt lại mật khẩu dài hơn");
  else ok("SB_DB_PASSWORD", "đã điền");

  const host = (v.SB_POOLER_HOST || "").trim();
  if (!host) fail("SB_POOLER_HOST", "chưa điền (nút Connect → Session pooler → Host)");
  else if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) fail("SB_POOLER_HOST", "phải có dạng aws-N-<vùng>.pooler.supabase.com (host pooler, KHÔNG dùng db.<ref>.supabase.co)");
  else if (!host.includes("ap-southeast-1")) warn("SB_POOLER_HOST", "không phải ap-southeast-1 (Singapore) — Vercel sin1 nên đi cùng vùng");
  else ok("SB_POOLER_HOST", "hợp lệ (Singapore)");

  const sk = (v.SB_SERVICE_ROLE_KEY || "").trim();
  if (!sk) fail("SB_SERVICE_ROLE_KEY", "chưa điền (Project Settings → API Keys → tab Legacy → service_role)");
  else if (!sk.startsWith("eyJ")) fail("SB_SERVICE_ROLE_KEY", "ứng dụng hiện cần khóa service_role dạng JWT (tab 'Legacy anon, service_role API keys'); khóa sb_secret_… chưa được hỗ trợ");
  else {
    const p = jwtPayload(sk);
    if (!p) fail("SB_SERVICE_ROLE_KEY", "không đọc được JWT — chép thiếu ký tự?");
    else if (p.role !== "service_role") fail("SB_SERVICE_ROLE_KEY", `đây là khóa '${p.role}', không phải service_role — chép nhầm anon key?`);
    else if (ref && p.ref && p.ref !== ref) fail("SB_SERVICE_ROLE_KEY", "khóa thuộc project khác (ref không khớp SB_PROJECT_REF) — nhầm môi trường?");
    else ok("SB_SERVICE_ROLE_KEY", "đúng service_role của project này");
  }

  const caFile = path.resolve(ROOT, (v.SB_CA_FILE || DEFAULT_CA_FILE).trim());
  if (fs.existsSync(caFile)) ok("DB_SSL_CA", `nạp từ ${path.relative(ROOT, caFile).split(path.sep).join("/")}`);
  else fail("DB_SSL_CA", `không thấy tệp CA: ${path.relative(ROOT, caFile)} (mặc định ${DEFAULT_CA_FILE} đã nằm trong repo)`);

  const url = (v.APP_URL || "").trim();
  if (!url) (env === "production" ? fail : warn)("APP_URL", env === "production" ? "production cần https://<tên miền> (hoặc URL Vercel)" : "chưa điền — điền sau lần deploy đầu (không chặn)");
  else if (!/^https:\/\/[^/\s]+$/.test(url.replace(/\/+$/, ""))) fail("APP_URL", "phải là https://<miền> không kèm đường dẫn");
  else ok("APP_URL", url);

  const mail = (v.VAPID_CONTACT_EMAIL || "").trim();
  if (!mail) (env === "production" ? warn : ok)("VAPID_CONTACT_EMAIL", env === "production" ? "nên điền email thật của người vận hành (thông báo đẩy)" : "để mặc định");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) fail("VAPID_CONTACT_EMAIL", "không giống email");
  else ok("VAPID_CONTACT_EMAIL", "đã điền");

  // — Khóa sinh tự động (BƯỚC 2)
  const pem = (k, tag) => (new RegExp(`-----BEGIN ${tag}-----[\\s\\S]+-----END ${tag}-----`).test(v[k] || "") ? ok(k, "PEM hợp lệ") : fail(k, `thiếu/hỏng (chạy pnpm env:init ${env} --force sẽ sinh lại — CHỈ khi chưa có dữ liệu)`));
  pem("AUTH_JWT_PRIVATE_KEY", "PRIVATE KEY");
  pem("AUTH_JWT_PUBLIC_KEY", "PUBLIC KEY");
  for (const k of ["PII_KEY_V1", "PII_BIDX_KEY"]) (Buffer.from(v[k] || "", "base64").length === 32 ? ok(k, "32 byte") : fail(k, "phải là 32 byte base64"));
  for (const k of ["AUTH_JWT_KID", "CRON_SECRET", "OPS_HEARTBEAT_SECRET", "WF_API_PASSWORD", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]) (filled(k) ? ok(k, "có") : fail(k, "thiếu"));

  // — Dẫn xuất (BƯỚC 3)
  for (const k of ["MIGRATE_DATABASE_URL", "DATABASE_URL", "SUPABASE_URL"]) (filled(k) ? ok(k, "đã dẫn xuất") : fail(k, "chưa dẫn xuất được (thiếu ô BƯỚC 1)"));

  // — Không được dùng chung giữa staging và production
  if (other) {
    for (const k of ["SB_PROJECT_REF", "PII_KEY_V1", "PII_BIDX_KEY", "AUTH_JWT_PRIVATE_KEY", "CRON_SECRET", "WF_API_PASSWORD"]) {
      if (filled(k) && other[k] && other[k] === v[k]) {
        const i = r.findIndex((x) => x.key === k && x.level === "ok");
        if (i >= 0) r.splice(i, 1); // thay dòng ✔ cũ bằng dòng lỗi, tránh hai dòng mâu thuẫn
        fail(k, `trùng với môi trường còn lại — mỗi môi trường phải có ${k === "SB_PROJECT_REF" ? "project Supabase riêng" : "khóa riêng"}`);
      }
    }
  }
  return r;
}

export function printResults(results, { quiet = false } = {}) {
  const sym = { ok: "✔", warn: "⚠", fail: "✘" };
  for (const x of results) if (!quiet || x.level !== "ok") console.log(`  ${sym[x.level]} ${x.key.padEnd(24)} ${x.msg}`);
  const n = (l) => results.filter((x) => x.level === l).length;
  console.log(`\n  Kết quả: ${n("ok")} đạt · ${n("warn")} cảnh báo · ${n("fail")} lỗi`);
  return n("fail") === 0;
}

/** Dẫn xuất + ghi lại + nạp vào process.env. Dùng chung cho check-env, db-deploy, vercel-env. */
export function refresh(env, { write = true } = {}) {
  const v0 = readVars(env);
  if (!v0) throw new Error(`Chưa có .env.${env} — chạy: pnpm env:init ${env}`);
  const d = derive(v0);
  if (write) setVars(env, d);
  const v = { ...v0, ...d };
  for (const [k, val] of Object.entries(v)) if (val !== "") process.env[k] = val;
  const otherEnv = env === "staging" ? "production" : "staging";
  return { vars: v, results: validate(v, env, { other: readVars(otherEnv) }) };
}
