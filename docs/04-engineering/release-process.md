# Phát hành, phiên bản & CI/CD

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Mẫu: `CLAUDE.md`/`VAN_HANH.md` của Lưu Xá

## 1. Nhánh ↔ môi trường

| Nhánh | Vercel | Supabase | Ghi chú |
|---|---|---|---|
| `main` | Production | project production | Chỉ gộp từ `staging` sau khi kiểm xong |
| `staging` | Preview (alias cố định) | project staging | Nhánh tích hợp; mọi PR vào đây trước |
| `feat/*`, `fix/*` | Preview theo PR (dùng DB staging hoặc local) | — | Không migrate lên staging từ nhánh chưa gộp trừ khi chủ ý |

Bảo vệ nhánh: `main` và `staging` cấm force push, bắt buộc CI xanh + 1 review (nếu chỉ một người, bật "tự review có checklist").

## 2. Phiên bản

- Semver trong `package.json`: `patch` sửa lỗi nhỏ · `minor` thêm tính năng/màn hình · `major` đổi lớn.
- `pnpm version:bump <loại> "Tiêu đề"` sửa `package.json` + thêm mục đầu `src/content/changelog.ts` (có `TODO` cần thay bằng nội dung tiếng Việt cho người dùng).
- `pnpm build` chạy `scripts/check-version.mjs`: **hỏng nếu** `package.json` lệch mục đầu changelog hoặc còn `TODO`.
- `NEXT_PUBLIC_APP_VERSION` điền lúc build từ `package.json`; commit/ngày dựng điền lúc build; `/api/health` trả `version`/`builtAt`; hiển thị ở Quản trị → Phiên bản & chân trang.

## 3. Quy trình mỗi lần phát hành (thứ tự)

1. **Tăng phiên bản** + viết changelog.
2. Local: `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:api` (liên quan; đầy đủ nếu đụng lõi tiền/kho) · `pnpm db:audit` · chụp ảnh 390px nếu đổi UI.
3. Cập nhật docs (DoD) — `pnpm docs:check`.
4. **Có migration?** → áp lên **staging trước**: `pnpm db:migrate:staging -- --dry-run`, rồi áp thật.
5. Push `staging` → Vercel Preview build → kiểm: `/api/health?deep=1`, đăng nhập, luồng vừa đổi, **một vòng kịch bản vàng thủ công** nếu đụng lõi.
6. OK → **sao lưu production** (nếu có migration) → `pnpm db:migrate:production -- --dry-run` → áp thật **trước khi** code mới lên.
7. Merge `staging` → `main` → Vercel Production build → kiểm `/api/health`, đăng nhập, mở 3 màn hình trọng yếu (POS, nhập hàng, thu chi).
8. Ghi nhật ký phát hành (changelog đã có); báo người dùng nếu có thay đổi hành vi.

**Rollback:** code — Vercel "Promote previous deployment"/Instant Rollback (không đổi DB); DB — migration tương thích ngược nên thường không cần hoàn tác; nếu bắt buộc, dùng migration đảo viết sẵn đã thử trên staging; tồi nhất khôi phục từ bản sao lưu vừa chụp (RPO theo `backup-restore`).

## 4. Expand / contract (migration tương thích ngược)

| Bước | Phát hành | Làm gì |
|---|---|---|
| Expand | N | Thêm bảng/cột/hàm mới (nullable/có default), **giữ nguyên** cái cũ; code N+0 ghi cả hai nếu cần |
| Migrate | N | Backfill dữ liệu (migration data, idempotent) |
| Switch | N+1 | Code chỉ dùng cái mới |
| Contract | N+2 | Bỏ cột/hàm cũ (migration mới) khi chắc không còn dùng |

Không đổi tên/xóa cột trong cùng bản phát hành với code dùng nó.

## 5. CI (`.github/workflows/ci.yml`)

Trên PR và push `staging`/`main`: cài pnpm + Node → `typecheck` → `lint` → `vitest` → PostgreSQL 16 dịch vụ → migrate ×2 → `db:audit` → `test:api` (SC+PT+CT nhanh) → `build`. Bí mật CI chỉ gồm thứ cần thiết (DB test dùng mật khẩu ngẫu nhiên trong job). Nightly workflow: CT đầy đủ + `fn_consistency_check` trên DB test + kiểm link docs + (tùy chọn) `pnpm audit`.

## 6. Cấu hình Vercel

- `vercel.json`: `"regions": ["sin1"]`, `crons` theo `overview` §7 (gói Pro).
- Biến môi trường: Production ← `.env.production`; Preview ← `.env.staging`; `NEXT_PUBLIC_*` không chứa bí mật.
- Bật Web Analytics + Speed Insights; Deployment Protection cho Preview (chỉ thành viên) hoặc mật khẩu.
- Domain: sau khi có tên miền, đặt `NEXT_PUBLIC_APP_URL`, cookie `__Host-` yêu cầu HTTPS/không `Domain`.
- Không đưa `MIGRATE_DATABASE_URL` hay `.env.*` lên Vercel (`.vercelignore`).

## 7. Danh sách kiểm tra trước khi phát hành lên production

☐ Phiên bản & changelog · ☐ `typecheck`/`build`/`test:api` xanh · ☐ `db:audit` xanh · ☐ Docs cập nhật · ☐ Migration đã thử staging (kèm lần chạy thứ hai) · ☐ Đã sao lưu production · ☐ Biến môi trường mới đã đặt trên Vercel **trước** deploy · ☐ Kiểm Preview xong · ☐ Không có `TODO`/`console.log` dữ liệu cá nhân · ☐ Thông báo cho người dùng nếu đổi quy trình.

## 8. Việc cần xin phép riêng (không tự làm)

Xóa dữ liệu, `--reset`, force push, đổi biến môi trường Vercel/Supabase, đổi domain, chạy SQL tay trên production, tắt/bật tính năng bảo mật. Ghi lại vào `05-operations/runbook` §8 ("Việc cần làm tay") hoặc sổ nhật ký vận hành sau khi làm.
