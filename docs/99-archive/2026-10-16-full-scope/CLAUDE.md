# CLAUDE.md — WatchFlow

Luật làm việc cho mọi phiên (AI hoặc người). **Đọc kỹ mục "Quy tắc sắt" trước khi động tới DB, tiền, kho, biến môi trường hay deploy.** Mẫu tham khảo: dự án Lưu Xá (`D:\THCode\tools\luu_xa_phanxico`) — copy cái đã kiểm thử, đừng viết lại.

## Dự án
WatchFlow: web app quản lý cửa hàng đồng hồ — nhập hàng, kho theo từng chiếc (serial), bán/tính tiền, giữ hàng/cọc, thu cũ đổi mới, đổi trả, sửa chữa + linh kiện, giá vốn & lãi gộp, thu chi & công nợ, báo cáo, phân quyền (chủ, bán hàng, thợ, kho, cộng tác viên), sao lưu.
Next.js (App Router) + TypeScript (strict) + Tailwind · PostgreSQL (Supabase) với **Row-Level Security** · Vercel. **Giao diện/tài liệu/thông báo lỗi: tiếng Việt. Tên trong code (bảng, cột, hàm, biến): tiếng Anh** (bảng đối chiếu: `docs/02-domain/glossary.md`).

## Đọc gì trước
1. `docs/README.md` — bản đồ tài liệu.
2. Việc liên quan tiền/kho → `docs/02-domain/{business-rules,money-and-ledger,costing-and-profit,state-machines}.md`.
3. Việc DB → `docs/03-architecture/{data-model,integrity-and-concurrency,security-model}.md` + `docs/04-engineering/migrations.md`.
4. Việc mới theo kế hoạch → `docs/04-engineering/build-plan.md` (mốc M0…M9, mỗi mốc có "Định nghĩa hoàn thành").
5. **Code và docs mâu thuẫn ⇒ DỪNG, báo người dùng.** Không tự chọn bên nào. Sửa xong thì cập nhật docs cùng lúc.

## Môi trường (QUAN TRỌNG)

| Môi trường | Git / Vercel | Dữ liệu | File cấu hình (KHÔNG commit) |
|---|---|---|---|
| local | máy dev `http://localhost:3000` | PostgreSQL portable `127.0.0.1:54329`, DB `watchflow`, tệp ở `.local/storage` | `.env.local` |
| staging | nhánh `staging` → Vercel **Preview** | Supabase project staging | `.env.staging` |
| production | nhánh `main` → Vercel **Production** | Supabase project production | `.env.production` |

- **`.env.local` CHỈ được trỏ DB local.** Không bao giờ trỏ staging/production (Lưu Xá từng mắc lỗi này). Muốn thử trên staging dùng `pnpm dev:staging` (có cảnh báo rõ).
- Mỗi môi trường có **bộ khóa riêng** (`AUTH_JWT_*`, `PII_*`, `CRON_SECRET`, mật khẩu các vai trò DB). `pnpm env:keys` sinh khóa mới (chỉ in màn hình). Đổi `PII_*` = dữ liệu mã hóa cũ không đọc được.
- Supabase: luôn dùng **pooler** (transaction mode, cổng **6543**) cho ứng dụng; cổng 5432 (`MIGRATE_DATABASE_URL`, chủ DB) chỉ cho script migrate/backup trên máy dev, **không đưa lên Vercel**. Host trực tiếp `db.<ref>.supabase.co` chỉ có IPv6 — máy dev thường không phân giải được. **Tắt Data API (PostgREST)**, thu quyền `anon`/`authenticated`.
- Vercel biến kiểu *Sensitive* **không đọc lại được** (`vercel env pull` trả rỗng): luôn giữ bản gốc ở `.env.<môi trường>` + trình quản lý mật khẩu.
- Vercel **Hobby không dành cho thương mại** — cửa hàng thật dùng gói Pro; Supabase gói Free tự tạm ngưng & không sao lưu hằng ngày — production dùng gói Pro (kiểm tra lại giá/điều khoản hiện hành khi mua).
- Vùng: Vercel Functions và Supabase cùng vùng Singapore (`sin1` / `ap-southeast-1`) — mỗi vòng mạng tới DB phải ở mức vài ms.

## Lệnh hay dùng (có sau mốc M0)
`pnpm dev` · `pnpm typecheck` · `pnpm build` (tự chạy `check-version`) · `pnpm test` (đơn vị) · `pnpm test:api` (tích hợp trên DB thật, có bộ đồng thời + phân quyền) · `pnpm test:e2e` · `pnpm db:start|stop|status` · `pnpm db:migrate[:staging|:production]` (luôn `-- --dry-run` trước) · `pnpm db:seed` (demo) · `pnpm db:backup` · `pnpm version:bump <patch|minor|major> "Tiêu đề"` · `pnpm env:keys`.

## Quy tắc sắt (không thương lượng)

### Tiền
- Tiền = **số nguyên VND** (`bigint` ở DB, `number` ở JS, mọi giá trị < 2^53). **Không float.** Linh kiện có giá vốn bình quân `numeric(14,4)`, khi chốt vào dòng thì làm tròn nửa lên về đồng. Phân bổ chi phí/giảm giá theo `docs/02-domain/costing-and-profit.md` §Làm tròn. Hàm dùng chung: `src/lib/money.ts` (+ test).
- **Doanh thu KHÔNG BAO GIỜ tính từ thanh toán/sổ quỹ.** Doanh thu tính từ chứng từ (phiếu bán, phiếu sửa đã giao, đổi trả). Sổ quỹ chỉ nói tiền đi đâu. (BR-FIN-04)
- Thời gian lưu UTC (`timestamptz`); ngày chứng từ là **ngày giờ Việt Nam** (`Asia/Ho_Chi_Minh`) kiểu `date`. Không dùng `new Date("YYYY-MM-DD")` để cộng trừ ngày.

### Ghi dữ liệu
- Mọi thao tác nhiều bước (xác nhận phiếu nhập/bán, đổi trả, giữ hàng, chi tiền, hoàn thành sửa, kiểm kê…) = **một hàm DB `app.fn_*`** chạy trong **một transaction**: kho + tiền + giá vốn + audit + sự kiện cùng thành công hoặc cùng thất bại (BR-GEN-02, III.6). API chỉ kiểm quyền sớm rồi gọi hàm.
- Chứng từ: `draft → confirmed → voided`. **Đã xác nhận = bất biến.** Sửa sai = hủy/đảo/điều chỉnh có lý do ≥ 10 ký tự. Không `DELETE` dữ liệu đã xác nhận. Sổ quỹ, audit, lịch sử trạng thái, bút toán giá vốn = append-only (trigger chặn UPDATE/DELETE/TRUNCATE).
- Trạng thái chiếc đồng hồ chỉ đổi qua hàm nghiệp vụ theo ma trận (`docs/02-domain/state-machines.md`); app role **không** có quyền `UPDATE status`.
- Khóa theo thứ tự cố định để tránh deadlock: **chiếc (id tăng) → linh kiện (id tăng) → giữ hàng → quỹ (id tăng)** (`docs/03-architecture/integrity-and-concurrency.md`).
- Thao tác POST quan trọng nhận header `Idempotency-Key`; bấm đúp không được tạo hai chứng từ.

### Phân quyền & dữ liệu nhạy cảm
- Kiểm theo **permission** (`useSession().can("cost.view")`, `app.has_permission(...)`), **không bao giờ theo tên vai trò**. Thêm quyền ⇒ migration + `src/lib/permissions.ts` + ma trận ở `docs/03-architecture/security-model.md`.
- **Giá vốn / lợi nhuận / công nợ** nằm ở bảng riêng có RLS theo quyền (`unit_cost_entries`, `sale_line_costs`, `part_costs`, `repair_line_costs`…). Chỉ ẩn trên UI là **chưa đủ**. Báo cáo/xuất Excel/PDF/in cũng đi qua cùng lớp quyền.
- PII (CCCD người bán, SĐT phụ…) mã hóa AES-256-GCM ở tầng ứng dụng; xem đầy đủ phải nêu lý do + ghi audit. **Không log PII, không đưa PII vào URL, không gửi cho AI.**
- Khóa/mật khẩu/chuỗi kết nối **không bao giờ** vào mã, commit, docs, CLAUDE.md, memory hay ảnh chụp. Repo để **private**; bật secret scanning ngay ngày đầu. Chuỗi kết nối từng lọt vào git ở dự án mẫu — đừng lặp lại.

### Bảng mới / migration
Mỗi bảng mới **bắt buộc**: `ENABLE` + `FORCE ROW LEVEL SECURITY`, `OWNER TO wf_owner`, `REVOKE ALL … FROM wf_app` rồi `GRANT` từng quyền/cột cần, chính sách RLS, trigger audit `app.tg_audit` (bảng nghiệp vụ), index cho mọi FK, comment tiếng Việt đầu file. Hàm đặc quyền: `SECURITY DEFINER`, `SET search_path = public, app, pg_temp`, `OWNER TO wf_definer`, `REVOKE ALL FROM PUBLIC` rồi `GRANT EXECUTE` đúng vai trò. Chi tiết + mẫu: `docs/04-engineering/migrations.md`. **Không sửa file migration đã áp** (sha256 đổi ⇒ bị chạy lại) — tạo file mới.

## Quy trình phát hành (làm theo thứ tự)
0. **Mỗi lần phát hành TĂNG PHIÊN BẢN**: `pnpm version:bump <patch|minor|major> "Tiêu đề"` (sửa `package.json` + thêm mục đầu `src/content/changelog.ts`, rồi viết nội dung thay `TODO`). `pnpm build` HỎNG nếu lệch hoặc còn `TODO`. Số phiên bản không gõ cứng ở nơi khác.
1. Code xong → `pnpm typecheck` + `pnpm build` + `pnpm test:api` (phần liên quan) phải qua.
2. Có migration → áp lên **staging trước** (`--dry-run` rồi áp thật), push nhánh `staging`, kiểm tra Preview.
3. OK → sao lưu production → áp migration lên **production trước khi code mới lên** (migration luôn tương thích ngược: thêm trước, bỏ sau — "expand/contract") → push `main` → kiểm tra `/api/health` và đăng nhập.
4. Commit kiểu `feat|fix|chore(phạm-vi): mô tả tiếng Việt`.
5. **Không tự làm** nếu chưa được đồng ý riêng: xóa dữ liệu, `--reset`, force push, đổi biến môi trường Vercel/Supabase, đổi domain, chạy lệnh phá hủy trên production.

## Quy ước mã nguồn
- API: bọc bằng `api({auth?}, handler)` (`src/server/http.ts`); truy vấn qua `ctx.db(tx => …)` (đã `SET LOCAL ROLE wf_app` + `app.current_user_id` ⇒ RLS). GET chạy `READ ONLY`; GET có ghi dữ liệu phải khai `{ writes: true }`. Lỗi nghiệp vụ: `new ApiError(status, "WF-XXX-YYY", "Câu tiếng Việt")` — danh mục mã ở `docs/03-architecture/api-conventions.md`. Lỗi 5xx không lộ chi tiết kỹ thuật.
- Form dùng thành phần chung `src/components/ui/*` (không rải `<input>` thô). Giao diện **mobile-first**, kiểm tra ở 390px và chế độ sáng/tối. Hành động hay dùng ≤ 3 chạm (`docs/01-product/ux-and-navigation.md`).
- Tìm kiếm tiếng Việt không dấu: dùng `unaccent` + `pg_trgm` (cột `search_text`). **Đừng dùng `\b` trong regex với chữ có dấu** — dùng `(?![\p{L}])`.
- Tránh `*/` trong chú thích CSS (`bg-*/text-*`) — vỡ build CSS.
- Nhật ký: không `console.log` dữ liệu cá nhân; lỗi ghi qua `recordErrorEvent`.
- Thêm tính năng mới theo **module contract** (`docs/03-architecture/extensibility.md`): không ghi chéo bảng của module khác, giao tiếp qua hàm/`domain_events`.

## Định nghĩa hoàn thành (mỗi PR/tính năng)
1. Đúng BR liên quan (ghi ID trong mô tả PR); có ví dụ số nếu động tới tiền.
2. Migration: RLS + grant + audit + index; áp được 2 lần không lỗi; có dry-run.
3. Test: đơn vị cho tính toán; tích hợp trên DB thật **dưới `wf_app`** (không superuser); kịch bản vàng liên quan xanh; nếu động tới kho/tiền/trạng thái → thêm/cập nhật ca đồng thời (CT-xx); nếu thêm dữ liệu nhạy cảm → ca phân quyền (PT-xx).
4. Docs cập nhật cùng PR: BR, state machine, data model, FR (đánh ☑), user guide (`src/content/guide.ts`), changelog.
5. `typecheck` + `build` + `test:api` xanh; ảnh chụp 390px nếu đổi UI.

## Cạm bẫy đã biết (từ dự án mẫu)
- Pooler cổng 5432 = session mode → cạn kết nối khi nhiều hàm serverless; dùng 6543 và mỗi instance tối đa ~3 kết nối.
- Tài khoản dùng mật khẩu tạm / vai trò bắt buộc MFA chưa bật bị chặn mọi API trừ `/api/v1/auth/*`.
- Trigger dùng chung hai bảng: dùng `IF/ELSIF`, đừng dùng `CASE` tham chiếu `OLD.cột` của bảng kia.
- Job phân vùng/dọn dẹp thiếu quyền `CREATE`/`USAGE` làm hỏng ngầm — mọi job định kỳ phải có test chạy thật dưới đúng vai trò.
- Docs bị lệch thực tế (README nói một đằng, `.env.local` làm một nẻo) → mỗi PR đổi hành vi đổi docs; hết hạn "kiểm lần cuối" ghi ở đầu mỗi file docs.
