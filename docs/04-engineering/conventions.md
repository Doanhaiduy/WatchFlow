# Quy ước mã nguồn

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Quy tắc "sắt" nằm ở `CLAUDE.md`; file này là chi tiết.

## 1. Chung

- TypeScript `strict`, không `any` (dùng `unknown` + Zod). ESLint/Prettier theo cấu hình repo. Mã, tên biến, tên hàm, commit message: tiếng Anh cho định danh, **tiếng Việt cho chuỗi hiển thị, chú thích nghiệp vụ, commit** (`feat(sales): thêm giữ hàng`).
- Chú thích: giải thích **vì sao** (BR-xx liên quan), không lặp lại code. Mỗi hàm tài chính ghi BR/ADR nó thực thi.
- Một khái niệm = một chỗ định nghĩa (hằng quyền ở `lib/permissions.ts`, trạng thái ở `lib/status.ts`, định dạng ở `lib/format.ts`).
- Không logic nghiệp vụ trong component React: gọi hook dữ liệu + hiển thị. Tính toán tiền chỉ ở `lib/money.ts` (và SQL) — client dùng để **xem trước**, server/DB quyết định.

## 2. Tiền, ngày, số

- Tiền: kiểu `Vnd = number` (nguyên, an toàn < 2^53). Tuyệt đối không `toFixed` để tính; chỉ định dạng: `formatVnd(8200000) → "8.200.000 ₫"` (Intl `vi-VN`); hiển thị số tiền dùng `font-variant-numeric: tabular-nums`.
- Nhập tiền: `MoneyInput` (chấp nhận gõ `8200000`, `8.200.000`, `8,2tr`? — **không** đoán đơn vị; chỉ nhận chữ số và dấu phân cách), trả `number`.
- Làm tròn/phân bổ: `roundHalfUp`, `allocate` (`lib/money.ts`) — có bản SQL `app.round_vnd`, `app.allocate_vnd` và **test đối chiếu hai bản cho cùng đầu vào**.
- Ngày: `lib/dates.ts` — `todayVN()`, `toDocDate(dt)`, `addDaysVN(date, n)` (làm việc trên chuỗi `YYYY-MM-DD` qua thư viện ngày, **không** `new Date("YYYY-MM-DD")` rồi cộng giờ). Hiển thị `dd/MM/yyyy`.
- `bigint` Postgres trả về `number` (type parser) — mọi giá trị VND < 2^53; số lượng đếm cũng vậy.

## 3. Cơ sở dữ liệu & truy vấn

- Mọi truy vấn của người dùng: `ctx.db(tx => …)`; hàng loạt độc lập: `batch(tx, [[sql, params], …])`.
- Tham số hóa 100% (`$1…`), không nối chuỗi SQL. Tên bảng/cột động chỉ từ allow-list.
- Thao tác ghi nghiệp vụ gọi `select app.fn_xxx(...)`; **không** `UPDATE watch_units SET status` ở TS.
- Truy vấn danh sách: luôn phân trang, `ORDER BY` có tiebreaker (`id`), chỉ chọn cột cần.
- Tìm kiếm: `search_text ILIKE '%' || app.norm_text($1) || '%'` (hoặc `%` trigram) — chuẩn hóa không dấu.
- Không `SELECT *` trong mã máy chủ; DTO dựng tường minh để không lộ cột mới ngoài ý muốn.

## 4. API (xem `api-conventions`)

- Mỗi route: `export const GET = api({ perm: "…" }, async (ctx) => { … })`. Vào: Zod parse (`ctx.body(schema)`, `ctx.query(schema)`). Ra: DTO đã lọc quyền.
- Lỗi nghiệp vụ: `throw new ApiError(409, "WF-…", "Câu tiếng Việt hướng dẫn việc cần làm")`.
- Thao tác ghi: lấy `Idempotency-Key` bằng helper `ctx.idempotent(async () => …)`.
- `maxDuration` mặc định; route sinh PDF/Excel đặt hạn dài hơn và giới hạn kích thước.

## 5. Giao diện

- Next App Router: trang đọc là Server Component khi có thể; form/POS là client component. Dữ liệu client qua SWR (`useXxx`), `mutate` sau ghi; danh sách làm mới nền.
- Giao diện theo hệ thống **Glass** (`03-architecture/ui-design-system.md`): thành phần dùng chung ở `src/components/ui/*` (`GlassCard`, `StatusChip`, `Field`, `MoneyInput`, `Select`, `SegmentedControl`, `BottomSheet`, `ConfirmDialog`, `ScanButton`, `ImageUploader`…), phần tử Lucian đã port ở `src/components/lucian/*` (kèm chú thích MIT, ghi sổ §9). Không rải `<input>`/`<select>` thô.
- **Mobile-first**: viết lớp cơ sở cho 390px. Dock nổi (điện thoại) ↔ sidebar đảo nổi (máy tính) đổi ở breakpoint tùy chỉnh `desk` = 1000px (khớp mẫu Glass); bố cục nhiều cột **trong trang có sidebar** dùng `desk:`/`2xl:` (bài học từ Lưu Xá: nội dung hẹp hơn khung).
- Bảng nhiều cột → thẻ trên điện thoại (`DataTable` tự chuyển); mỗi ô trong thẻ tự mang nhãn.
- Nút/liên kết `inline-flex` mặc định không xuống dòng ⇒ hàng nút phải `flex-wrap`; nhãn dài thêm `whitespace-normal`; `min-w-0` cho phần tử con cần `truncate`.
- Màu, bo góc, bóng, phông qua **token** (`src/styles/tokens.css`); không gõ cứng màu hex trong component. Giao diện chỉ bản sáng ở giai đoạn đầu; bản tối thêm bằng bộ token mới (ADR-026). Phần tử Lucian: CSS giữ dạng CSS thuần theo tiền tố `.uNNN`, **không** viết lại thành Tailwind.
- Truy cập: nhãn cho mọi input, thứ tự tab, `aria-expanded` cho bảng nổi, tương phản AA, vùng chạm ≥ 44px, không truyền đạt chỉ bằng màu.
- Thông báo: `showToast(type, msg)`; lỗi hiển thị `detail` + mã `WF-…` nhỏ + 8 ký tự `requestId`.
- Văn bản UI: ngắn, đời thường, nhất quán với `glossary` ("Chiếc", "Phiếu bán", "Giữ hàng", "Thu cũ đổi mới"). Câu xác nhận nguy hiểm nêu hậu quả bằng số.
- Tránh `*/` trong chú thích CSS (vỡ build); tránh `\b` với chữ có dấu (dùng `(?![\p{L}])`).

## 6. Đặt tên

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Bảng / cột | `snake_case`, số nhiều / số ít | `watch_units`, `list_price_vnd` |
| Hàm DB | `app.fn_<động_từ>_<đối_tượng>` | `app.fn_confirm_sale` |
| Trigger | `tg_<việc>` ; gắn `trg_<bảng>__<việc>` | `trg_unit_cost_entries__immutable` |
| View | `v_<mô_tả>` | `v_doc_balances` |
| Báo cáo SQL | `app.rpt_<tên>` | `app.rpt_profit` |
| File TS | `kebab-case.ts` (hook), `PascalCase.tsx` (component); phần tử Lucian `lucian-NNN.tsx` + `lucian-NNN.css` | `use-sales.ts`, `SaleSummary.tsx`, `lucian-035.tsx` |
| Mã lỗi | `WF-<MODULE>-<LỖI>` | `WF-SALE-UNIT-UNAVAILABLE` |
| Quyền | `<đối_tượng>.<hành_động>` | `sale.confirm` |
| Sự kiện | `<đối_tượng>.<quá_khứ>` | `sale.confirmed` |
| Route trang | tiếng Việt không dấu, gạch nối | `/ban-hang/moi` |
| Test | `scripts/test-api/<module>-<chủ_đề>.mjs` ; kịch bản vàng `sc-NN-*.mjs` | `sales-confirm.mjs`, `sc-02-ban-thuong.mjs` |

## 7. Git

- Nhánh: `main` (production), `staging` (Preview), nhánh tính năng `feat/<module>-<ý>`, `fix/…`. PR vào `staging` trước.
- Commit: `feat|fix|chore|docs|test|refactor(phạm-vi): mô tả tiếng Việt`; thân commit nêu BR/FR liên quan khi động tới nghiệp vụ.
- PR mô tả: *làm gì · BR/FR/SC · ảnh chụp 390px (nếu UI) · migration có/không · cách kiểm*. Checklist DoD (`CLAUDE.md`) bắt buộc.
- Không commit: `.env*` (trừ `.env.example`), `.local/`, `backup/`, ảnh/ dữ liệu thật, `node_modules`, kết quả test.
- Bật secret scanning/push protection của GitHub; thêm pre-commit chặn chuỗi giống khóa (gitleaks).
