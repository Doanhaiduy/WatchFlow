# Dựng môi trường phát triển

> Cập nhật lần cuối: 2026-10-17 · Trạng thái: Duyệt — lệnh đã kiểm thật trên Windows 11 (M0–M8), xem §2.1

## 1. Yêu cầu

- Windows 11 / macOS / Linux; **Node.js ≥ 22 LTS**, **pnpm**; Git. **Không cần cài PostgreSQL hay Docker** (dùng PostgreSQL portable qua `embedded-postgres`, như Lưu Xá).
- Trình duyệt Chromium (Edge/Chrome) cho e2e; điện thoại thật để thử camera/PWA (qua `https` — dùng tunnel hoặc Preview).
- Tài khoản: GitHub (repo hiện public — chỉ chứa mã/docs/dữ liệu giả; chuyển **private** trước khi có dữ liệu thật), Vercel (Pro), Supabase (Pro cho production) — đứng tên chủ cửa hàng/pháp nhân.

## 2. Lần đầu

```bash
pnpm install            # cài thư viện (gồm PostgreSQL portable)
pnpm setup:local        # khởi động PG local, sinh .env.local (chỉ trỏ DB local), dựng DB "watchflow", migrate, nạp seed demo
pnpm dev                # http://localhost:3000
```

`setup:local` in ra tài khoản demo (mật khẩu chung do script sinh, lưu `.local/demo-accounts.txt`, git-ignore): một tài khoản mỗi vai trò (`owner`, `sales`, `warehouse`, `collaborator`) cùng dữ liệu mẫu khớp **kịch bản vàng** (`golden-scenarios`) để thử tay.

### 2.1 Ghi chú đã kiểm thật (2026-10-17)

- **PostgreSQL**: `scripts/db/pg.mjs` dùng nhị phân `PG_BIN` → `C:\Program Files\PostgreSQL\<bản mới nhất>\bin` → PATH; cụm riêng `.local/pgdata`, cổng **54329**, chỉ nghe 127.0.0.1, mật khẩu chủ DB sinh ngẫu nhiên ở `.local/pg-superuser.txt` (CONFIRM CQ-003). Máy chưa có PostgreSQL ⇒ cài bản 17/18 hoặc đặt `PG_BIN`.
- `pnpm setup:local` sinh `.env.local` (khóa mới, chỉ trỏ DB local), tạo DB `watchflow`, migrate, seed demo (4 vai trò + CTV thứ hai, danh mục, **tồn đầu kỳ qua phiếu nhập `opening` thật**, khách). Tài khoản: `.local/demo-accounts.txt` (chủ đã bật TOTP — khóa trong tệp).
- `pnpm test:api [-- --only <phần tên tệp>] [--no-server]`: dựng lại DB `watchflow_test` (`app.env=test` cho phép ngày giả qua header `X-Test-Today` khi máy chủ chạy `WF_TEST_MODE=1`), máy chủ thử `next dev -p 3100` (distDir `.next-test`), chạy `node --test tests/api/*.test.mjs`; bộ `zz-consistency` chạy cuối kiểm I1–I12 + hằng đẳng thức SC-13 trên toàn DB.
- `pnpm test:e2e [-- <tham số Playwright>]`: DB `watchflow_e2e`, máy chủ cổng 3300 (distDir `.next-e2e`), Playwright dùng **Edge/Chrome có sẵn** (`E2E_CHANNEL=msedge|chrome`), ảnh ở `test-results/screens/`.
- `pnpm db:backup` ⇒ `.local/backups/*.dump.enc` (AES-256-GCM, khóa scrypt từ `BACKUP_PASSPHRASE` hoặc `.local/backup-passphrase.txt`); `pnpm db:restore-drill` sao lưu → giải mã → khôi phục vào DB tạm → đối chiếu số dòng, `app_migrations`, `fn_consistency_check()` → biên bản `.local/backups/drill-*.md` + nhịp tim.
- Lucian CLI sau proxy công ty: đặt `NODE_USE_ENV_PROXY=1`.

## 3. Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy Next dev (tự `db:start`) |
| `pnpm build` / `pnpm start` | Build/chạy production (build chạy `check-version`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Test đơn vị (`vitest`) |
| `pnpm test:api [-- --only <bộ>]` | Test tích hợp trên DB thật + máy chủ thử (cổng 3100): bộ chức năng, **đồng thời (CT)**, **phân quyền (PT)**, kịch bản vàng (SC) |
| `pnpm test:e2e` | Playwright (mobile 390px + desktop 1366px, a11y, ảnh chụp giao diện Glass) |
| `pnpm audit:layout -- --base http://localhost:3000 [--quick] [--roles owner,sales] [--widths 360,390,1366] [--themes light,dark] [--pages /ban-hang] [--no-axe] [--no-fail]` | **Kiểm bố cục tự động** trên một máy chủ đang chạy (`scripts/e2e/layout-audit.mjs`, port từ Lưu Xá): đăng nhập từng vai trò (mật khẩu/TOTP đọc `.local/demo-accounts.txt` hoặc `AUDIT_PASSWORD`/`AUDIT_TOTP`; không đổi mật khẩu/2FA), duyệt **mọi route sinh từ `src/app`** (route động lấy id mẫu qua API) ở 360/390/1366 × sáng/tối; bắt tràn ngang, nhãn nút xuống dòng, chữ bị cắt, phần tử chạm < 44px (điện thoại), ảnh thiếu alt, axe serious/critical. Xuất `test-results/layout-audit/report.md` + `findings.json` + ảnh (chỉ trang lỗi). `--quick` = chỉ owner, 390+1366, sáng. Thoát 1 nếu có phát hiện (`--no-fail` bỏ). Trên Git Bash đường dẫn `--pages /x` được tự gỡ tiền tố MSYS. Chạy cả bộ mất vài chục phút trên `next dev` (biên dịch lười) — nên dùng `next start` hoặc `--quick` khi sửa giao diện |
| `pnpm db:start\|stop\|status` | Điều khiển PostgreSQL local (`127.0.0.1:54329`, dữ liệu `.local/pgdata`) |
| `pnpm db:migrate [-- --dry-run]` | Áp migration lên DB local; `:staging`, `:production` dùng `--env` |
| `pnpm db:seed` | Nạp dữ liệu demo nền (tài khoản, danh mục + tồn đầu kỳ, khách). Thêm `-- --full` để có cả kịch bản hoạt động (ghi đơn bán, giao CTV nhiều người + báo bán, sửa chữa, nhập thêm — bước `db/seed/04+`); staging luôn đầy đủ. Test/`setup:local` chỉ dùng phần nền |
| `pnpm setup:reset` | **Xóa** DB local và dựng lại |
| `pnpm db:audit` | Chạy bộ kiểm cấu trúc (mọi bảng có RLS + FORCE, không hàm `SECURITY DEFINER` thiếu `search_path`, mọi FK có index, hàm đặc quyền có owner đúng…) |
| `pnpm db:backup [-- --env production --with-storage]` | Sao lưu thủ công |
| `pnpm env:keys` | Sinh khóa mới (chỉ in màn hình) |
| `pnpm env:init staging\|production` | Tạo `.env.<env>` đã sinh sẵn bộ khóa riêng; chỉ chừa vài ô điền từ dashboard (không ghi đè file có sẵn) |
| `pnpm env:check staging\|production [--ping]` | Dẫn xuất chuỗi kết nối từ các ô đã điền, kiểm đủ biến, `--ping` thử nối DB Supabase |
| `pnpm db:deploy:staging\|production [-- --seed] [--owner-email … --owner-name …]` | **Một lệnh dựng/cập nhật DB**: chuẩn bị vai trò Supabase → migrate → `db:audit` → thử đường nối của ứng dụng → bucket Storage → (tùy chọn) chủ cửa hàng / demo (chỉ staging). Production cần `--yes` |
| `pnpm db:seed:staging` · `pnpm owner:staging\|production -- --email … --name …` | Nạp demo (chỉ staging) · tạo chủ cửa hàng đầu tiên |
| `pnpm vercel:env:staging\|production [-- --dry-run] [--only TÊN]` | Đẩy biến môi trường từ `.env.<env>` lên Vercel (staging → Preview nhánh `staging`; bí mật là Sensitive) |
| `pnpm version:bump <patch\|minor\|major> "Tiêu đề"` | Tăng phiên bản + mục changelog |
| `pnpm dev:staging` | Chạy máy bạn với DB staging (có cảnh báo; chỉ khi thật cần) |
| `pnpm docs:check` | Kiểm link/ID/`Cập nhật lần cuối` của docs (bản đầu ở M0, hoàn thiện M9) |
| `pnpm ui:lucian -- <lệnh>` | (tùy chọn) bọc `node <skill-dir>/scripts/lucian-uxui.mjs search\|get\|tokens` để tra/lấy phần tử UI; thực tế AI dùng skill `/lucian-uxui:lucian-uxui` |

## 4. Biến môi trường

Chỉ **tên** và ý nghĩa — giá trị ở `.env.*` (không commit; `.env.example` được commit không chứa bí mật).

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | ✔ | Chuỗi kết nối của ứng dụng (vai trò `wf_api`, pooler **6543** khi dùng Supabase; local: `127.0.0.1:54329`) |
| `MIGRATE_DATABASE_URL` | staging/prod (máy dev) | Chuỗi chủ DB (pooler **5432**) cho migrate/bootstrap — **không đưa lên Vercel** |
| `ALLOW_REMOTE_DB` | local khi cần | `true` để dev trỏ DB từ xa (mặc định chặn) |
| `DB_SSL_CA`, `DB_POOL_MAX`, `DB_AUX_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_POOL_WARM`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, `DB_IDLE_TX_TIMEOUT_MS`, `DB_CONNECT_TIMEOUT_MS` | tùy chọn | TLS/pool. DB ngoài máy **bắt buộc** `DB_SSL_CA` (PEM, xuống dòng viết `\n`) hoặc `sslmode=verify-full` trong URL — thiếu cả hai thì ứng dụng từ chối nối. Pool phụ `DB_AUX_POOL_MAX` (mặc định 2) cho xác thực/đếm giới hạn/outbox, tách khỏi pool chính để không chờ vòng tròn; tổng kết nối mỗi instance = `DB_POOL_MAX` + `DB_AUX_POOL_MAX` |
| `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY` (+ `AUTH_JWT_KID`) | ✔ | Ký/xác minh access token (EdDSA) |
| `PII_KEY_V1`, `PII_BIDX_KEY` | ✔ | Mã hóa CCCD / chỉ mục băm — **mất = mất dữ liệu mã hóa** |
| `CRON_SECRET` | ✔ | Bearer cho `/api/cron/*` |
| `NEXT_PUBLIC_APP_URL` | nên có | URL gốc (liên kết trong phiếu/email) |
| `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_*` | tự điền khi build | Từ `package.json` + commit |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | staging/prod | Chỉ cho Storage từ máy chủ |
| `STORAGE_DRIVER` | local=`local` | `local` hoặc `supabase` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | tùy chọn | Thông báo đẩy (Web Push). Thiếu ⇒ tính năng tắt êm (Cài đặt báo "máy chủ chưa bật"). Sinh cặp khóa: `pnpm env:keys <môi trường>` (in `VAPID_*` + `mailto:` giả của môi trường). **Mỗi môi trường một cặp**; **không đặt ở `.env.local`** (local không gửi đẩy thật); đổi khóa = mọi thiết bị phải bật lại thông báo. Private key là bí mật (Vercel *Sensitive*) |
| `WF_PUSH_FAKE`, `WF_PUSH_FAKE_FILE` | chỉ test | `WF_PUSH_FAKE=1` ⇒ bộ gửi GIẢ ghi tin vào tệp (JSON lines) thay vì gọi dịch vụ đẩy; bị bỏ qua ở production/Vercel. `scripts/test-api.mjs` tự đặt cho máy chủ thử |
| `OPS_HEARTBEAT_SECRET` | nên có | Repo sao lưu báo "đã sao lưu" |
| `OPS_REQUIRE_BACKUP_HEARTBEAT` | tùy chọn | `1` ⇒ health sâu lỗi khi chưa từng có nhịp tim |
| `RATE_LIMIT_PEPPER` | tùy chọn | Muối băm khóa giới hạn tốc độ (mặc định `PII_BIDX_KEY`) |
| `COOKIE_SECURE` | local http | `false` khi chạy http |
| `SERVER_TIMING`, `DB_TRACE` | dev | Đo/in SQL |
| `AI_OFFLINE`, `GROQ_API_KEY`, … | tùy chọn | Chỉ khi bật AI (ngoài đường găng) |

Quy tắc: **mỗi môi trường một bộ khóa riêng**; `.env.local` trỏ DB local; không in bí mật ra log/ảnh chụp; biến *Sensitive* trên Vercel không đọc lại được ⇒ giữ bản gốc ở nơi an toàn.

## 5. Dựng môi trường mới (staging/production)

Hướng dẫn đầy đủ từng bước (kèm chỗ bấm trên dashboard): [`05-operations/deploy-staging-production`](../05-operations/deploy-staging-production.md) §A. Tóm tắt:

1. Tạo dự án Supabase (vùng **Singapore**); lấy 4 giá trị (Project ID, mật khẩu DB, host Session pooler, khóa `service_role` dạng JWT); **tắt Data API**.
2. `pnpm env:init <env>` (sinh `.env.<env>` + bộ khóa riêng) → điền 4 ô → `pnpm env:check <env> --ping`.
3. `pnpm db:deploy:<env>` — vai trò, migration, `db:audit`, bucket Storage; thêm `--owner-email/--owner-name` để tạo chủ cửa hàng, `--seed` (chỉ staging) để nạp demo.
4. Vercel: project đã nối repo; `pnpm vercel:env:<env>` đặt biến; push nhánh (`staging` → Preview, `main` → Production).
5. Bật sao lưu: `scripts/ops/create-backup-role.mjs`, repo sao lưu riêng (`ops/backup-repo`), secrets — xem `backup-restore`.
6. Chạy `GET /api/health?deep=1`, đăng nhập thử, chạy kịch bản vàng thủ công trên staging.

## 6. Cạm bẫy thường gặp

- Host trực tiếp `db.<ref>.supabase.co` chỉ có IPv6 ⇒ luôn dùng pooler.
- Cổng 5432 của pooler là session mode ⇒ app dùng 6543; code tự đổi nếu cấu hình nhầm.
- `.env.local` lỡ trỏ staging/production ⇒ `db.ts` chặn trừ khi `ALLOW_REMOTE_DB=true` (và `pnpm dev` in cảnh báo màu đỏ).
- Windows: dùng PowerShell hoặc Git Bash; đường dẫn `.local/` có thể bị antivirus quét chậm — loại trừ thư mục `.local/pgdata`.
- Camera/PWA chỉ chạy trên `https` hoặc `localhost`.
