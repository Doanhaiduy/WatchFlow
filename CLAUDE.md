# CLAUDE.md — WatchFlow

Luật làm việc cho mọi phiên (AI hoặc người). **Đọc kỹ mục "Quy tắc sắt" trước khi động tới DB, tiền, kho, biến môi trường hay deploy.** Mẫu tham khảo: dự án Lưu Xá (`D:\THCode\tools\luu_xa_phanxico`) — copy cái đã kiểm thử, đừng viết lại.

## Dự án
WatchFlow: web app cho **chủ cửa hàng đồng hồ** làm đúng **sáu việc** (chốt ở `docs/01-product/customer-feedback-02.md`, thắng `feedback-01` nếu mâu thuẫn): (1) quản lý đồng hồ đang có (kho, từng chiếc/serial, giá niêm yết, vị trí, tem QR); (2) **ghi đơn bán** khi khách mua — chỉ *chiếc + khách + giá + ngày* (+ hạn bảo hành) để tra cứu sau; (3) **giao đồng hồ cho cộng tác viên (CTV) bán — một chiếc giao được nhiều CTV, CTV nào báo "đã bán" trước được giữ, chủ xác nhận**; (4) quản lý **đơn sửa chữa của khách** (chỉ chủ); (5) báo cáo doanh thu / số lượng đồng hồ / CTV mang về theo ngày-tháng-quý-năm; (6) CTV dùng web ở mức giới hạn, **không thấy doanh thu**. Phân quyền (chủ, bán hàng, kho, CTV), sao lưu, nhập Excel (khách, đồng hồ).

**Phạm vi hiện tại — KHÔNG xây (đã bỏ khỏi giao diện/API; hàm & dữ liệu DB cũ để nguyên, đóng băng):** thanh toán/công nợ/QR chuyển khoản trên đơn bán, giảm giá/thu cũ đổi mới, giữ hàng & đặt cọc, nhập hàng nhiều dòng & chi phí nhập, linh kiện (tồn kho), kiểm kê, giá vốn & lãi gộp, giá thu/quyết toán/hưởng chênh lệch của CTV, cọc & thu tiền & linh kiện & sửa nội bộ trong sửa chữa, màn tra cứu bảo hành riêng; cùng (từ vòng 1) Thu chi & quỹ, Nhà cung cấp & công nợ NCC, Đổi trả/hoàn tiền, vai trò Thợ/tiền công, hoa hồng % cho CTV. Thiết kế đầy đủ nằm ở `docs/99-archive/` và lịch sử git (≤ v0.15.0). Nếu một yêu cầu/đoạn code dường như cần những thứ này ⇒ dừng, báo người dùng.
Next.js (App Router) + TypeScript (strict) + Tailwind · PostgreSQL (Supabase) với **Row-Level Security** · Vercel · giao diện **Glass** (mẫu khách chọn: `design/ui-preview/v6-glass.html`). **Giao diện/tài liệu/thông báo lỗi: tiếng Việt. Tên trong code (bảng, cột, hàm, biến): tiếng Anh** (bảng đối chiếu: `docs/02-domain/glossary.md`).

## Đọc gì trước
1. `docs/README.md` — bản đồ tài liệu.
2. Việc liên quan tiền/kho/CTV → `docs/02-domain/{business-rules,money-and-payments,state-machines,workflows}.md` (nhóm **LEAN** trong business-rules là luật hiện hành; `costing-and-profit` chỉ còn tham khảo).
   **Việc giao diện →** `docs/03-architecture/ui-design-system.md` (token, bố cục, thành phần, bản đồ màn hình mẫu→ứng dụng, cách dùng Lucian) + `docs/01-product/ux-and-navigation.md` + mở xem `design/ui-preview/v6-glass.html`.
3. Việc DB → `docs/03-architecture/{data-model,integrity-and-concurrency,security-model}.md` + `docs/04-engineering/migrations.md`.
4. Việc mới theo kế hoạch → `docs/04-engineering/build-plan.md` (mốc M0…M10, mỗi mốc có "Định nghĩa hoàn thành"; M10 = đợt rút gọn vòng 2).
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
**Triển khai (staging/production):** `pnpm env:init <env>` → điền ô dashboard → `pnpm env:check <env> --ping` → `pnpm db:deploy:<env>` (vai trò + migrate + audit + bucket; production cần `--yes`) → `pnpm vercel:env:<env>` → push nhánh. Hướng dẫn: `docs/05-operations/deploy-staging-production.md` §A.

## Quy tắc sắt (không thương lượng)

### Tiền
- Tiền = **số nguyên VND** (`bigint` ở DB, `number` ở JS, mọi giá trị < 2^53). **Không float.** Linh kiện có giá vốn bình quân `numeric(14,4)`, khi chốt vào dòng thì làm tròn nửa lên về đồng. Phân bổ chi phí/giảm giá theo `docs/02-domain/costing-and-profit.md` §Làm tròn. Hàm dùng chung: `src/lib/money.ts` (+ test).
- **Doanh thu KHÔNG BAO GIỜ tính từ thanh toán.** Doanh thu tính từ chứng từ (phiếu bán đã xác nhận, phiếu sửa đã giao). Thanh toán chỉ nói khách đã trả bao nhiêu cho phiếu nào; **không có quỹ/số dư**. (BR-PAY-02)
- **Đơn do CTV bán:** doanh thu cửa hàng = **giá chủ xác nhận khi duyệt báo bán** (mặc định giá niêm yết hiện hành, sửa được — BR-COL-14). CTV bán giá nào cho khách **không được ghi** và không ảnh hưởng doanh thu. CTV **không bao giờ** thấy doanh thu/giá vốn (BR-COL-17).
- Thời gian lưu UTC (`timestamptz`); ngày chứng từ là **ngày giờ Việt Nam** (`Asia/Ho_Chi_Minh`) kiểu `date`. Không dùng `new Date("YYYY-MM-DD")` để cộng trừ ngày.

### Ghi dữ liệu
- Mọi thao tác nhiều bước (ghi đơn bán, hủy đơn, giao/thu hồi hàng cho CTV, CTV báo bán, xác nhận/từ chối báo bán, thêm đồng hồ vào kho, giao/hoàn thành sửa chữa…) = **một hàm DB `app.fn_*`** chạy trong **một transaction**: kho + thanh toán + giá vốn + audit + sự kiện cùng thành công hoặc cùng thất bại (BR-GEN-02, III.6). API chỉ kiểm quyền sớm rồi gọi hàm.
- Chứng từ: `draft → confirmed → voided`. **Đã xác nhận = bất biến.** Sửa sai = hủy/điều chỉnh có lý do ≥ 10 ký tự (không có đổi trả — dùng bảo hành). Không `DELETE` dữ liệu đã xác nhận. Audit, lịch sử trạng thái/giá, bút toán giá vốn, movements linh kiện = append-only (trigger chặn UPDATE/DELETE/TRUNCATE); thanh toán bất biến (sai ⇒ hủy + ghi lại).
- Trạng thái chiếc đồng hồ chỉ đổi qua hàm nghiệp vụ theo ma trận (`docs/02-domain/state-machines.md`); app role **không** có quyền `UPDATE status`.
- Khóa theo thứ tự cố định để tránh deadlock: **chiếc (id tăng) → chào hàng/báo bán CTV → chứng từ (đơn bán, phiếu sửa)** (các nhánh cũ: linh kiện → giữ hàng → ghi thanh toán) (`docs/03-architecture/integrity-and-concurrency.md`).
- Thao tác POST quan trọng nhận header `Idempotency-Key`; bấm đúp không được tạo hai chứng từ.

### Phân quyền & dữ liệu nhạy cảm
- Kiểm theo **permission** (`useSession().can("cost.view")`, `app.has_permission(...)`), **không bao giờ theo tên vai trò**. Thêm quyền ⇒ migration + `src/lib/permissions.ts` + ma trận ở `docs/03-architecture/security-model.md`.
- **Giá vốn / lợi nhuận** (đã bỏ khỏi giao diện nhưng dữ liệu cũ còn) nằm ở bảng riêng có RLS (`unit_cost_entries`, `sale_line_costs`, …) và **không có API nào trả ra**. **Dữ liệu CTV:** vai trò CTV chỉ có `collab.view_own`; CTV đọc qua hàm DB an toàn `fn_my_offers/fn_my_claims/fn_my_collab_stats` (chỉ cột không-tiền, trừ giá niêm yết), không có quyền đọc bảng đơn/khách/chiếc. Chỉ ẩn trên UI là **chưa đủ**. Báo cáo/xuất Excel/PDF/in cũng đi qua cùng lớp quyền.
- PII (CCCD cũ, nếu còn trong DB) mã hóa AES-256-GCM ở tầng ứng dụng và không có API đọc; tên/SĐT khách do CTV nhập không vào nhật ký (che trong `tg_audit`). **Không log PII, không đưa PII vào URL, không gửi cho AI.**
- Khóa/mật khẩu/chuỗi kết nối **không bao giờ** vào mã, commit, docs, CLAUDE.md, memory hay ảnh chụp. Repo GitHub hiện **public** (theo yêu cầu chủ dự án, 2026-10-16) ⇒ repo chỉ chứa mã + docs + dữ liệu giả, **không bao giờ** dữ liệu khách thật/ảnh giấy tờ/`.env*`; chuyển **private** trước khi có dữ liệu thật; bật secret scanning ngay. Chuỗi kết nối từng lọt vào git ở dự án mẫu — đừng lặp lại.

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
- **Giao diện (Glass + Lucian):** dùng thành phần chung `src/components/ui/*` và token `src/styles/tokens.css` (không gõ cứng hex, không rải `<input>` thô). **Mobile-first**, kiểm tra ở 390px và 1366px; **cả bản sáng và tối** (token `[data-theme="dark"]` trong `tokens.css`, CQ-016). Không dùng select/ô ngày/hộp thoại/toast mặc định của trình duyệt — dùng `Select`, `DateInput`, `Modal`/`ConfirmDialog`, `Toast` trong `src/components/ui`. Hành động hay dùng ≤ 3 chạm. Phần tử tương tác phức tạp (tab phân đoạn, nhập số tiền, ô mã 6 số, toast, biểu đồ, wizard, bottom sheet…) **tìm trong thư viện Lucian trước** bằng skill `/lucian-uxui:lucian-uxui` (`search` → `get` → port theo `references/porting.md`), **ánh xạ token `--ux-*` sang token Glass**, giữ dòng giấy phép MIT, ghi vào sổ `ui-design-system` §9; chỉ dùng mã do `get` trả về (không tự dựng lại từ trí nhớ). Bố cục (dock, sidebar, thẻ, danh sách) **tự dựng theo Glass**. Không dựng màn đã bị loại dù mẫu v6-glass có (Thu chi, Đổi trả…). Màn chưa có trong mẫu (CTV, Bảo hành, sửa chữa gọn…) cần bản tĩnh được khách duyệt trước (`build-plan` cổng G1b).
- Tìm kiếm tiếng Việt không dấu: dùng `unaccent` + `pg_trgm` (cột `search_text`). **Đừng dùng `\b` trong regex với chữ có dấu** — dùng `(?![\p{L}])`.
- Tránh `*/` trong chú thích CSS (`bg-*/text-*`) — vỡ build CSS.
- Nhật ký: không `console.log` dữ liệu cá nhân; lỗi ghi qua `recordErrorEvent`.
- Thêm tính năng mới theo **module contract** (`docs/03-architecture/extensibility.md`): không ghi chéo bảng của module khác, giao tiếp qua hàm/`domain_events`.

## Định nghĩa hoàn thành (mỗi PR/tính năng)
1. Đúng BR liên quan (ghi ID trong mô tả PR); có ví dụ số nếu động tới tiền.
2. Migration: RLS + grant + audit + index; áp được 2 lần không lỗi; có dry-run.
3. Test: đơn vị cho tính toán; tích hợp trên DB thật **dưới `wf_app`** (không superuser); kịch bản vàng liên quan xanh; nếu động tới kho/tiền/trạng thái → thêm/cập nhật ca đồng thời (CT-xx); nếu thêm dữ liệu nhạy cảm → ca phân quyền (PT-xx).
4. Docs cập nhật cùng PR: BR, state machine, data model, FR (đánh ☑), user guide (`src/content/guide.ts`), changelog.
5. `typecheck` + `build` + `test:api` xanh; nếu đổi UI: ảnh chụp 390px + 1366px, `axe` không lỗi nghiêm trọng, sổ phần tử Lucian cập nhật.
6. Chạy `pnpm docs:check` (từ M0): link, ID FR/BR/SC/CT/PT/UAT, mọi BR được `requirements` trỏ tới.

## Cạm bẫy đã biết (từ dự án mẫu)
- Pooler cổng 5432 = session mode → cạn kết nối khi nhiều hàm serverless; dùng 6543 và mỗi instance tối đa ~3 kết nối.
- Tài khoản dùng mật khẩu tạm / vai trò bắt buộc MFA chưa bật bị chặn mọi API trừ `/api/v1/auth/*`.
- Trigger dùng chung hai bảng: dùng `IF/ELSIF`, đừng dùng `CASE` tham chiếu `OLD.cột` của bảng kia.
- Lớp CSS bổ trợ (modifier) **không đặt trùng tiện ích Tailwind** (`inline`, `block`, `hidden`, `flex`, `grid`, `table`, `static`…): layer `utilities` thắng layer `components` ⇒ quy tắc của mình bị đè (huy hiệu sidebar từng mất `inline-grid` nên số lệch lên góc). Dùng tiền tố `wf-…`.
- Job phân vùng/dọn dẹp thiếu quyền `CREATE`/`USAGE` làm hỏng ngầm — mọi job định kỳ phải có test chạy thật dưới đúng vai trò.
- Docs bị lệch thực tế (README nói một đằng, `.env.local` làm một nẻo) → mỗi PR đổi hành vi đổi docs; hết hạn "kiểm lần cuối" ghi ở đầu mỗi file docs.
- Next.js App Router: thư mục bắt đầu bằng `_` là **private** (không thành route) — đừng đặt trang như `/_design`; dùng `/dev/design`.
- `backdrop-filter` (kính mờ) tốn GPU trên máy yếu: chỉ dùng cho khối nổi, có phương án dự phòng (`ui-design-system` §7).
- Mẫu v6-glass là **tĩnh, dữ liệu giả**, còn các màn đã bị loại: dùng làm tham chiếu hình ảnh, không sao chép logic.
