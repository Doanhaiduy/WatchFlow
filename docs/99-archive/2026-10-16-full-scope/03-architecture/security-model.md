# Mô hình bảo mật & phân quyền

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Quy tắc gốc: BR-SEC-*, BR-COST-06, ADR-003/004/005

## 1. Các lớp bảo vệ (phòng thủ chiều sâu)

| Lớp | Việc đảm bảo | Vai trò |
|---|---|---|
| **RLS + `GRANT` theo bảng/cột + trigger bảo vệ cột** | Ai thấy dòng nào, ai ghi cột nào; phiên quên gắn người dùng trả **0 dòng** ở mọi bảng | **Chốt chặn dữ liệu chính** — dù API có lỗi vẫn không lộ/sửa sai |
| **Hàm `app.fn_*`** (`SECURITY DEFINER`, tự kiểm quyền trong thân) | Thao tác ghi nhiều bước là nguyên tử và đúng quy trình (tiền, kho, trạng thái) | **Đường ghi duy nhất** cho dữ liệu nghiệp vụ |
| **API** (`api({...}, handler)`) | Xác thực, kiểm Zod, kiểm quyền sớm (403 nhanh), idempotency, giới hạn tốc độ, ánh xạ mã lỗi tiếng Việt, Server-Timing | Trải nghiệm & chống lạm dụng — không phải nơi duy nhất giữ quy tắc |
| **Giao diện** | Ẩn/hiện theo quyền (`useSession().can`) | Chỉ là UX |

Hệ quả: API **không bao giờ** chạy bằng superuser hay chủ bảng (RLS sẽ bị bỏ qua); mọi test tích hợp chạy dưới `wf_app`; thêm bảng mới mà thiếu RLS/GRANT ⇒ test cấu trúc (S2-style) thất bại.

## 2. Vai trò cơ sở dữ liệu

| Vai trò DB | Thuộc tính | Dùng cho |
|---|---|---|
| `wf_owner` | Chủ sở hữu đối tượng (không đăng nhập runtime) | Sở hữu bảng/hàm |
| `wf_definer` | Chủ sở hữu hàm `SECURITY DEFINER` | Hàm đặc quyền, có `SET search_path` cố định |
| `wf_api` | `LOGIN`, `NOINHERIT` | Kết nối của ứng dụng; không quyền gì nếu quên `SET ROLE` |
| `wf_app` | `NOLOGIN`, chịu RLS | `SET LOCAL ROLE wf_app` cho mọi truy vấn của người dùng đã đăng nhập |
| `wf_auth` | Quyền riêng trên bảng xác thực | Đăng nhập, đăng ký, làm mới token, MFA |
| `wf_worker` | `BYPASSRLS`, không UPDATE/DELETE bảng bất biến | Cron, dọn dẹp, xử lý ảnh, gửi thông báo, kiểm chuỗi |
| `wf_backup` | `LOGIN`, `BYPASSRLS` (bắt buộc vì mọi bảng `FORCE RLS`), **chỉ `SELECT`** — không quyền ghi/DDL | Sao lưu (`pg_dump`) |
| `postgres`/chủ Supabase | Chỉ qua `MIGRATE_DATABASE_URL` trên máy dev | Migration/bootstrap |

Ngữ cảnh người dùng mỗi request (trong transaction): `SET LOCAL ROLE wf_app; SELECT set_config('app.current_user_id', $1, true), set_config('app.request_id', $2, true), set_config('app.ip_hash', $3, true);`. `app.has_permission(code)` đọc quyền từ `user_roles → role_permissions` (hợp các vai trò), có cache trong transaction.

## 3. Danh mục quyền (permission)

Quy ước mã: `<đối tượng>.<hành động>`. Nguồn sự thật: bảng `permissions` (seed trong migration) + hằng `PERMISSIONS` ở `src/lib/permissions.ts`; **test đảm bảo hai bên khớp**. `is_sensitive` = quyền nhạy cảm (đổi vai trò chứa quyền này phải ghi audit mức cao).

| Nhóm | Mã quyền | Ý nghĩa |
|---|---|---|
| **iam / platform** | `user.manage` | Tạo/sửa/khóa người dùng, gán vai trò, đặt lại mật khẩu tạm |
| | `role.manage` | Sửa vai trò, quyền, hạn mức giảm giá |
| | `settings.view`, `settings.manage` | Xem / sửa cài đặt |
| | `audit.view` | Xem nhật ký hoạt động |
| | `system.health`, `system.backup` | Xem tình trạng hệ thống / trạng thái sao lưu |
| **catalog** | `catalog.view` | Xem đồng hồ, loại, thương hiệu, vị trí (đầy đủ trừ giá vốn) |
| | `catalog.view_collab` | Xem phạm vi hẹp của CTV (chiếc `in_stock` + `collab_visible`, chỉ giá bán) |
| | `catalog.manage` | Tạo/sửa loại, chiếc (thông tin phi tài chính), ảnh, phụ kiện |
| | `unit.price.edit` | Sửa giá niêm yết/khuyến mãi |
| | `unit.release` | Chuyển `inspecting → in_stock`, xác nhận hàng trả nguyên vẹn |
| | `location.manage` | Quản lý vị trí lưu kho, di chuyển |
| **parts** | `part.view` | Xem linh kiện, tồn (không giá vốn) |
| | `part.manage` | Tạo/sửa linh kiện, xem lịch sử xuất nhập |
| | `part.stock.adjust` | Điều chỉnh tồn linh kiện (lý do bắt buộc) |
| **partners** | `customer.view` | Xem tất cả khách |
| | `customer.view_own` | Xem khách do chính mình tạo (CTV) |
| | `customer.create`, `customer.manage` | Tạo khách / sửa khách bất kỳ |
| | `customer.pii.view` | Xem CCCD đầy đủ (nêu lý do, có audit) — nhạy cảm |
| | `supplier.view`, `supplier.manage` | Xem / sửa nhà cung cấp |
| **cost & tiền nhạy cảm** | `cost.view` | Xem giá nhập, giá vốn, giá vốn dòng bán — nhạy cảm |
| | `cost.adjust` | Điều chỉnh giá vốn — nhạy cảm |
| | `profit.view` | Xem lợi nhuận/lãi gộp — nhạy cảm |
| | `debt.view` | Xem công nợ **khách** |
| | `debt.view_supplier` | Xem công nợ **nhà cung cấp** (số đã trả/còn nợ phiếu nhập) |
| | `techpay.view` | Xem tiền công thợ của mọi thợ (thợ luôn thấy của mình) |
| **purchasing** | `purchase.view`, `purchase.create`, `purchase.confirm`, `purchase.void` | Xem / lập nháp / xác nhận / hủy phiếu nhập |
| **sales** | `sale.view` | Xem mọi phiếu bán |
| | `sale.view_own` | Xem phiếu do mình tạo (CTV) |
| | `sale.create_draft`, `sale.confirm` | Lập nháp / xác nhận phiếu bán |
| | `sale.below_cost` | Bán dưới giá vốn — nhạy cảm |
| | `sale.void` | Hủy phiếu bán trong cửa sổ — nhạy cảm |
| | `reservation.manage`, `reservation.forfeit` | Giữ hàng/hoàn cọc; tịch thu cọc — nhạy cảm |
| | `return.create`, `return.confirm`, `return.override` | Lập / xác nhận đổi trả; vượt hạn đổi trả — nhạy cảm |
| | `commission.view`, `commission.view_own`, `commission.manage` | Xem mọi hoa hồng / của mình / duyệt & chi trả |
| **repairs** | `repair.view` | Xem mọi phiếu sửa |
| | `repair.view_assigned` | Xem phiếu được giao cho mình (thợ) |
| | `repair.create` | Nhận máy (tạo phiếu) |
| | `repair.update` | Ghi kiểm tra, thêm dòng, đổi trạng thái, xác nhận dùng linh kiện |
| | `repair.approve_quote` | Ghi nhận khách đồng ý báo giá |
| | `repair.assign` | Phân công thợ |
| | `repair.price.edit` | Sửa giá trên dòng sửa chữa |
| | `repair.deliver` | Giao máy, thu tiền / ghi nợ |
| **finance** | `finance.view` | Xem quỹ, sổ quỹ, thu chi, đối chiếu |
| | `payment.create` | Lập phiếu **thu** (từ khách) |
| | `payment.pay` | Lập phiếu **chi** (NCC, chi phí, hoàn tiền, hoa hồng, tiền công) — nhạy cảm |
| | `payment.void` | Hủy phiếu thu/chi (bút toán đảo) — nhạy cảm |
| | `ledger.adjust` | Điều chỉnh quỹ — nhạy cảm |
| | `account.manage` | Tạo/sửa quỹ, số dư đầu kỳ, hạng mục chi phí |
| | `period.close`, `period.reopen` | Khóa kỳ / mở lại — nhạy cảm |
| **inventory** | `stocktake.manage` | Kiểm kê |
| | `stock.writeoff` | Thanh lý/ghi mất / khôi phục chiếc — nhạy cảm |
| **reports** | `report.sales`, `report.inventory`, `report.export` | Báo cáo doanh thu / kho / quyền xuất file (xuất vẫn tuân quyền dữ liệu) |

## 4. Ma trận vai trò mặc định

`●` có · `○` không · `◐` giới hạn (ghi chú). Chủ chỉnh được; thay đổi có audit.

| Quyền | owner | sales | warehouse | technician | collaborator |
|---|---|---|---|---|---|
| `user.manage`, `role.manage`, `settings.*`, `audit.view`, `system.*` | ● | ○ | ○ | ○ | ○ |
| `catalog.view` | ● | ● | ● | ● | ○ |
| `catalog.view_collab` | ○ | ○ | ○ | ○ | ● |
| `catalog.manage`, `location.manage`, `unit.release` | ● | ○ | ● | ○ | ○ |
| `unit.price.edit` | ● | ○ | ○ | ○ | ○ |
| `part.view` | ● | ● | ● | ● | ○ |
| `part.manage`, `part.stock.adjust` | ● | ○ | ● | ○ | ○ |
| `customer.view` | ● | ● | ○ | ○ | ○ |
| `customer.view_own`, `customer.create` | ○/● | ○/● | ○ | ○ | ●/● |
| `customer.manage` | ● | ● | ○ | ○ | ○ |
| `customer.pii.view` | ● | ○ | ○ | ○ | ○ |
| `supplier.view`, `supplier.manage` | ● | ○ | ● | ○ | ○ |
| `cost.view` | ● | ○ | ● | ○ | ○ |
| `cost.adjust`, `profit.view`, `techpay.view` | ● | ○ | ○ | ○ | ○ |
| `debt.view` | ● | ● | ○ | ○ | ○ |
| `debt.view_supplier` | ● | ○ | ○ | ○ | ○ |
| `purchase.view`, `purchase.create`, `purchase.confirm` | ● | ○ | ● | ○ | ○ |
| `purchase.void` | ● | ○ | ○ | ○ | ○ |
| `sale.view` | ● | ● | ○ | ○ | ○ |
| `sale.view_own` | ○ | ○ | ○ | ○ | ● |
| `sale.create_draft` | ● | ● | ○ | ○ | ● |
| `sale.confirm` | ● | ● | ○ | ○ | ○ |
| `sale.below_cost`, `sale.void` | ● | ○ | ○ | ○ | ○ |
| `reservation.manage` | ● | ● | ○ | ○ | ○ |
| `reservation.forfeit` | ● | ○ | ○ | ○ | ○ |
| `return.create` | ● | ● | ○ | ○ | ○ |
| `return.confirm`, `return.override` | ● | ○ | ○ | ○ | ○ |
| `commission.view`, `commission.manage` | ● | ○ | ○ | ○ | ○ |
| `commission.view_own` | ○ | ○ | ○ | ○ | ● |
| `repair.view` | ● | ● | ○ | ○ | ○ |
| `repair.view_assigned` | ○ | ○ | ○ | ● | ○ |
| `repair.create`, `repair.approve_quote`, `repair.price.edit`, `repair.deliver` | ● | ● | ○ | ○ | ○ |
| `repair.update` | ● | ○ | ○ | ● | ○ |
| `repair.assign` | ● | ○ | ○ | ○ | ○ |
| `finance.view`, `payment.pay`, `payment.void`, `ledger.adjust`, `account.manage`, `period.*` | ● | ○ | ○ | ○ | ○ |
| `payment.create` | ● | ● | ○ | ○ | ○ |
| `stocktake.manage` | ● | ○ | ● | ○ | ○ |
| `stock.writeoff` | ● | ○ | ○ | ○ | ○ |
| `report.sales` | ● | ◐ chỉ doanh thu, không lãi | ○ | ○ | ○ |
| `report.inventory` | ● | ○ | ● | ○ | ○ |
| `report.export` | ● | ● | ● | ○ | ○ |
| **`roles.max_discount_pct`** | 100 | 5 | 0 | 0 | 0 |

> Quy tắc nhất quán: nếu một quyền "tiền nhạy cảm" không có, thì **mọi** endpoint/báo cáo/export/in chứa dữ liệu đó trả 403 (hàm) hoặc không có cột (khung nhìn công khai cho vai trò đó). Ví dụ `sales` xem phiếu bán nhưng danh sách phiếu **không có** cột giá vốn/lãi (`sale_lines` đọc được, `sale_line_costs` không).

## 5. Phạm vi dữ liệu (row scope) — RLS

| Đối tượng | Chính sách `SELECT` (rút gọn) |
|---|---|
| `users`, `roles` | Mỗi người thấy hồ sơ mình; `user.manage` thấy tất cả; danh sách nhân viên để chọn thợ/CTV qua view rút gọn |
| `watch_units` | `catalog.view` ⇒ tất cả. `catalog.view_collab` ⇒ `status='in_stock' AND collab_visible` và **chỉ qua view `v_units_collab`** (cột: mã, loại, ảnh, thông số, giá hiệu lực) |
| `unit_cost_entries`, `part_costs`, `sale_line_costs`, `repair_line_costs` | `cost.view` |
| `purchase_*` | `purchase.view`; trường thanh toán/nợ cần `debt.view_supplier` (view tách) |
| `sales`, `sale_lines` | `sale.view` ⇒ tất cả; `sale.view_own` ⇒ `created_by = me OR collaborator_id = me` |
| `customers` | `customer.view` ⇒ tất cả; `customer.view_own` ⇒ `created_by = me` |
| `repair_orders` | `repair.view` ⇒ tất cả; `repair.view_assigned` ⇒ `assigned_technician_id = me` |
| `repair_tech_pay` | `techpay.view` ⇒ tất cả; còn lại `technician_id = me` |
| `sale_commissions` | `commission.view` ⇒ tất cả; `commission.view_own` ⇒ `collaborator_id = me` |
| `payments`, `ledger_entries`, `cash_accounts`, `payment_allocations` | `finance.view`; nhân viên bán hàng đọc phiếu thu của **phiếu mình xem** qua view `v_sale_payments` (không lộ quỹ khác) |
| `audit_logs` | `audit.view` |
| `files` | Theo quyền của thực thể chứa tệp (`entity_table`/`entity_id`); ảnh ID người bán chỉ `customer.pii.view`/`purchase.view` |

`INSERT/UPDATE/DELETE` của `wf_app` **không** được cấp trên bảng nghiệp vụ lõi (chỉ `EXECUTE` các `fn_*`), ngoại trừ vài bảng danh mục đơn giản (brands, part_categories, storage_locations, customer_groups…) có policy ghi theo `*.manage`.

## 6. Dữ liệu cá nhân (PII)

| Dữ liệu | Biện pháp |
|---|---|
| CCCD người bán / khách | `id_number_enc` AES-256-GCM (khóa `PII_KEY_V1`, version hóa), `id_number_bidx` (HMAC-SHA256 với `PII_BIDX_KEY`) để tìm chính xác; giao diện chỉ hiện `*** *** 123`; xem đủ ⇒ `customer.pii.view` + lý do + audit `pii.reveal` |
| Ảnh giấy tờ người bán | Bucket riêng tư `documents`; URL ký ngắn hạn (≤ 5 phút); hạn chế quyền; không hiện trong danh sách chung |
| SĐT, email, địa chỉ | Lưu rõ nhưng theo RLS; không đưa vào URL/log; xuất Excel cần quyền |
| Nhật ký | Che cột nhạy cảm (`id_number_*`, `password_hash`, `totp_secret_enc`) trước khi ghi `before/after` |
| AI | Không gửi PII; ẩn danh hóa mọi thứ trước khi gọi (xem `integrations`) |
| Quyền chủ thể dữ liệu | Có thể ẩn danh khách (xóa PII, giữ giao dịch) khi được yêu cầu: `fn_anonymize_customer` (audit) |

Mất `PII_*` = mất khả năng đọc CCCD đã mã hóa ⇒ khóa nằm trong trình quản lý mật khẩu của chủ và là mục bắt buộc của runbook.

## 7. Xác thực & phiên (port từ Lưu Xá)

- Mật khẩu **Argon2id** (`@node-rs/argon2`); độ dài ≥ 10; kiểm danh sách mật khẩu phổ biến tối thiểu.
- **Access token** JWT EdDSA (jose), 15 phút, cookie `__Host-wf_at` (`HttpOnly; Secure; SameSite=Lax; Path=/`). **Refresh token** ngẫu nhiên 30 ngày, lưu băm SHA-256, **xoay vòng mỗi lần dùng**; dùng lại token đã xoay ⇒ thu hồi cả phiên (`reuse_detected_at`). Cookie `__Host-wf_rt` (`Path=/api/v1/auth`).
- Kiểm tra phiên **trong cùng lượt `BEGIN`** của request đầu tiên (không tốn thêm vòng mạng) — phiên bị thu hồi ⇒ rollback và 401.
- **MFA TOTP** (RFC 6238) bắt buộc cho vai trò trong `security.mfa_required_roles` (mặc định `owner`); mã khôi phục dùng một lần. Thao tác nhạy cảm (khóa kỳ, mở kỳ, điều chỉnh quỹ, xem PII, đổi quyền) yêu cầu **xác thực lại trong 5 phút**.
- Khóa tạm sau 5 lần sai, 15 phút; đổi mật khẩu thu hồi phiên khác; mật khẩu tạm (do chủ đặt) buộc đổi ở lần đầu, **chặn mọi API trừ `/api/v1/auth/*`** cho tới khi đổi.
- Thiết bị tin cậy (tùy chọn) để giảm hỏi TOTP; liệt kê & thu hồi phiên ở Cài đặt → Bảo mật.
- **CSRF**: cookie ⇒ mọi `POST/PUT/PATCH/DELETE` cần token CSRF (double-submit) + kiểm `Origin`/`Sec-Fetch-Site`. Cùng origin duy nhất (Vercel phục vụ cả giao diện lẫn `/api/v1`) ⇒ không cần CORS ở production.
- **Giới hạn tốc độ** (lưu DB, `rate_limit_hits`, khóa băm — không lưu IP thô): auth 10/15 phút theo IP và theo tài khoản; mặc định 300/phút/người; xuất file 5/giờ; tải ảnh 30/phút.
- **Tiêu đề bảo mật**: CSP chặt (`default-src 'self'`; ảnh từ origin Storage đã ký), HSTS, `X-Content-Type-Options`, `Referrer-Policy: same-origin`, `Permissions-Policy` (camera cho trang quét/chụp), `X-Frame-Options: DENY`.

## 8. Mô hình mối đe dọa (rút gọn)

| Mối đe dọa | Biện pháp |
|---|---|
| Nhân viên bán hàng lấy giá vốn/lãi qua API hoặc Excel | Bảng giá vốn riêng + RLS, hàm báo cáo kiểm quyền, PT-01/PT-05 |
| CTV xem khách/hàng không được phép | RLS theo `created_by` / view `v_units_collab`, PT-02/PT-03 |
| Mass-assignment (tự đổi vai trò, trạng thái, `paid`) | `wf_app` không UPDATE cột nhạy cảm; thao tác qua `fn_*`; PT-07 |
| Hai người bán một chiếc / ghi tiền lệch kho | Khóa dòng + unique một phần + giao dịch nguyên tử; CT-01…, SC-* |
| Sửa quá khứ để che gian lận | Bất biến + bút toán đảo + chuỗi băm sổ quỹ + audit append-only; PT-08/09 |
| Lộ khóa/chuỗi kết nối | Repo private, secret scanning, khóa riêng từng môi trường, xoay vòng định kỳ (runbook) |
| Chiếm tài khoản qua đổi email | Đổi email xóa `email_verified_at`, yêu cầu xác thực lại; chủ mới đổi được email người khác |
| Lộ ảnh giấy tờ | Bucket riêng tư, URL ký ngắn hạn, quyền theo thực thể |
| XSS đánh cắp phiên | Token `HttpOnly`, CSP chặt, không dùng `dangerouslySetInnerHTML` với dữ liệu người dùng |
| Brute force / credential stuffing | Giới hạn tốc độ + khóa tạm + MFA cho owner |
| Mất dữ liệu | Sao lưu 2 lớp + diễn tập; RPO/RTO (BR-BAK-*) |
| AI rò dữ liệu | Tắt mặc định, ẩn danh hóa, không quyết định nghiệp vụ |

## 9. Kiểm thử bảo mật

Bộ **PT-xx** (`test-plan`) chạy trong CI mỗi lần phát hành: ma trận vai trò × endpoint nhạy cảm; truy vấn trực tiếp dưới `wf_app` không `SET app.current_user_id` ⇒ 0 dòng ở mọi bảng; thử UPDATE/DELETE/TRUNCATE trên bảng bất biến; thử mass-assignment; kiểm test cấu trúc "mọi bảng `public` có RLS bật + FORCE".
