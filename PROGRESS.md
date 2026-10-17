# PROGRESS — nhật ký triển khai

> Đọc **đầu tiên** mỗi phiên; cập nhật **cuối** mỗi lát cắt. Giữ ≤ 80 dòng — chi tiết nằm ở docs/CONFIRM, đừng chép lại.

## BÁO CÁO CUỐI (2026-10-17 · v0.11.0 · máy công ty, LOCAL-ONLY, không commit/push)
- **Mốc:** M0–M9 ✔ bản local (DB + API + UI + test). Chưa xong: chỉ phần ⏭ cloud/việc làm tay (dưới).
- **Kiểm cuối (đều xanh):** `pnpm typecheck` · `pnpm build` (check-version 0.11.0) · `pnpm test` 20/20 · `pnpm test:api` 123/123 (kể cả đồng thời CT, phân quyền PT, I1–I12, SC-13) · `pnpm test:e2e` 15 đạt + 1 bỏ qua có chủ đích (POS chỉ chạy 390px), axe không lỗi nghiêm trọng ở 390/1366 · `pnpm docs:check` 0 cảnh báo · `pnpm lint` 0 lỗi (18 cảnh báo) · `db:audit` S1–S12 sạch · `db:restore-drill` đạt.
- **Rà soát:** /security-review — không có lỗ hổng độ tin cậy ≥ 8. /code-review — 9 phát hiện, **đã sửa cả 9** (trần cấp quyền 0013c, pool phụ chống chờ vòng tròn, giới hạn đăng nhập giữ chỗ nguyên tử + email chuẩn hóa, TLS DB bắt buộc kiểm chứng chỉ, đếm in lại đúng khi Ctrl+P/bấm đúp, trả lại lượt đúng cửa sổ, bỏ ghi audit print_count, thu grant thừa, mã lỗi chủ cuối cùng). Đối chiếu bảo mật với Lưu Xá — 10 phát hiện, đã sửa 9, giữ 1 theo tài liệu (CQ-015).
- **CONFIRM.md — 15 câu chờ xác nhận:** 🔴 7 (CQ-001, 002, 007, 008, 009, 013, 015) · 🟡 4 (CQ-004, 005, 010, 011) · 🟢 4 (CQ-003, 006, 012, 014). Ưu tiên đọc 🔴 trước.
- **⏭ Cloud / làm tay (chưa chạy, file đã viết):** deploy Vercel staging/production; Supabase (migrate, vai trò `wf_backup`, kiểm BYPASSRLS, bucket Storage, `bootstrap-owner`); CI GitHub Actions chạy thật (`.github/workflows/ci.yml`); sao lưu tự động hằng đêm FR-BAK-01 (`ops/backup-repo/*`); secret scanning + chuyển repo private; bàn giao tài khoản/đào tạo FR-BAK-08 (`runbook` §7).
- **Việc người dùng tự làm:** sao `company-settings.template.json` → `.claude/settings.local.json` (AI bị chặn tự cấp quyền); duyệt màn chưa có mẫu Glass (CQ-011, cổng G1b).
- **Demo:** `pnpm setup:local` (lần đầu: PG cục bộ 127.0.0.1:54329 + migrate + seed + .env.local) → `pnpm dev` → http://localhost:3000. Đặt lại dữ liệu: `pnpm setup:reset`.
- **Tài khoản demo** (mật khẩu chung + khóa TOTP của chủ ở `.local/demo-accounts.txt`): chủ `chu@watchflow.local` (bắt buộc 2 bước) · bán hàng `banhang@` · kho `kho@` · CTV `ctv@`, `ctv2@` (đuôi `@watchflow.local`).

## Tiện ích từ Lưu Xá — ưu tiên Cao + TB (2026-10-17 · v0.14.0)
- VietQR (0016, chỉ hiển thị) + PDF vector pdfmake (phiếu bán/sửa/bảo hành) · Ctrl+K `/api/v1/search` + huy hiệu `/api/v1/me/badges` + dải cảnh báo vận hành · bảo vệ form dirty/busy/guard + Combobox (#034, #046) · nhập Excel khách/đồng hồ/linh kiện (0019, qua phiếu opening) · PWA: gợi ý cài, cảnh báo Zalo/Facebook, offline, Web Push (0020; gửi thật ⏭ cloud) · nhật ký hoạt động (0021) + tin cậy thiết bị 2FA (0021a) + `pnpm audit:layout`.
- CQ mới: CQ-018 (thiết bị tin cậy 🔴), CQ-019 (nhật ký/VietQR/store-info/nhập Excel/push 🟡); CQ-014 cập nhật (PDF).
- Kiểm: typecheck · lint 0 lỗi · build 0.14.0 · unit 139/139 · API 201/201 · e2e 15 + 1 bỏ qua · docs:check 0. Lưu ý: chạy e2e khi máy thiếu RAM ⇒ Edge sập, mọi ca đỏ — tắt bớt dev server/trình duyệt rồi chạy lại.
- Sự cố: một subagent xóa ~41 phiếu bán NHÁP trong DB dev demo khi dọn ảnh chụp (không đụng phiếu đã xác nhận) — `pnpm setup:reset` nếu muốn dữ liệu demo sạch.

## Đối ứng Lưu Xá (2026-10-17 · v0.13.0, theo yêu cầu người dùng)
- Đã port từ `ref-sources/domus-francis`: log lỗi trình duyệt (`ClientErrorReporter` + `/api/v1/public/client-error`, 0015), `instrumentation.ts` (onRequestError + warmPool), `global-error`, `humanize-error`; nén ảnh trên trình duyệt + tải có tiến độ/hủy; dọn tệp đã xóa + xóa thật CCCD khi ẩn danh (0014, CQ-017); theo dõi dung lượng (Quản trị → Hệ thống); trình xem ảnh phóng to.
- Kiểm: typecheck · lint 0 lỗi · build 0.13.0 · unit 42/42 · API 136/136 · e2e 15 + 1 bỏ qua · docs:check 0.
- Khảo sát còn đề xuất (chờ người dùng chọn): VietQR ở POS, bảo vệ form chưa lưu, Ctrl+K tìm toàn cục, gợi ý cài PWA + cảnh báo mở trong Zalo + trang offline, nhập Excel khách/tồn đầu kỳ, Web Push, huy hiệu số việc, PDF vector, dải cảnh báo vận hành, nhật ký hoạt động, tin cậy thiết bị 2FA, …

## Đợt tối ưu giao diện (2026-10-17 · v0.12.0, theo yêu cầu người dùng)
- Chế độ tối (Sáng/Tối/Theo hệ thống, CQ-016); Select + DateInput/DateRange tự dựng (Lucian #031, #030), không còn select/ô ngày/hộp thoại mặc định; lớp phủ đồng nhất (thang z, Esc, bẫy focus, sheet trên điện thoại, toast trên đầu).
- Audit 3 khu (bán hàng & khách · kho · sửa chữa/CTV/báo cáo/quản trị/khung) ở 390/1366 × sáng/tối: ~65 vấn đề đã sửa (luồng, mobile, a11y); ảnh trước/sau ở `test-results/ui-audit/` (bị xóa khi chạy `pnpm test:e2e`).
- Lỗi luồng/máy chủ đã sửa: nhập hàng bị máy chủ chặn mà UI không báo; "Đơn của tôi" CTV rỗng dòng (0013e); hạn mức giảm báo sớm (0013d); số tiền trong thông báo DB kiểu 550.000; phiên chết ⇒ về trang đăng nhập.
- Kiểm: typecheck · lint 0 lỗi · build 0.12.0 · unit 24/24 · API 123/123 · e2e 15 + 1 bỏ qua có chủ đích · docs:check 0 cảnh báo.

## Trạng thái
- Máy: công ty (LOCAL-ONLY, không commit) · Mốc: **M9 xong bản local** · Phiên bản **0.11.0**
- Môi trường: node 22.23 · pnpm 10.34 · PostgreSQL 18 cài sẵn (cụm riêng `.local/pgdata`, 127.0.0.1:54329) · Lucian skill (cần `NODE_USE_ENV_PROXY=1`) · Mẫu Lưu Xá không có ở đường dẫn trong prompt ⇒ M0–M8 viết theo spec; bản tham khảo ở `ref-sources/domus-francis` dùng để đối chiếu bảo mật ở M9 (đã loại khỏi lint/tsconfig).
- §1: push đã khóa (`DISABLED_NO_PUSH_AT_COMPANY`); `CLAUDE.local.md` đã tạo; **`.claude/settings.local.json` CHƯA tạo**.

## Mốc
| Mốc | Trạng thái | Ghi chú |
|---|---|---|
| M0 Nền tảng + Design System | ✔ | 0001–0003b; auth/MFA/phiên/CSRF/idempotency/rate-limit, admin, files, cron, outbox, backup + diễn tập local |
| M1 Danh mục & kho | ✔ | 0004/0004a + API + UI + e2e |
| M2 Khách hàng | ✔ | 0005/0005a (PT-03/12) + UI + e2e tạo khách |
| M3 Tiền & thanh toán tối giản | ✔ | 0006 + allocate SQL↔TS + PaymentSheet |
| M4 Nhập hàng & giá vốn | ✔ | 0007/a/b; seed qua phiếu `opening`; SC-01/11e/17 CT-09 |
| M5a Bán, giữ hàng, thu cũ, bảo hành | ✔ | 0008/0008a; SC-02…06/15 CT-01/02/03/05/07; e2e POS 390 |
| M5b Cộng tác viên | ✔ | 0008b; SC-12/16 CT-06/08/10 PT-02/03 |
| M6 Sửa chữa gọn | ✔ | 0009/0009a; SC-07/08/08b/09 CT-04 PT-04; e2e nhận máy |
| M7 Kiểm kê, cảnh báo, thông báo | ✔ | 0010 + cron; SC-14 CT-13; I1–I12 |
| M8 Báo cáo & tổng quan | ✔ | 0011 rpt_* + json/xlsx; tổng quan theo quyền; /bao-cao; SC-10 PT-05 SC-13 |
| M9 Hoàn thiện & go-live | ✔ local · ⏭ cloud | 0012 in lại; 0013/a/b/c bảo mật; CSP nonce (`src/proxy.ts`); `/huong-dan` + `pnpm docs:guide`; FR còn ☐ đúng 2 mục: FR-BAK-01, FR-BAK-08 (⏭) |

## Quyết định / giả định đã chọn (chi tiết CONFIRM.md)
- CQ-001 wf_definer BYPASSRLS · CQ-002 owner giữ user/role.manage · CQ-003 PG cài sẵn · CQ-004 rate-limit đếm lần sai · CQ-005 ân hạn refresh 10 giây · CQ-006 tem QR in trình duyệt · CQ-007 audit che PII · CQ-008 tồn LK F0 = 2.750.000 · CQ-009 trade_in nội bộ · CQ-010 lãi cần profit.view · CQ-011 màn chưa duyệt G1b · CQ-012 repair_line_costs nhiều bút toán · CQ-013 chốt KK có chiếc mất cần stock.writeoff · CQ-014 Excel exceljs, PDF = trang in · CQ-015 chống chiếm quyền chủ + trần cấp quyền + phiên hạn tuyệt đối

## Lệnh thật đã kiểm (xem dev-setup §2.1)
- `pnpm setup:local` · `pnpm dev` · `pnpm test` · `pnpm test:api [-- --only <bộ>] [--no-server]` · `pnpm test:e2e` (Edge có sẵn, cổng 3300) · `pnpm db:backup` · `pnpm db:restore-drill` · `pnpm db:audit` · `pnpm docs:check` · `pnpm docs:guide` · `pnpm lint`
- Bash trên máy này: heredoc/`sed` nuốt `\\`, backtick trong chuỗi `"..."` bị THỰC THI ⇒ viết mã/tài liệu bằng Write/Edit hoặc script trong scratchpad. `next dev` với `NEXT_DIST_DIR` lạ tự chèn dòng vào `tsconfig.json` — gỡ sau khi thử.

## Sổ phần tử Lucian đã port (bản đầy đủ ở `ui-design-system` §9)
- M0: #070 toast, #047 segmented, #026 OTP, #062 thẻ đăng nhập, #035 nhập tiền, #092 rỗng, #090 lỗi, #079 skeleton · M1: #008 sao chép, #018 bộ chỉnh SL, #032 tải ảnh, #305 drawer lọc · M4–M5a: #042 wizard, #336 bottom sheet 3 nấc, #003 giữ-để-xác-nhận · M7: #074 chuông
