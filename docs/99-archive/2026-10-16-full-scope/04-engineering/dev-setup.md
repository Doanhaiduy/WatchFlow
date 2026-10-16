# Dựng môi trường phát triển

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (cập nhật lệnh thật khi xong M0)

## 1. Yêu cầu

- Windows 11 / macOS / Linux; **Node.js ≥ 22 LTS**, **pnpm**; Git. **Không cần cài PostgreSQL hay Docker** (dùng PostgreSQL portable qua `embedded-postgres`, như Lưu Xá).
- Trình duyệt Chromium (Edge/Chrome) cho e2e; điện thoại thật để thử camera/PWA (qua `https` — dùng tunnel hoặc Preview).
- Tài khoản: GitHub (repo **private**), Vercel (Pro), Supabase (Pro cho production) — đứng tên chủ cửa hàng/pháp nhân.

## 2. Lần đầu

```bash
pnpm install            # cài thư viện (gồm PostgreSQL portable)
pnpm setup:local        # khởi động PG local, sinh .env.local (chỉ trỏ DB local), dựng DB "watchflow", migrate, nạp seed demo
pnpm dev                # http://localhost:3000
```

`setup:local` in ra tài khoản demo (mật khẩu chung do script sinh, lưu `.local/demo-accounts.txt`, git-ignore): một tài khoản mỗi vai trò (`owner`, `sales`, `warehouse`, `technician`, `collaborator`) cùng dữ liệu mẫu khớp **kịch bản vàng** (`golden-scenarios`) để thử tay.

## 3. Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy Next dev (tự `db:start`) |
| `pnpm build` / `pnpm start` | Build/chạy production (build chạy `check-version`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Test đơn vị (`vitest`) |
| `pnpm test:api [-- --only <bộ>]` | Test tích hợp trên DB thật + máy chủ thử (cổng 3100): bộ chức năng, **đồng thời (CT)**, **phân quyền (PT)**, kịch bản vàng (SC) |
| `pnpm test:e2e` | Playwright (mobile 390px, a11y) |
| `pnpm db:start\|stop\|status` | Điều khiển PostgreSQL local (`127.0.0.1:54329`, dữ liệu `.local/pgdata`) |
| `pnpm db:migrate [-- --dry-run]` | Áp migration lên DB local; `:staging`, `:production` dùng `--env` |
| `pnpm db:seed` | Nạp dữ liệu demo (local/staging) |
| `pnpm setup:reset` | **Xóa** DB local và dựng lại |
| `pnpm db:audit` | Chạy bộ kiểm cấu trúc (mọi bảng có RLS + FORCE, không hàm `SECURITY DEFINER` thiếu `search_path`, mọi FK có index, hàm đặc quyền có owner đúng…) |
| `pnpm db:backup [-- --env production --with-storage]` | Sao lưu thủ công |
| `pnpm env:keys` | Sinh khóa mới (chỉ in màn hình) |
| `pnpm version:bump <patch\|minor\|major> "Tiêu đề"` | Tăng phiên bản + mục changelog |
| `pnpm dev:staging` | Chạy máy bạn với DB staging (có cảnh báo; chỉ khi thật cần) |
| `pnpm docs:check` | Kiểm link/ID/`Cập nhật lần cuối` của docs (M9) |

## 4. Biến môi trường

Chỉ **tên** và ý nghĩa — giá trị ở `.env.*` (không commit; `.env.example` được commit không chứa bí mật).

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | ✔ | Chuỗi kết nối của ứng dụng (vai trò `wf_api`, pooler **6543** khi dùng Supabase; local: `127.0.0.1:54329`) |
| `MIGRATE_DATABASE_URL` | staging/prod (máy dev) | Chuỗi chủ DB (pooler **5432**) cho migrate/bootstrap — **không đưa lên Vercel** |
| `ALLOW_REMOTE_DB` | local khi cần | `true` để dev trỏ DB từ xa (mặc định chặn) |
| `DB_SSL_CA`, `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_POOL_WARM` | tùy chọn | TLS/pool |
| `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY` (+ `AUTH_JWT_KID`) | ✔ | Ký/xác minh access token (EdDSA) |
| `PII_KEY_V1`, `PII_BIDX_KEY` | ✔ | Mã hóa CCCD / chỉ mục băm — **mất = mất dữ liệu mã hóa** |
| `CRON_SECRET` | ✔ | Bearer cho `/api/cron/*` |
| `NEXT_PUBLIC_APP_URL` | nên có | URL gốc (liên kết trong phiếu/email) |
| `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_*` | tự điền khi build | Từ `package.json` + commit |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | staging/prod | Chỉ cho Storage từ máy chủ |
| `STORAGE_DRIVER` | local=`local` | `local` hoặc `supabase` |
| `OPS_HEARTBEAT_SECRET` | nên có | Repo sao lưu báo "đã sao lưu" |
| `OPS_REQUIRE_BACKUP_HEARTBEAT` | tùy chọn | `1` ⇒ health sâu lỗi khi chưa từng có nhịp tim |
| `RATE_LIMIT_PEPPER` | tùy chọn | Muối băm khóa giới hạn tốc độ (mặc định `PII_BIDX_KEY`) |
| `COOKIE_SECURE` | local http | `false` khi chạy http |
| `SERVER_TIMING`, `DB_TRACE` | dev | Đo/in SQL |
| `AI_OFFLINE`, `GROQ_API_KEY`, … | tùy chọn | Chỉ khi bật AI (ngoài đường găng) |

Quy tắc: **mỗi môi trường một bộ khóa riêng**; `.env.local` trỏ DB local; không in bí mật ra log/ảnh chụp; biến *Sensitive* trên Vercel không đọc lại được ⇒ giữ bản gốc ở nơi an toàn.

## 5. Dựng môi trường mới (staging/production)

1. Tạo dự án Supabase (vùng **Singapore**), bật gói phù hợp; **tắt Data API** (Project Settings → Data API); lấy chuỗi pooler (6543 cho app, 5432 cho migrate).
2. `pnpm env:keys` ⇒ lưu vào `.env.<env>` và trình quản lý mật khẩu.
3. Dựng DB: `node scripts/db/bundle.mjs --apply <chuỗi chủ DB pooler> --allow-remote --api-password <mật khẩu wf_api>` (tạo vai trò, schema, bảng, hàm, RLS, seed tham chiếu) → `pnpm db:migrate:<env>` (ghi nhận migration).
4. Tạo bucket Storage riêng tư: `unit-photos`, `repair-photos`, `documents`, `branding` (REST `/storage/v1/bucket` bằng `service_role`).
5. Tạo chủ cửa hàng đầu tiên: `node scripts/env/bootstrap-owner.mjs --env <env> --email … --name …` (mật khẩu tạm, buộc đổi lần đầu, bắt đầu TOTP).
6. Vercel: tạo project (vùng `sin1`), đặt biến môi trường (Production ← `.env.production`; Preview ← `.env.staging`), kết nối nhánh.
7. Bật sao lưu: `scripts/ops/create-backup-role.mjs`, repo sao lưu riêng (`ops/backup-repo`), secrets — xem `backup-restore`.
8. Chạy `GET /api/health?deep=1`, đăng nhập thử, chạy kịch bản vàng thủ công trên staging.

## 6. Cạm bẫy thường gặp

- Host trực tiếp `db.<ref>.supabase.co` chỉ có IPv6 ⇒ luôn dùng pooler.
- Cổng 5432 của pooler là session mode ⇒ app dùng 6543; code tự đổi nếu cấu hình nhầm.
- `.env.local` lỡ trỏ staging/production ⇒ `db.ts` chặn trừ khi `ALLOW_REMOTE_DB=true` (và `pnpm dev` in cảnh báo màu đỏ).
- Windows: dùng PowerShell hoặc Git Bash; đường dẫn `.local/` có thể bị antivirus quét chậm — loại trừ thư mục `.local/pgdata`.
- Camera/PWA chỉ chạy trên `https` hoặc `localhost`.
