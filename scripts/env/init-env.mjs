// Tạo .env.<staging|production> đã sinh sẵn khóa riêng của môi trường; chỉ chừa ~7 ô để điền từ dashboard.
// Dùng: pnpm env:init staging|production [--force]
// KHÔNG in khóa ra màn hình. Không ghi đè file có sẵn (đổi PII_* khi đã có dữ liệu = mất khả năng đọc CCCD đã mã hóa).
import fs from "node:fs";
import { hasFlag } from "../lib/env.mjs";
import { ENVS, envPath, DEFAULT_CA_FILE } from "../lib/envfile.mjs";
import { genKeys, genVapid } from "./gen-keys.mjs";

const env = process.argv[2];
if (!ENVS.includes(env)) { console.error("Dùng: pnpm env:init staging|production [--force]"); process.exit(1); }
const file = envPath(env);
if (fs.existsSync(file)) {
  if (!hasFlag("--force")) {
    console.error(`✘ .env.${env} đã tồn tại — KHÔNG ghi đè (chứa khóa PII/JWT; sinh lại khi đã có dữ liệu = mất dữ liệu mã hóa).\n  Muốn kiểm tra: pnpm env:check ${env}\n  Muốn sinh lại từ đầu (chỉ khi CHƯA có dữ liệu): pnpm env:init ${env} --force   (bản cũ lưu .env.${env}.bak-<giờ>)`);
    process.exit(1);
  }
  fs.copyFileSync(file, `${file}.bak-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`);
}

const q = (v) => `"${String(v).trim().replace(/\n/g, "\\n")}"`;
const k = genKeys();
const vp = genVapid(env);
const label = env === "staging" ? "STAGING" : "PRODUCTION";
const text = `# .env.${env} — WatchFlow ${label}. KHÔNG commit (đã git-ignore). Sao một bản vào trình quản lý mật khẩu.
# Cách làm: điền các ô ở BƯỚC 1 (hướng dẫn lấy ở docs/05-operations/deploy-staging-production.md §A), rồi chạy:
#     pnpm env:check ${env} --ping      (tự dẫn xuất BƯỚC 3, kiểm đủ biến, thử nối DB)
# BƯỚC 2 đã sinh sẵn — ĐỪNG sửa/đổi sau khi có dữ liệu thật. BƯỚC 3 do script ghi — đừng sửa tay.

# ===== BƯỚC 1 — ĐIỀN TỪ DASHBOARD =====
# Supabase → Project Settings → General → "Project ID" (20 ký tự chữ thường/số; cũng nằm trong URL dashboard)
SB_PROJECT_REF=
# Mật khẩu database bạn đặt lúc tạo project (quên: Project Settings → Database → Reset database password)
SB_DB_PASSWORD=
# Supabase → nút Connect → tab "Session pooler" → Host (dạng aws-1-ap-southeast-1.pooler.supabase.com)
SB_POOLER_HOST=
# Supabase → Project Settings → API Keys → tab "Legacy anon, service_role API keys" → service_role (bấm Reveal)
SB_SERVICE_ROLE_KEY=
# Tệp CA để kiểm chứng chỉ TLS của Supabase (đã có sẵn trong repo; thường không cần đổi)
SB_CA_FILE=${DEFAULT_CA_FILE}
# URL công khai: ${env === "staging" ? "staging = URL nhánh staging trên Vercel (điền sau lần deploy đầu)" : "production = https://<tên miền> hoặc URL Vercel"}
APP_URL=
# Email thật của người vận hành (thông báo đẩy Web Push). Để trống = địa chỉ giả (chỉ chấp nhận ở staging)
VAPID_CONTACT_EMAIL=

# ===== BƯỚC 2 — KHÓA SINH TỰ ĐỘNG (riêng ${env}; KHÔNG đổi sau khi có dữ liệu) =====
AUTH_JWT_PRIVATE_KEY=${q(k.AUTH_JWT_PRIVATE_KEY)}
AUTH_JWT_PUBLIC_KEY=${q(k.AUTH_JWT_PUBLIC_KEY)}
AUTH_JWT_KID=${k.AUTH_JWT_KID}
PII_KEY_V1=${k.PII_KEY_V1}
PII_BIDX_KEY=${k.PII_BIDX_KEY}
CRON_SECRET=${k.CRON_SECRET}
OPS_HEARTBEAT_SECRET=${k.OPS_HEARTBEAT_SECRET}
WF_API_PASSWORD=${k.WF_API_PASSWORD}
VAPID_PUBLIC_KEY=${vp.VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${vp.VAPID_PRIVATE_KEY}
VAPID_SUBJECT=${vp.VAPID_SUBJECT}

# ===== BƯỚC 3 — SCRIPT TỰ DẪN XUẤT (pnpm env:check ${env}) =====
MIGRATE_DATABASE_URL=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DB_SSL_CA=
DB_POOL_MAX=3
DB_AUX_POOL_MAX=2
STORAGE_DRIVER=supabase
NEXT_PUBLIC_APP_URL=
`;
fs.writeFileSync(file, text, { mode: 0o600 });
console.log(`✔ Đã tạo .env.${env} với bộ khóa riêng (không in ra màn hình).
  Việc của bạn: mở file, điền 4 ô bắt buộc ở BƯỚC 1 (SB_PROJECT_REF, SB_DB_PASSWORD, SB_POOLER_HOST, SB_SERVICE_ROLE_KEY).
  Rồi chạy:  pnpm env:check ${env} --ping
  Nhớ cất bản sao file này vào trình quản lý mật khẩu (biến Sensitive trên Vercel không đọc lại được).`);
