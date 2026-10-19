# Triển khai staging & production (Supabase + Vercel)

> Cập nhật lần cuối: 2026-10-17 · Trạng thái: Đã tự động hóa phần DB/biến môi trường (kiểm chứng trên PostgreSQL 17 với vai trò không-superuser; chưa chạy trên Supabase thật) · Phiên bản mã: 0.14.1
> Viết cho: **chủ dự án / kỹ sư dựng staging và production lần đầu**, rồi dùng lại cho mọi lần phát hành. Đọc §0 trước khi chạy lệnh nào.

---

## 0. Quy tắc bắt buộc

1. **Staging trước, production sau.** Mọi migration chạy staging trước.
2. **Phải hỏi chủ dự án trước khi:** tạo dự án/gói có trả phí; xóa hoặc `--reset` bất cứ thứ gì; chạy SQL tay trên production; đổi domain; bật/tắt tính năng bảo mật; force push (`release-process` §8).
3. **Dữ liệu demo chỉ ở staging.** `pnpm db:deploy:staging -- --seed` được phép (dữ liệu giả, tài khoản demo lưu `.local/demo-accounts-staging.txt`). **Production tuyệt đối không nạp demo** (script từ chối). `setup:local` / `setup:reset` chỉ dành cho DB local.
4. **Bí mật** (mật khẩu DB, khóa JWT/PII, service_role, VAPID…) **không** được dán vào chat, commit, docs, ảnh chụp, issue. Chỉ nằm ở: `.env.staging` / `.env.production` trên máy bạn (đã git-ignore), biến môi trường Vercel (Sensitive), GitHub Secrets của repo sao lưu, và trình quản lý mật khẩu.
5. **Mỗi môi trường một bộ khóa riêng** — `pnpm env:check` báo lỗi nếu staging và production trùng khóa/project. Đổi `PII_KEY_V1` / `PII_BIDX_KEY` sau khi có dữ liệu = **mất khả năng đọc CCCD đã mã hóa**.
6. Gặp lỗi không có trong tài liệu ⇒ dừng, ghi nguyên văn lỗi. **Không** tự "sửa nhanh" bằng cách tắt RLS, cấp quyền rộng, hay sửa file migration đã áp (sha256 đổi ⇒ bị chạy lại).
7. **Máy công ty bị cấm kết nối cloud** (`IMPLEMENT_PROMPT.md` §0): chỉ làm tài liệu này trên máy cá nhân.

---

## A. Quy trình nhanh — làm theo thứ tự

> Phần Vercel (tạo project, nối GitHub, tạo nhánh `staging`) **đã làm sẵn**. Bạn chỉ cần lấy 4 giá trị từ Supabase cho mỗi môi trường.
> Hai file `.env.staging` và `.env.production` đã được sinh sẵn bộ khóa riêng (`pnpm env:init`). Nếu chưa có: `pnpm env:init staging` và `pnpm env:init production`.

### A1. STAGING

**1) Tạo project Supabase staging** — https://supabase.com/dashboard → *New project*
- Name: `watchflow-staging` · Region: **Southeast Asia (Singapore)** · Database password: bấm *Generate* rồi **cất vào trình quản lý mật khẩu** · gói Free là đủ cho staging.
- Nếu ở bước tạo có tùy chọn **Data API / "Automatically expose new tables"**: tắt. (Không thấy thì tắt sau ở bước 3.)

**2) Lấy 4 giá trị** rồi điền vào `.env.staging` (mục BƯỚC 1):

| Ô trong `.env.staging` | Lấy ở đâu trên Supabase |
|---|---|
| `SB_PROJECT_REF` | *Project Settings → General → Project ID* (20 ký tự chữ thường/số; cũng là đoạn cuối URL dashboard) |
| `SB_DB_PASSWORD` | mật khẩu database bạn vừa đặt (quên: *Project Settings → Database → Reset database password*) |
| `SB_POOLER_HOST` | nút **Connect** (thanh trên cùng) → *Session pooler* → phần **Host**, dạng `aws-1-ap-southeast-1.pooler.supabase.com`. **Không** dùng `db.<ref>.supabase.co` (chỉ có IPv6) |
| `SB_SERVICE_ROLE_KEY` | *Project Settings → API Keys* → tab **Legacy anon, service_role API keys** → `service_role` → *Reveal* → copy. Phải là chuỗi bắt đầu `eyJ…` |

Có thể điền luôn `VAPID_CONTACT_EMAIL` (email thật của bạn, cho thông báo đẩy). `APP_URL` để trống, điền sau lần deploy đầu.

**3) Tắt Data API + đăng ký Auth** (2 công tắc, ứng dụng không dùng cả hai):
- *Project Settings → Data API* (hoặc *API*): tắt / không expose schema nào.
- *Authentication → Sign In / Providers*: tắt *Allow new users to sign up* và các provider.
- *Project Settings → Database → SSL*: bật *Enforce SSL on incoming connections* (nếu chưa).

**4) Kiểm file + thử nối DB** (tự dẫn xuất chuỗi kết nối, báo thiếu gì):
```bash
pnpm env:check staging --ping
```
Kỳ vọng: toàn ✔ và dòng "Nối DB (staging) thành công" kèm `BYPASSRLS=true`. Gặp ✘/lỗi: lệnh in cách sửa (sai mật khẩu, sai host `aws-0` ↔ `aws-1`, nhầm service_role…).

**5) Dựng DB — một lệnh** (vai trò → migration → kiểm cấu trúc → thử đường nối của ứng dụng → bucket Storage):
```bash
pnpm db:deploy:staging -- --seed --owner-email <email-của-bạn> --owner-name "Họ tên"
```
- `--seed`: nạp dữ liệu demo **đầy đủ để thử mọi luồng** — 5 tài khoản (chủ/bán hàng/kho/2 CTV), 17 chiếc đồng hồ (tồn đầu kỳ và một phiếu thêm 8 chiếc), khách mẫu, 3 đơn bán (2 đơn cửa hàng, 1 đơn CTV đã xác nhận), chào hàng cho 2 CTV (một chiếc giao cho cả hai; 1 báo bán đã xác nhận, 1 báo bán đang **chờ xác nhận** để thử), 3 phiếu sửa (đã giao, đang kiểm tra, bảo hành miễn phí). Tất cả đi qua hàm nghiệp vụ thật nên tiền/kho/giá vốn nhất quán. Chạy riêng: `pnpm db:seed:staging`.
- `--owner-email/--owner-name`: tạo chủ cửa hàng; **mật khẩu tạm hiện MỘT lần** ở cuối bước 7 của lệnh — chép ngay. Lần đầu đăng nhập: đổi mật khẩu → bật TOTP → lưu mã khôi phục. (Nếu đã `--seed`, DB đã có chủ demo nên bước tạo chủ sẽ báo "đã có chủ" — bình thường.)
- Chạy lại bao nhiêu lần cũng được (idempotent). Mỗi lần có migration mới, chỉ cần chạy lại **không kèm** `--seed`.

**6) Đẩy biến môi trường lên Vercel** (Preview, chỉ nhánh `staging`; bí mật đặt kiểu *Sensitive*):
```bash
pnpm vercel:env:staging -- --dry-run     # xem trước
pnpm vercel:env:staging
```

**7) Deploy**:
```bash
git push origin staging
```
Vercel tự build bản Preview. Xem ở *Vercel → watchflow → Deployments*. URL cố định của nhánh có dạng `https://watchflow-git-staging-doanhaiduys-projects.vercel.app`. Preview mặc định được **Vercel Authentication** bảo vệ (đăng nhập tài khoản Vercel mới xem được) — giữ nguyên cho staging.
- Điền URL đó vào `APP_URL` trong `.env.staging`, chạy `pnpm vercel:env:staging -- --only NEXT_PUBLIC_APP_URL`, rồi *Redeploy* (không bắt buộc, hiện chưa mã nào dùng biến này).

**8) Smoke test** (§5.7) rồi qua A2.

### A2. PRODUCTION (khi staging đã ổn và chủ dự án đồng ý — có thể phát sinh phí)

1. Tạo project Supabase **thứ hai** `watchflow-production` (Singapore, nên gói **Pro**: Free tự tạm ngưng và không sao lưu hằng ngày). Làm lại bước 2–4 của A1 với `.env.production` (project ref/mật khẩu/khóa **khác** staging). `APP_URL` = `https://<tên miền>` (hoặc URL Vercel); `VAPID_CONTACT_EMAIL` = email thật.
2. `pnpm env:check production --ping`
3. `pnpm db:deploy:production -- --yes --owner-email <email-chủ-thật> --owner-name "Họ tên"` — **không** có `--seed`. Chủ tự đăng nhập, đổi mật khẩu, bật TOTP, cất mã khôi phục.
4. `pnpm vercel:env:production`
5. Gộp `staging` vào `main` và push `main` ⇒ Vercel build **Production**. Kiểm `https://<miền>/api/health` và `?deep=1`.
6. Thêm tên miền ở *Vercel → Settings → Domains* (hỏi chủ trước).
7. Sao lưu tự động (§8), monitor uptime, chuyển repo GitHub sang **private** trước khi có dữ liệu khách thật.

### A3. Mỗi lần phát hành sau
```bash
pnpm version:bump patch "Tiêu đề"     # + viết changelog
pnpm typecheck && pnpm build && pnpm test
pnpm db:deploy:staging                 # nếu có migration mới
git push origin staging                # kiểm Preview
# Production — nếu DB đã có dữ liệu: sao lưu trước rồi báo script biết:
pnpm db:deploy:production -- --yes --backup-done
git switch main && git merge staging && git push origin main && git switch staging
```
Biến môi trường mới (nếu có): thêm vào `.env.<env>` và `scripts/deploy/vercel-env.mjs` (danh sách `VARS`), chạy `pnpm vercel:env:<env>` **trước** khi deploy.

---

## 1. Bức tranh tổng quát

| | local | staging | production |
|---|---|---|---|
| Mã nguồn | máy dev | nhánh `staging` | nhánh `main` |
| Ứng dụng | `pnpm dev` | Vercel **Preview** (nhánh `staging`) | Vercel **Production** |
| DB | PostgreSQL 127.0.0.1:54329 | Supabase project **staging** | Supabase project **production** |
| Tệp ảnh | `.local/storage` | Supabase Storage (staging) | Supabase Storage (production) |
| Cấu hình | `.env.local` | `.env.staging` + Vercel Preview | `.env.production` + Vercel Production |
| Cron | gọi tay | **không tự chạy** (Vercel chỉ chạy cron ở Production) — gọi tay khi cần thử | Vercel Cron 06:00 và 21:00 giờ VN (`vercel.json`) |
| Sao lưu | `pnpm db:backup` | tùy chọn | repo riêng `watchflow-backups` (GitHub Actions hằng đêm) |

Vùng: **Supabase Singapore `ap-southeast-1`** + **Vercel `sin1`** (`vercel.json`). Hai thứ phải cùng vùng.

Gói: production nên dùng **Supabase Pro** và **Vercel Pro** (Hobby không dành cho mục đích thương mại). Staging dùng Free/Hobby được. *Kiểm lại giá/điều khoản hiện hành trước khi mua — hỏi chủ dự án.*

Kiến trúc DB cần biết (`security-model` §2):
- Ứng dụng đăng nhập bằng vai trò **`wf_api`** (LOGIN, NOINHERIT), mỗi request `SET ROLE wf_app` ⇒ RLS có hiệu lực. **Không** dùng `postgres`/`service_role` cho ứng dụng.
- Migration chạy bằng chủ DB (`postgres`) và tạo `wf_owner`, `wf_definer` (BYPASSRLS), `wf_app`, `wf_auth`, `wf_worker` (BYPASSRLS), `wf_api`, `wf_backup` (BYPASSRLS, chỉ SELECT).
- Ứng dụng **không dùng Supabase Auth và không dùng Data API (PostgREST)** — tự xác thực (JWT EdDSA + Argon2id + TOTP). Data API phải tắt.

---

## 2. Điều kiện trước khi bắt đầu

- [x] Mã nguồn đã lên GitHub (`Doanhaiduy/WatchFlow`; hiện **public** ⇒ **chuyển private trước khi có dữ liệu thật**; bật Secret scanning + Push protection; bảo vệ nhánh `main`/`staging`).
- [x] Vercel project `watchflow` đã tạo và nối với repo; thư mục `.vercel/` (git-ignore) liên kết máy này.
- [ ] Máy có Node 22, pnpm 10 (`corepack enable`), Git, Vercel CLI đã `vercel login`. **PostgreSQL client tools** (`pg_dump`, `psql`) chỉ cần cho sao lưu/diễn tập — không cần cho các lệnh ở §A.
- [ ] `pnpm install`, `pnpm typecheck && pnpm build && pnpm test` xanh trên máy này.
- [ ] Tài khoản Supabase và Vercel **đứng tên chủ cửa hàng/pháp nhân** khi lên production (người triển khai chỉ được mời quyền tối thiểu — `runbook` §7).
- [ ] Tên miền production (hoặc tạm dùng URL Vercel).
- [ ] **Không đặt** `NODE_TLS_REJECT_UNAUTHORIZED=0` ở máy bạn hay Vercel.

Vercel build dùng Node **22.x** (khóa trong `package.json` → `engines`). Build **không cần** DB hay biến môi trường để chạy xong (đã kiểm), nhưng ứng dụng cần đủ biến khi chạy.

---

## 3. Supabase — từng môi trường

### 3.1 Phần làm tay (đã nêu ở §A1)
Tạo project · lấy 4 giá trị · tắt Data API · tắt đăng ký Auth · bật *Enforce SSL*. Production: bật gói Pro, cân nhắc **PITR** (hỏi chủ — có phí) và **Network restrictions** (nếu bật phải cho phép dải IP của Vercel + máy bạn + CI sao lưu; không chắc thì để trống và ghi vào báo cáo).

### 3.2 Phần script đã làm (trong `pnpm db:deploy:<env>`)
- **Chứng chỉ TLS:** `certs/supabase-root-2021-ca.crt` (CA gốc công khai *Supabase Root 2021 CA*, hết hạn 2031-04-26, SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`) đã nằm trong repo và được nạp vào `DB_SSL_CA`. Đã kiểm: xác minh được chứng chỉ của pooler (`aws-0-`/`aws-1-ap-southeast-1`, cổng 5432 và 6543); CA hệ thống thì **không** ⇒ bắt buộc đặt `DB_SSL_CA`.
- **Chuẩn bị vai trò** (`scripts/db/prepare-supabase.mjs`): kiểm `CREATEROLE` + `BYPASSRLS` (CQ-001), tạo trước các vai trò `wf_*`, cấp cho `postgres` với **`INHERIT TRUE, SET TRUE`** (PostgreSQL 16+), đưa extension nằm ở schema `extensions` về `public`.
  - Vì sao cần: không có bước này migration `0001` lỗi `must be able to SET ROLE "wf_owner"`.
  - Vì sao `INHERIT TRUE` (bản nháp cũ ghi `INHERIT FALSE`): `0001` đổi chủ schema `app` sang `wf_owner` rồi vẫn tiếp tục tạo hàm trong đó; `postgres` của Supabase **không phải superuser** nên chỉ làm được nếu thừa hưởng quyền của `wf_owner`; nếu không, lỗi `permission denied for schema app`. (Đã tái hiện và xác nhận sửa được trên PostgreSQL 17.)
- **Bucket Storage** (`scripts/ops/create-buckets.mjs`): `unit-photos`, `repair-photos`, `documents`, `branding` — riêng tư, ≤ 15 MB/tệp; nếu bucket đang công khai sẽ chuyển riêng tư. Không tạo policy cho `anon`/`authenticated`: ứng dụng đọc/ghi bằng `service_role` **chỉ ở máy chủ** và tự kiểm quyền qua bảng `files` (RLS).
- **Không bật extension qua Dashboard.** Migration tự `CREATE EXTENSION` `citext`, `pg_trgm`, `unaccent` vào schema `public`; mã gọi `public.unaccent(...)`. `pgcrypto` có sẵn ở schema `extensions`; cảnh báo `no privileges could be revoked` từ migration `0013` với pgcrypto là bình thường.

### 3.3 Chuỗi kết nối (script tự dẫn xuất từ 4 giá trị)
| Dùng cho | Kiểu | Tên đăng nhập | Dạng |
|---|---|---|---|
| `MIGRATE_DATABASE_URL` (máy bạn: migrate, bootstrap, backup, audit) | **Session pooler 5432** | `postgres.<ref>` | `postgres://postgres.<ref>:<DB_PASSWORD>@<host>:5432/postgres?sslmode=require` |
| `DATABASE_URL` (ứng dụng trên Vercel) | **Transaction pooler 6543** | **`wf_api.<ref>`** | `postgres://wf_api.<ref>:<WF_API_PASSWORD>@<host>:6543/postgres` |
| `BACKUP_DATABASE_URL` (repo sao lưu) | Session pooler 5432 | `wf_backup.<ref>` | do `scripts/ops/create-backup-role.mjs` sinh (§8) |

- Vai trò `wf_api` chỉ tồn tại **sau** khi `db:deploy` chạy; mật khẩu của nó là `WF_API_PASSWORD` (đã sinh sẵn, `migrate` tự đặt).
- Ứng dụng tự bỏ `sslmode`/`sslrootcert` khỏi URL khi có `DB_SSL_CA` (`src/server/db.ts`); các script cũng làm vậy (`scripts/lib/db.mjs`). Thiếu `DB_SSL_CA` ⇒ từ chối kết nối DB ngoài máy.
- Mật khẩu có ký tự đặc biệt được URL-encode tự động.

---

## 4. Biến môi trường

`pnpm env:init <env>` sinh `.env.<env>` gồm 3 khối:

1. **BƯỚC 1 — bạn điền** (từ dashboard): `SB_PROJECT_REF`, `SB_DB_PASSWORD`, `SB_POOLER_HOST`, `SB_SERVICE_ROLE_KEY`, `APP_URL`, `VAPID_CONTACT_EMAIL` (+ `SB_CA_FILE` mặc định đã đúng).
2. **BƯỚC 2 — đã sinh sẵn, đừng đổi:** `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_KID`, `PII_KEY_V1`, `PII_BIDX_KEY`, `CRON_SECRET`, `OPS_HEARTBEAT_SECRET`, `WF_API_PASSWORD`, `VAPID_*`.
3. **BƯỚC 3 — script ghi** mỗi lần `pnpm env:check` / `db:deploy` / `vercel:env`: `MIGRATE_DATABASE_URL`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DB_SSL_CA`, `DB_POOL_MAX=3`, `DB_AUX_POOL_MAX=2`, `STORAGE_DRIVER=supabase`, `NEXT_PUBLIC_APP_URL`.

`pnpm env:init` **từ chối ghi đè** file có sẵn (tránh vô tình đổi khóa PII). `--force` chỉ dùng khi CHƯA có dữ liệu (bản cũ lưu `.env.<env>.bak-<giờ>`). Sau khi điền, cất bản sao toàn bộ file vào trình quản lý mật khẩu (biến *Sensitive* trên Vercel không đọc lại được).

Biến nào đặt ở đâu (`vercel:env` làm hộ cột Vercel):

| Biến | `.env.<env>` | Vercel | Repo sao lưu (Secrets) |
|---|---|---|---|
| `MIGRATE_DATABASE_URL` | ✅ | ❌ **không bao giờ** | ❌ |
| `WF_API_PASSWORD` | ✅ | ❌ (đã nằm trong `DATABASE_URL`) | ❌ |
| `DATABASE_URL` | ✅ | ✅ Sensitive | ❌ |
| `DB_SSL_CA`, `DB_POOL_MAX`, `DB_AUX_POOL_MAX` | ✅ | ✅ | ❌ |
| `AUTH_JWT_PRIVATE_KEY` | ✅ | ✅ Sensitive | ❌ |
| `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_KID` | ✅ | ✅ | ❌ |
| `PII_KEY_V1`, `PII_BIDX_KEY`, `CRON_SECRET` | ✅ | ✅ Sensitive | ❌ |
| `OPS_HEARTBEAT_SECRET` | ✅ | ✅ Sensitive | ✅ |
| `STORAGE_DRIVER`, `SUPABASE_URL`, `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | `SUPABASE_URL` ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ Sensitive | ✅ (workflow Storage) |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | ✅ | ✅ | ❌ |
| `VAPID_PRIVATE_KEY` | ✅ | ✅ Sensitive | ❌ |
| `OPS_REQUIRE_BACKUP_HEARTBEAT` | tùy | ✅ (production, **sau khi** repo sao lưu chạy được) | ❌ |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, `OPS_HEARTBEAT_URL` | ❌ | ❌ | ✅ |

**Không đặt** ở staging/production: `ALLOW_REMOTE_DB` (Vercel tự nhận qua `VERCEL=1`), `COOKIE_SECURE` (mặc định bật), `WF_TEST_MODE`, `WF_PUSH_FAKE`, `WF_PUSH_FAKE_FILE`, `WF_ENABLE_DEV_DESIGN`, `DB_TRACE`, `NODE_TLS_REJECT_UNAUTHORIZED`.

Khóa `service_role` phải ở dạng JWT (tab *Legacy*): code Storage hiện gửi nó qua `Authorization: Bearer`. Khóa kiểu `sb_secret_…` chưa được hỗ trợ (`env:check` báo rõ). Nếu Supabase ngừng cấp khóa legacy, cần sửa `src/server/storage.ts` (thêm header `apikey`) — ghi trong CONFIRM nếu gặp.

---

## 5. Staging — chi tiết các bước

### 5.1 – 5.4 (DB)
Đã gói trong `pnpm db:deploy:staging` (§A1 bước 5). Các bước nó chạy, theo thứ tự, dừng ngay khi lỗi:

1. Kiểm `.env.staging` (đủ biến, đúng định dạng, không trùng production).
2. Nối DB bằng chủ DB; chuẩn bị Supabase (§3.2).
3. Liệt kê migration chờ áp rồi áp thật (mỗi tệp một transaction; **không sửa tệp đã áp**) và đặt mật khẩu `wf_api`.
4. `db:audit` (RLS, owner, index FK, trigger append-only…).
5. Thử đúng đường của ứng dụng: đăng nhập `wf_api` qua pooler 6543 → `SET LOCAL ROLE wf_app`.
6. Tạo bucket Storage.
7. (Tùy chọn) `--owner-email/--owner-name` tạo chủ cửa hàng.
8. (Tùy chọn, **chỉ staging**) `--seed`.

Chạy riêng từng phần khi cần: `node scripts/db/prepare-supabase.mjs --env staging` · `pnpm db:migrate:staging -- --dry-run` · `node scripts/db/audit.mjs --env staging` · `node scripts/ops/create-buckets.mjs --env staging` · `pnpm owner:staging -- --email … --name …` · `pnpm db:seed:staging` · `node scripts/db/sql.mjs --env staging "SELECT …"`.

Nếu lỗi do môi trường Supabase (quyền, extension): báo lại nguyên văn; cách sửa đúng là migration mới hoặc bước chuẩn bị, do chủ dự án quyết.

### 5.5 Vercel
Đã làm sẵn bằng CLI: tạo project `watchflow`, nối repo `Doanhaiduy/WatchFlow`, nhánh `staging`. Production Branch = `main` (mặc định).
- Biến môi trường: `pnpm vercel:env:staging` (§A1 bước 6) — đặt cho **Preview giới hạn nhánh `staging`**; bí mật là *Sensitive*.
- Việc còn lại trên dashboard (nếu muốn): *Settings → Deployment Protection* giữ bật cho Preview; *Settings → Domains* gán alias dễ nhớ cho nhánh `staging`.
- **Push nhánh mà Vercel không build?** Vercel GitHub App chưa có quyền với repo mới: vào https://github.com/settings/installations → *Vercel* → *Configure* → *Repository access* → thêm `WatchFlow` (hoặc chọn *All repositories*), rồi push lại. Hoặc triển khai tay: `vercel deploy` (Preview) / `vercel deploy --prod`.
- Build lỗi ⇒ đọc log; thường do thiếu biến môi trường (build không cần DB nhưng runtime cần).

### 5.6 Vai trò sao lưu (tùy chọn ở staging, bắt buộc ở production)
```bash
node scripts/ops/create-backup-role.mjs --env staging
```
Ghi chuỗi kết nối `wf_backup` vào `backup/backup-db-url-staging.txt` (git-ignore) và tự kiểm rằng vai trò này **không ghi được**. Chuỗi này dùng cổng 5432; qua pooler tên đăng nhập phải có dạng `wf_backup.<ref>` — kiểm trước khi đặt vào secret.

### 5.7 Smoke test (làm đủ, ghi kết quả)
- [ ] `GET /api/health` ⇒ 200 có `version: 0.14.1`; `GET /api/health?deep=1` ⇒ migration đủ, DB nối được.
- [ ] Đăng nhập chủ ⇒ đổi mật khẩu ⇒ TOTP ⇒ vào Tổng quan. Đăng xuất/đăng nhập lại.
- [ ] Quản trị → Cài đặt: điền thông tin cửa hàng (tên, địa chỉ, SĐT, chân phiếu, điều khoản bảo hành/sửa chữa) ⇒ hiện đúng trên phiếu bán/phiếu sửa in ra.
- [ ] Tạo người dùng bán hàng/kho/CTV; kiểm menu theo quyền.
- [ ] Thêm thương hiệu/loại, một chiếc **có ảnh** ⇒ ảnh hiện; trên Supabase Storage thấy tệp trong bucket riêng tư.
- [ ] Bán thử một phiếu, in phiếu, tải PDF; hủy phiếu (lý do ≥ 10 ký tự).
- [ ] Nhập Excel thử 2–3 khách giả bằng tệp mẫu.
- [ ] Cron gọi tay (staging không có cron tự động): `curl -H "Authorization: Bearer <CRON_SECRET>" https://<url-staging>/api/cron/daily` và `…/api/cron/evening` ⇒ 200; Quản trị → Hệ thống thấy lượt chạy. (Preview có Vercel Authentication nên cần thêm *protection bypass* hoặc chạy qua `vercel curl`.)
- [ ] PWA trên điện thoại thật (HTTPS): cài lên màn hình chính, tắt mạng thấy trang offline, mở link trong Zalo thấy dải cảnh báo.
- [ ] Thông báo đẩy: bật trên thiết bị (iPhone phải cài app vào màn hình chính trước) ⇒ "Gửi thử" nhận được.
- [ ] Header bảo mật: `Content-Security-Policy` có `nonce`, `Strict-Transport-Security`; cookie phiên `__Host-wf_at`.
- [ ] Quản trị → Hệ thống: không lỗi; dung lượng kho hiện số.

---

## 6. Production lần đầu
Xem §A2. Khác staging: bộ khóa/project **riêng**; `--yes` bắt buộc cho `db:deploy:production`; **không** `--seed`; nếu DB đã có dữ liệu và có migration chờ áp thì cần sao lưu và thêm `--backup-done`. Sau go-live:

1. Monitor uptime (UptimeRobot hoặc tương tự): `https://<miền>/api/health` (5 phút) và `?deep=1` (30 phút), cảnh báo email/Zalo cho chủ.
2. Repo sao lưu chạy được ⇒ đặt `OPS_REQUIRE_BACKUP_HEARTBEAT=1` trên Vercel Production ⇒ redeploy.
3. Smoke test như §5.7 **với dữ liệu thử rồi hủy** (không tạo khách giả trong production — dùng một chiếc thử, hủy phiếu có lý do "Kiểm tra sau triển khai").
4. Nhập dữ liệu ban đầu thật: thương hiệu/loại, vị trí kho, vai trò & hạn mức giảm giá, người dùng, hồ sơ CTV, thông tin cửa hàng in phiếu, bảo hành; **tồn đầu kỳ** bằng *Nhập Excel → Đồng hồ* (một phiếu `opening`) hoặc nhập tay.
5. Chuyển repo GitHub sang **private** trước khi có dữ liệu thật.

---

## 7. Phát hành sau
Xem §A3 và `docs/04-engineering/release-process.md` §3. Migration luôn tương thích ngược (expand/contract) nên code cũ chạy được trên DB mới trong lúc chờ deploy.

---

## 8. Sao lưu tự động (repo riêng `watchflow-backups`)

Thiết kế: `docs/05-operations/backup-restore.md` §2–§6. Mẫu trong repo: `ops/backup-repo/README.md` và `ops/backup-repo/.github/workflows/backup.yml` (đã viết, **chưa chạy thật**).

Việc cần làm một lần (production):
1. Tạo repo GitHub **private** `watchflow-backups`, chép nội dung `ops/backup-repo/` vào (README + `.github/workflows/backup.yml`).
2. `node scripts/ops/create-backup-role.mjs --env production` ⇒ lấy chuỗi từ `backup/backup-db-url-production.txt`.
3. Đặt Secrets của repo sao lưu: `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` (sinh ngẫu nhiên dài, cất trình quản lý mật khẩu — mất là không giải mã được), `OPS_HEARTBEAT_URL` (`https://<miền>/api/v1/public/ops-heartbeat`), `OPS_HEARTBEAT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_REPO_READ_TOKEN` (token chỉ-đọc để workflow lấy mã của repo ứng dụng).
4. Chạy tay workflow (`workflow_dispatch`) lần đầu; tải một bản về, giải mã `node scripts/db/backup.mjs --decrypt <tệp> --out restore.dump`, khôi phục thử vào Postgres local (`pnpm db:restore-drill` làm mẫu) ⇒ ghi kết quả vào `backup-restore` §6. Quản trị → Hệ thống phải hiện "Sao lưu gần nhất".

CI (`.github/workflows/ci.yml`) chạy khi push `main`/`staging`/PR. Lần đầu đỏ ở bước dựng PostgreSQL cục bộ; đã sửa (tắt Unix socket trên Linux) và thêm bước in `pg.log` khi lỗi — nếu vẫn đỏ, đọc log đó, **không** tắt bước kiểm.

---

## 9. Rollback & sự cố
- **Code lỗi:** Vercel → Deployments → bản trước → *Promote to Production* (Instant Rollback). Không đổi DB.
- **Migration lỗi giữa chừng:** tệp lỗi tự rollback; các tệp trước vẫn giữ. Code cũ vẫn chạy (tương thích ngược). Sửa bằng migration mới, thử trên staging trước.
- **Mất dữ liệu:** `backup-restore` §5.
- **Lộ khóa:** xoay khóa theo `runbook` §5 (JWT: thêm KID mới; PII: KHÔNG đổi tùy tiện; `CRON_SECRET`/`OPS_HEARTBEAT_SECRET`/`service_role`: đổi ngay ở cả Vercel và repo sao lưu). Với biến đặt qua script: sửa trong `.env.<env>` rồi `pnpm vercel:env:<env> -- --only <TÊN>`.
- Sự cố thường gặp: `runbook` §4.

---

## 10. Bẫy đã biết

| Triệu chứng | Nguyên nhân | Cách xử |
|---|---|---|
| `must be able to SET ROLE "wf_owner"` khi migrate | PostgreSQL 16+: người chạy chưa được cấp vai trò | `pnpm db:deploy:<env>` tự xử lý (`prepare-supabase`) |
| `permission denied for schema app` khi migrate | Cấp vai trò với `INHERIT FALSE` | Dùng `INHERIT TRUE, SET TRUE` (script đã làm đúng) |
| `Tenant or user not found` | Sai `SB_PROJECT_REF` hoặc `SB_POOLER_HOST` (`aws-0` ↔ `aws-1`) | Chép lại từ nút **Connect** |
| `ENOTFOUND db.<ref>.supabase.co` / timeout | Host Direct chỉ IPv6 | Dùng host pooler |
| `password authentication failed for user "postgres.<ref>"` | Sai `SB_DB_PASSWORD` | Reset database password rồi điền lại |
| `password authentication failed for user "wf_api"` | `wf_api` chưa có mật khẩu | Chạy lại `pnpm db:deploy:<env>` |
| `DB ngoài máy cần TLS có kiểm chứng chỉ` | Thiếu `DB_SSL_CA` | `pnpm env:check <env>` (nạp từ `certs/`) |
| `permission denied to create role` / thiếu BYPASSRLS | `postgres` của Supabase thiếu quyền | Dừng, báo chủ (CQ-001) |
| Tìm kiếm không dấu lỗi `function public.unaccent … does not exist` | Extension bị bật vào schema `extensions` | `db:deploy` tự chuyển về `public` |
| Đăng nhập xong bị đá ra ngay | Không phải HTTPS; hoặc `COOKIE_SECURE=false` | Bỏ `COOKIE_SECURE`; truy cập bằng HTTPS |
| Hết kết nối DB (`too many clients`) | Pool lớn × nhiều instance | `DB_POOL_MAX=3`, `DB_AUX_POOL_MAX=2`, dùng cổng 6543 |
| Biến Sensitive "trống" khi `vercel env pull` | Vercel không cho đọc lại | Giữ bản gốc ở `.env.<env>` + trình quản lý mật khẩu |
| Push nhánh mà Vercel không build | Vercel GitHub App chưa có quyền với repo | §5.5 |
| Cron không chạy ở staging | Vercel chỉ chạy cron ở Production | Gọi tay bằng `curl` có Bearer |
| Ảnh tải lên lỗi 500 | Thiếu bucket / `STORAGE_DRIVER` / sai service_role (hoặc khóa `sb_secret_`) | `pnpm db:deploy:<env>` + §4 |
| Thông báo đẩy không đến | Thiếu VAPID; iPhone chưa cài app vào màn hình chính | §4 |
| Build hỏng `check-version` | Phiên bản lệch changelog hoặc còn `TODO` | `pnpm version:bump` + viết changelog |

---

## 11. Thông tin chủ dự án cần cung cấp
- Quyền vào tổ chức GitHub/repo, Supabase org, Vercel team.
- Quyết định gói (Supabase/Vercel staging & production), có bật PITR / Network restrictions không.
- Tên miền production (và quyền sửa DNS) — hoặc tạm dùng URL Vercel.
- Email thật của chủ cửa hàng (`bootstrap-owner` production, `VAPID_CONTACT_EMAIL`) và email nhận cảnh báo uptime/sao lưu.
- Trình quản lý mật khẩu để cất khóa.
- Các câu chờ xác nhận ở `CONFIRM.md` (đặc biệt 🔴 CQ-001 BYPASSRLS, CQ-018 thiết bị tin cậy 30 ngày) nên được chốt trước production.

---

## 12. Mẫu báo cáo sau khi triển khai (KHÔNG kèm bí mật)
```
Môi trường: staging | production        Ngày: …        Phiên bản: …
Supabase: ref …  · region …  · Postgres …  · gói …  · Data API: tắt ✔  · SSL enforce ✔  · buckets 4/4 ✔
pnpm env:check --ping: ✔/✘ (lỗi nguyên văn nếu có)
pnpm db:deploy: … migration áp ✔ · db:audit ✔ · thử đường ứng dụng ✔
Owner: đã tạo cho … (mật khẩu tạm đã giao qua …)
Vercel: project … · nhánh … · biến môi trường (pnpm vercel:env) ✔ · domain … · cron hiển thị ✔/—
Smoke test §5.7: [liệt kê từng mục ✔/✘ + ghi chú]
Sao lưu: wf_backup ✔ · workflow đã chạy ✔/✘ · diễn tập ✔/✘ · heartbeat ✔/✘
Uptime monitor: ✔/✘        Repo private: ✔/✘        Secret scanning: ✔/✘
Vấn đề gặp & cách xử: …
Việc còn lại cho chủ dự án: …
```
Sau khi xong, cập nhật `docs/05-operations/runbook.md` §1 (địa chỉ & thành phần) và đánh dấu các mục đã làm ở §8.
