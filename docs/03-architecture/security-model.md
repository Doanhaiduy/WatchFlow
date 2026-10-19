# Mô hình bảo mật & phân quyền

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-02` — xem **§8c**: CTV chỉ còn `collab.view_own`, không còn API giá vốn/CCCD) · Quy tắc gốc: BR-SEC-*, BR-COL-17, ADR-003/004/005

## 1. Các lớp bảo vệ (phòng thủ chiều sâu)

| Lớp | Việc đảm bảo | Vai trò |
|---|---|---|
| **RLS + `GRANT` theo bảng/cột + trigger bảo vệ cột** | Ai thấy dòng nào, ai ghi cột nào; phiên quên gắn người dùng trả **0 dòng** ở mọi bảng | **Chốt chặn dữ liệu chính** — dù API có lỗi vẫn không lộ/sửa sai |
| **Hàm `app.fn_*`** (`SECURITY DEFINER`, tự kiểm quyền trong thân) | Thao tác ghi nhiều bước là nguyên tử và đúng quy trình (thanh toán, kho, trạng thái) | **Đường ghi duy nhất** cho dữ liệu nghiệp vụ |
| **API** (`api({...}, handler)`) | Xác thực, kiểm Zod, kiểm quyền sớm (403 nhanh), idempotency, giới hạn tốc độ, ánh xạ mã lỗi tiếng Việt, Server-Timing | Trải nghiệm & chống lạm dụng — không phải nơi duy nhất giữ quy tắc |
| **Giao diện** | Ẩn/hiện theo quyền (`useSession().can`) | Chỉ là UX |

Hệ quả: API **không bao giờ** chạy bằng superuser hay chủ bảng (RLS sẽ bị bỏ qua); mọi test tích hợp chạy dưới `wf_app`; thêm bảng mới mà thiếu RLS/GRANT ⇒ test cấu trúc (S1…S12) thất bại.

## 2. Vai trò cơ sở dữ liệu

| Vai trò DB | Thuộc tính | Dùng cho |
|---|---|---|
| `wf_owner` | Chủ sở hữu đối tượng (không đăng nhập runtime) | Sở hữu bảng/hàm |
| `wf_definer` | Chủ sở hữu hàm `SECURITY DEFINER`; `NOLOGIN BYPASSRLS` + quyền DML bảng (CQ-001) | Hàm đặc quyền, có `SET search_path` cố định, tự kiểm quyền trong thân |
| `wf_api` | `LOGIN`, `NOINHERIT` | Kết nối của ứng dụng; không quyền gì nếu quên `SET ROLE` |
| `wf_app` | `NOLOGIN`, chịu RLS | `SET LOCAL ROLE wf_app` cho mọi truy vấn của người dùng đã đăng nhập |
| `wf_auth` | Quyền riêng trên bảng xác thực | Đăng nhập, đăng ký, làm mới token, MFA |
| `wf_worker` | `BYPASSRLS`, không UPDATE/DELETE bảng bất biến | Cron, dọn dẹp, xử lý ảnh, gửi thông báo, kiểm bất biến |
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
| | `doc.backdate` | Ghi ngày chứng từ lùi quá [`doc.max_backdate_days`] — nhạy cảm |
| **catalog** | `catalog.view` | Xem đồng hồ, loại, thương hiệu, vị trí (đầy đủ trừ giá vốn) |
| | `catalog.manage` | Tạo/sửa loại, chiếc (thông tin phi tài chính), ảnh, phụ kiện |
| | `unit.price.edit` | Sửa giá niêm yết/khuyến mãi |
| | `unit.release` | Chuyển `inspecting → in_stock` |
| | `location.manage` | Quản lý vị trí lưu kho, di chuyển |
| **parts** | `part.view` | Xem linh kiện, tồn (không giá vốn) |
| | `part.manage` | Tạo/sửa linh kiện, xem lịch sử xuất nhập |
| | `part.stock.adjust` | Điều chỉnh tồn linh kiện (lý do bắt buộc) |
| **partners** | `customer.view` | Xem tất cả khách |
| | `customer.view_own` | Xem khách do chính mình tạo (CTV) |
| | `customer.create`, `customer.manage` | Tạo khách / sửa khách bất kỳ |
| | `customer.pii.view` | Xem CCCD đầy đủ (nêu lý do, có audit) — nhạy cảm |
| **cost & tiền nhạy cảm** | `cost.view` | Xem giá nhập, giá vốn (giá thu của cửa hàng), giá vốn dòng bán — nhạy cảm |
| | `cost.adjust` | Điều chỉnh giá vốn — nhạy cảm |
| | `profit.view` | Xem lợi nhuận/lãi gộp — nhạy cảm |
| | `debt.view` | Xem phiếu còn nợ của khách (R6) |
| **purchasing** | `purchase.view`, `purchase.create`, `purchase.confirm`, `purchase.void` | Xem / lập nháp / xác nhận / hủy phiếu nhập |
| **sales** | `sale.view` | Xem mọi phiếu bán |
| | `sale.view_own` | Xem phiếu do mình tạo (CTV) |
| | `sale.create_draft`, `sale.confirm` | Lập nháp / xác nhận phiếu bán |
| | `sale.below_cost` | Bán dưới giá vốn — nhạy cảm |
| | `sale.void` | Hủy phiếu bán trong cửa sổ — nhạy cảm |
| | `reservation.manage`, `reservation.forfeit` | Giữ hàng/hoàn cọc; tịch thu cọc — nhạy cảm |
| | `warranty.view` | Tra cứu bảo hành |
| **payments** | `payment.create` | Ghi thanh toán của khách (thu thêm, cọc) |
| | `payment.void` | Hủy thanh toán (lý do) — nhạy cảm |
| **collaborators** | `collab.view` | Xem mọi CTV, phiếu giao, quyết toán, thống kê (R9) — nhạy cảm |
| | `collab.manage` | Hồ sơ CTV; giao hàng, thu hồi, quyết toán, hủy quyết toán — nhạy cảm |
| | `collab.view_own` | CTV xem hàng đang giữ (kèm giá thu), đơn, quyết toán, thống kê **của mình** |
| **repairs** | `repair.view` | Xem mọi phiếu sửa |
| | `repair.create` | Nhận máy (tạo phiếu) |
| | `repair.update` | Ghi kiểm tra, thêm dòng, đổi trạng thái, xác nhận dùng linh kiện, ghi nhận khách đồng ý báo giá |
| | `repair.price.edit` | Sửa giá trên dòng sửa chữa |
| | `repair.deliver` | Giao máy, thu tiền / ghi nợ |
| **inventory** | `stocktake.manage` | Kiểm kê |
| | `stock.writeoff` | Thanh lý/ghi mất / khôi phục chiếc — nhạy cảm |
| **reports** | `report.sales`, `report.inventory`, `report.export` | Báo cáo doanh thu / kho / quyền xuất file (xuất vẫn tuân quyền dữ liệu) |

**Đóng băng từ `customer-feedback-02`** (`RETIRED_PERMISSIONS` trong `src/lib/permissions.ts` — còn trong DB vì hàm cũ kiểm quyền, nhưng **ẩn khỏi Quản trị → Vai trò & quyền** và không API mới nào dùng): `part.view`, `part.manage`, `part.stock.adjust`, `customer.pii.view`, `cost.view`, `cost.adjust`, `profit.view`, `debt.view`, `purchase.view`, `purchase.void`, `sale.view_own`, `sale.create_draft`, `sale.below_cost`, `reservation.manage`, `reservation.forfeit`, `payment.create`, `payment.void`, `stocktake.manage`. Quyền **đang dùng cho CTV/đơn gọn**: `collab.view`, `collab.manage`, `collab.view_own`, `sale.view`, `sale.confirm`, `sale.void`, `customer.view`, `customer.create`, `customer.manage`, `repair.*`, `report.sales`, `report.inventory`, `report.export`, `catalog.*`, `purchase.create`, `purchase.confirm`, `unit.release`, `stock.writeoff`.

**Đã bỏ** (CF-05/06/07): `supplier.*`, `debt.view_supplier`, `techpay.view`, `finance.*`, `payment.pay`, `ledger.adjust`, `account.manage`, `period.*`, `return.*`, `commission.*`, `catalog.view_collab`, `repair.view_assigned`, `repair.assign`, `repair.approve_quote`.

## 4. Ma trận vai trò mặc định

`●` có · `○` không · `◐` giới hạn (ghi chú). Chủ chỉnh được; thay đổi có audit. **Không còn vai trò Thợ.**

| Quyền | owner | sales | warehouse | collaborator |
|---|---|---|---|---|
| `user.manage`, `role.manage`, `settings.*`, `audit.view`, `system.*`, `doc.backdate` | ● | ○ | ○ | ○ |
| `catalog.view` | ● | ● | ● | ○ |
| `catalog.manage`, `location.manage`, `unit.release` | ● | ○ | ● | ○ |
| `unit.price.edit` | ● | ○ | ○ | ○ |
| `part.view` | ● | ● | ● | ○ |
| `part.manage`, `part.stock.adjust` | ● | ○ | ● | ○ |
| `customer.view` | ● | ● | ○ | ○ |
| `customer.view_own`, `customer.create` | ●/● | ●/● | ○ | ○/○ (CF-12: CTV không đọc/tạo khách — khách do chủ nhập khi xác nhận báo bán) |
| `customer.manage` | ● | ● | ○ | ○ |
| `customer.pii.view` | ● | ○ | ○ | ○ |
| `cost.view` | ● | ○ | ● | ○ |
| `cost.adjust`, `profit.view` | ● | ○ | ○ | ○ |
| `debt.view` | ● | ● | ○ | ○ |
| `purchase.view`, `purchase.create`, `purchase.confirm` | ● | ○ | ● | ○ |
| `purchase.void` | ● | ○ | ○ | ○ |
| `sale.view` | ● | ● | ○ | ○ |
| `sale.view_own` | ○ | ○ | ○ | ○ (đóng băng) |
| `sale.create_draft` | ● | ● | ○ | ○ (đóng băng — CTV không tạo đơn, chỉ "báo đã bán") |
| `sale.confirm` | ● | ● | ○ | ○ |
| `sale.below_cost`, `sale.void` | ● | ○ | ○ | ○ |
| `reservation.manage` | ● | ● | ○ | ○ |
| `reservation.forfeit` | ● | ○ | ○ | ○ |
| `warranty.view` | ● | ● | ○ | ○ |
| `payment.create` | ● | ● | ○ | ○ |
| `payment.void` | ● | ○ | ○ | ○ |
| `collab.view`, `collab.manage` | ● | ○ | ○ | ○ |
| `collab.view_own` | ○ | ○ | ○ | ● (quyền duy nhất của vai trò CTV) |
| `repair.view`, `repair.create`, `repair.update`, `repair.price.edit`, `repair.deliver` | ● | ○ | ○ | ○ |
| `stocktake.manage` | ● | ○ | ● | ○ |
| `stock.writeoff` | ● | ○ | ○ | ○ |
| `report.sales` | ● | ◐ chỉ doanh thu, không lãi | ○ | ○ |
| `report.inventory` | ● | ○ | ● | ○ |
| `report.export` | ● | ● | ● | ○ |
| **`roles.max_discount_pct`** | 100 | 5 | 0 | 0 (không còn dùng: đơn gọn không có giảm giá/hạn mức — BR-SALE-23) |

> Chủ có thể cấp `repair.*` cho nhân viên bán hàng nếu muốn nhân viên nhận máy; mặc định chỉ chủ (CF-04/05).
> Quy tắc nhất quán: nếu một quyền "tiền nhạy cảm" không có, thì **mọi** endpoint/báo cáo/export/in chứa dữ liệu đó trả 403 (hàm) hoặc không có cột (khung nhìn công khai cho vai trò đó). Ví dụ `sales` xem phiếu bán nhưng danh sách phiếu **không có** cột giá vốn/lãi (`sale_lines` đọc được, `sale_line_costs` không).

## 5. Phạm vi dữ liệu (row scope) — RLS

| Đối tượng | Chính sách `SELECT` (rút gọn) |
|---|---|
| `users`, `roles` | Mỗi người thấy hồ sơ mình; `user.manage` thấy tất cả; danh sách nhân viên để chọn qua view rút gọn |
| `watch_units` | `catalog.view` ⇒ tất cả. CTV (`collab.view_own`) **không có quyền đọc bảng**; chỉ đọc qua hàm `fn_my_offers()` ⇒ chiếc có chào hàng `active` cho mình (mã, loại, ảnh, thông số, **giá niêm yết**, ngày giao, đã có CTV khác báo chưa; không giá vốn) |
| `unit_cost_entries`, `part_costs`, `sale_line_costs`, `repair_line_costs` | `cost.view` |
| `purchase_*` | `purchase.view` |
| `sales`, `sale_lines` | `sale.view` ⇒ tất cả (chủ, bán hàng). CTV **không** đọc được (kể cả đơn do mình bán — chỉ thấy báo bán của mình qua `fn_my_claims`). Danh sách/chi tiết đơn không có cột giá vốn/lãi/thanh toán |
| `customers` | `customer.view` ⇒ tất cả; `customer.view_own` ⇒ `created_by = me` (không vai trò mặc định nào còn dùng). CTV: 0 dòng |
| `repair_orders`, `repair_lines` | `repair.view` |
| `payments` | `debt.view`/`payment.create` ⇒ tất cả; nhân viên bán hàng đọc thanh toán của phiếu mình xem; CTV chỉ thanh toán `collab_settlement` của mình |
| `collaborator_offers`, `collaborator_claims` | `collab.view` (+ `sale.confirm` cho báo bán) ⇒ tất cả; `collab.view_own` ⇒ `collaborator_id = me`. Ghi chỉ qua `fn_*` |
| `collaborator_assignments`, `_lines`, `collaborator_settlements` | **đóng băng** (dữ liệu cũ): `collab.view` ⇒ tất cả; `collab.view_own` ⇒ `collaborator_id = me` |
| `audit_logs` | `audit.view` |
| `files` | Theo quyền của thực thể chứa tệp (`entity_table`/`entity_id`); ảnh giấy tờ người bán chỉ `customer.pii.view`/`purchase.view` |

`INSERT/UPDATE/DELETE` của `wf_app` **không** được cấp trên bảng nghiệp vụ lõi (chỉ `EXECUTE` các `fn_*`), ngoại trừ vài bảng danh mục đơn giản (brands, part_categories, storage_locations, customer_groups…) và bảng **nháp** (có policy ghi theo quyền; CTV chỉ ghi nháp đơn của mình với chiếc đang giữ).

## 6. Dữ liệu cá nhân (PII)

| Dữ liệu | Biện pháp |
|---|---|
| CCCD người bán / khách | `id_number_enc` AES-256-GCM (khóa `PII_KEY_V1`, version hóa), `id_number_bidx` (HMAC-SHA256 với `PII_BIDX_KEY`) để tìm chính xác; giao diện chỉ hiện `*** *** 123`; xem đủ ⇒ `customer.pii.view` + lý do + audit `pii.reveal` |
| Ảnh giấy tờ người bán | Bucket riêng tư `documents`; URL ký ngắn hạn (≤ 5 phút); hạn chế quyền; không hiện trong danh sách chung. **Ẩn danh khách ⇒ XÓA THẬT** (BR-SEC-09, migration 0014): `fn_anonymize_customer` đánh dấu xóa mọi ảnh `id_document` của khách (gắn khách, phiếu thu mua có `seller_customer_id`, phiếu bán) ⇒ `purge_after = now()` ⇒ job DAILY `storage-purge` xóa ảnh chính + thumb khỏi kho (local: `fs.rm`; Supabase: `DELETE /storage/v1/object/<bucket>`) rồi mới chốt `purged_at` (lỗi ⇒ thử lại lượt sau). Tệp bất biến khác (nhận máy/chứng từ) không bao giờ tự xóa |
| SĐT, email, địa chỉ | Lưu rõ nhưng theo RLS; không đưa vào URL/log; xuất Excel cần quyền |
| Tên + SĐT khách do CTV nhập khi báo bán | Lưu ở `collaborator_claims`; che (`***`) trong `audit_logs`; chỉ CTV đó và người có `collab.view`/`sale.confirm` đọc; khi chủ xác nhận, khách được tạo/dùng lại trong `customers` (chủ nhập liệu, CTV không đọc được) |
| Nhật ký | Che cột nhạy cảm (`id_number_*`, `password_hash`, `totp_secret_enc`) trước khi ghi `before/after` |
| AI | Không gửi PII; ẩn danh hóa mọi thứ trước khi gọi (xem `integrations`) |
| Quyền chủ thể dữ liệu | (Bản gọn không còn nút/API ẩn danh — hàm `fn_anonymize_customer` vẫn còn ở DB, chủ chạy qua SQL khi cần.) Có thể ẩn danh khách (xóa PII **và ảnh giấy tờ thật**, giữ giao dịch) khi được yêu cầu: `fn_anonymize_customer` (audit `customer.anonymized` ghi số ảnh giấy tờ đã xóa; `storage.purged` khi kho đã xóa). Bản sao lưu cũ vẫn chứa dữ liệu cũ đến hết vòng đời sao lưu (xem `backup-restore`) |

Mất `PII_*` = mất khả năng đọc CCCD đã mã hóa ⇒ khóa nằm trong trình quản lý mật khẩu của chủ và là mục bắt buộc của runbook.

## 7. Xác thực & phiên (port từ Lưu Xá)

- Mật khẩu **Argon2id** (`@node-rs/argon2`); độ dài ≥ 10; kiểm danh sách mật khẩu phổ biến tối thiểu.
- **Access token** JWT EdDSA (jose), 15 phút, cookie `__Host-wf_at` (`HttpOnly; Secure; SameSite=Lax; Path=/`). **Refresh token** ngẫu nhiên 30 ngày, lưu băm SHA-256, **xoay vòng mỗi lần dùng**; dùng lại token đã xoay ⇒ thu hồi cả phiên (`reuse_detected_at`). Cookie `__Host-wf_rt` (`Path=/api/v1/auth`).
- Kiểm tra phiên **trong cùng lượt `BEGIN`** của request đầu tiên (không tốn thêm vòng mạng) — phiên bị thu hồi ⇒ rollback và 401.
- **MFA TOTP** (RFC 6238) bắt buộc cho vai trò trong `security.mfa_required_roles` (mặc định `owner`); mã khôi phục dùng một lần. Thao tác nhạy cảm (hủy quyết toán CTV, đổi quyền, xem PII, hủy phiếu bán) yêu cầu **xác thực lại trong 5 phút**.
- Khóa tạm sau 5 lần sai, 15 phút; đổi mật khẩu thu hồi phiên khác; mật khẩu tạm (do chủ đặt) buộc đổi ở lần đầu, **chặn mọi API trừ `/api/v1/auth/*`** cho tới khi đổi.
- **Tin cậy thiết bị này N ngày** (BR-SEC-10; `0021a_trusted_devices`, `src/server/auth/trusted-device.ts`; cài đặt `security.trusted_device_days`, mặc định 30, **0 = tắt**, tối đa 90). Ô "Tin cậy thiết bị này" ở bước `/xac-thuc-2-buoc` (chỉ hiện khi tính năng bật). Tick ⇒ máy chủ sinh token ngẫu nhiên **256-bit** đặt trong cookie `__Secure-wf_td` (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; chạy http local: `wf_td`); **DB chỉ lưu SHA-256** (`trusted_devices.token_hash`), không bao giờ token thô, không có trong audit. Hiệu lực: gắn đúng **một tài khoản** (token của A vô dụng với B), **hết hạn cố định** (không gia hạn khi dùng), **nhãn thiết bị** (trình duyệt · hệ điều hành suy từ User-Agent) phải trùng lúc tin cậy; một trình duyệt tin cậy tối đa 5 tài khoản (cookie chứa ≤ 5 token), mỗi người ≤ 10 thiết bị còn hạn. **Chỉ bỏ bước mã 6 số khi đăng nhập — MẬT KHẨU LUÔN PHẢI ĐÚNG** (kiểm trước, tài khoản khóa/vô hiệu bị chặn trước, đếm sai/khóa tạm như thường). Phiên tạo qua thiết bị tin cậy có `mfa_at` nhưng **không có `reauth_at`**: thao tác nhạy cảm (`requireReauth`: xem CCCD, đặt lại mật khẩu, tắt 2FA, đổi quyền…) **vẫn đòi mật khẩu + mã 2FA**. Thu hồi: (a) **trigger `trg_users__revoke_trusted` trên `users`** — đổi/đặt lại mật khẩu (kể cả chủ đặt lại), tài khoản chuyển khỏi `active` (chủ khóa), tắt/gỡ 2FA — mọi đường đều đi qua trigger nên không thể sót, ghi audit `auth.trusted_devices_revoked`; (b) người dùng bấm "Quên các thiết bị đã tin cậy" / "Bỏ" từng thiết bị ở `/cai-dat` (xóa luôn cookie máy này); (c) đặt `security.trusted_device_days = 0` ⇒ thiết bị cũ lập tức không còn bỏ qua mã. Audit: `auth.device_trusted`, `auth.login_trusted`, `auth.trusted_device_revoked`. Bảng `trusted_devices` chỉ `wf_auth`/`wf_worker`/`wf_definer` truy cập (`wf_app` không đọc/ghi); job hằng ngày dọn dòng hết hạn/thu hồi > 7 ngày. Rủi ro còn lại (chấp nhận, chủ động nêu ở CQ): kẻ có **cả mật khẩu lẫn cookie thiết bị** vào được trong N ngày — giảm thiểu bằng cookie HttpOnly/SameSite=Strict, ràng buộc nhãn thiết bị, khuyến nghị chỉ tick trên máy riêng, thu hồi tự động khi đổi mật khẩu, và N chỉnh/tắt được.
- Liệt kê & thu hồi phiên ở Cài đặt → Bảo mật (`/cai-dat`).
- **CSRF**: cookie ⇒ mọi `POST/PUT/PATCH/DELETE` cần token CSRF (double-submit) + kiểm `Origin`/`Sec-Fetch-Site`. Cùng origin duy nhất (Vercel phục vụ cả giao diện lẫn `/api/v1`) ⇒ không cần CORS ở production.
- **Giới hạn tốc độ** (lưu DB, `rate_limit_hits`, khóa băm — không lưu IP thô): auth 10/15 phút theo IP và theo tài khoản; mặc định 300/phút/người; xuất file 5/giờ; tải ảnh 30/phút; báo lỗi trình duyệt 30/phút/IP-băm + 600/giờ toàn hệ thống.
- **Endpoint công khai ghi dữ liệu — `POST /api/v1/public/client-error`** (nhật ký lỗi trình duyệt; lỗi có thể xảy ra trước khi đăng nhập). Bảo vệ: kiểm `Origin`/`Sec-Fetch-Site` cùng nguồn (không dùng CSRF token — chưa có phiên), Zod giới hạn độ dài (message 500, stack 2000, path 300, digest 100, version 32; `kind` là enum), giới hạn tốc độ lưu DB `clientError` 30/phút theo `ipHash` + `clientErrorAll` 600/giờ toàn hệ thống ⇒ 429, **làm sạch PII ở cả hai phía** (`src/lib/client-error.ts`: che email, chuỗi số ≥ 7 chữ số, UUID, token, query; path chuẩn hóa `:id`), **không lưu IP/User-Agent/cookie/người dùng**. Ghi vào `error_events` qua vai trò `wf_worker` (không đụng bảng nghiệp vụ). Trần 8 lỗi/lần mở trang ở trình duyệt.
- **Tiêu đề bảo mật**: CSP chặt (`default-src 'self'`; ảnh từ origin Storage đã ký; font từ nguồn đã khai báo), HSTS, `X-Content-Type-Options`, `Referrer-Policy: same-origin`, `Permissions-Policy` (camera cho trang quét/chụp), `X-Frame-Options: DENY`.

## 8. Mô hình mối đe dọa (rút gọn)

| Mối đe dọa | Biện pháp |
|---|---|
| Nhân viên bán hàng lấy giá vốn/lãi qua API hoặc Excel | Bảng giá vốn riêng + RLS, hàm báo cáo kiểm quyền, PT-01/PT-05 |
| CTV xem hàng/khách/đơn/doanh thu của CTV khác hoặc của cửa hàng; CTV thấy giá vốn | CTV chỉ có `collab.view_own`; không `SELECT` bảng đơn/khách/chiếc/bảo hành/giá vốn; đọc qua hàm `fn_my_*` chỉ trả cột an toàn; RLS `collaborator_id = me` ở chào hàng/báo bán; **PT-14** |
| CTV báo "đã bán" nhưng thực tế chưa bán / bán rồi giấu | Rủi ro nghiệp vụ nằm ngoài hệ thống (cửa hàng không thấy tiền khách trả CTV — CF-12); giảm thiểu: chủ xác nhận từng báo bán (tên + SĐT khách bắt buộc để gọi lại), thấy ai báo gì, thống kê số chiếc theo CTV |
| Mass-assignment (tự đổi vai trò, trạng thái, `held_by_collaborator_id`, số tiền) | `wf_app` không UPDATE cột nhạy cảm; thao tác qua `fn_*`; PT-07 |
| Hai người bán một chiếc / hai CTV cùng báo bán một chiếc | Khóa chiếc + unique một phần `ux_collab_claims_pending_unit` + giao dịch nguyên tử; CT-01, CT-14, SC-18/19 |
| Sửa quá khứ để che gian lận | Bất biến + hủy có lý do + audit append-only; PT-08/09 |
| Lộ khóa/chuỗi kết nối | Không bí mật trong repo (hiện public ⇒ càng nghiêm; chuyển private trước khi có dữ liệu thật), secret scanning, khóa riêng từng môi trường, xoay vòng định kỳ (runbook) |
| Chiếm tài khoản qua đổi email | Đổi email xóa `email_verified_at`, yêu cầu xác thực lại; chủ mới đổi được email người khác |
| Lộ ảnh giấy tờ | Bucket riêng tư, URL ký ngắn hạn, quyền theo thực thể |
| XSS đánh cắp phiên | Token `HttpOnly`, CSP chặt, không dùng `dangerouslySetInnerHTML` với dữ liệu người dùng; phần tử UI bên thứ ba (Lucian) được rà trước khi dùng — `ui-design-system` §9 |
| Brute force / credential stuffing | Giới hạn tốc độ + khóa tạm + MFA cho owner |
| Mất dữ liệu | Sao lưu 2 lớp + diễn tập; RPO/RTO (BR-BAK-*) |
| AI rò dữ liệu | Tắt mặc định, ẩn danh hóa, không quyết định nghiệp vụ |

## 8a. Bổ sung khi triển khai (2026-10-17)

- `sale_lines.base_price_vnd` / `shop_revenue_vnd` **không** cấp `SELECT` cho `wf_app`; đọc qua `app.fn_sale_line_collab(sale_id)` (cần `cost.view`/`collab.view` hoặc chính CTV của đơn). `part_stock_movements.unit_cost/prev_avg` đọc qua `app.fn_part_movement_costs` (`cost.view`). `customers.id_number_enc` không cấp `SELECT`; xem đủ qua `app.fn_reveal_customer_id` (lý do + audit `pii.reveal`) + xác thực lại 5 phút.
- `audit_logs` của bảng `customers` chỉ ghi tên cột PII đã đổi (giá trị `***`) để ẩn danh khách có hiệu lực (CQ-007).
- Thu cũ đổi mới: `fn_confirm_purchase`/`fn_void_purchase` bỏ qua `purchase.*` chỉ khi được `fn_confirm_sale`/`fn_void_sale` gọi nội bộ cho đúng phiếu `trade_in` (CQ-009).
- Giới hạn tốc độ đăng nhập/MFA/xác thực lại chỉ đếm lần **sai** (CQ-004) — mọi bucket (kể cả đăng nhập theo IP + email đã chuẩn hóa) giữ chỗ +1 trước khi chạy rồi trả lại đúng chỗ đó nếu không sai (chống đua). Kết nối phụ (wf_auth/wf_worker) dùng pool riêng để không chờ vòng tròn với pool wf_app. Ân hạn dùng lại refresh token 10 giây: trong ân hạn chỉ cấp access token mới, không xoay, không xóa cookie (CQ-005).
- Chống chiếm quyền chủ (CQ-015): người có `user.manage`/`role.manage` mà không phải `owner` không gán/bỏ vai trò `owner`, không sửa/khóa/đặt lại mật khẩu tài khoản owner, không sửa vai trò `owner` hay vai trò mình đang giữ; không ai tự đổi vai trò/khóa/đặt lại mật khẩu chính mình. Cài đặt `security.*` chỉ owner; `security.mfa_required_roles` luôn chứa `owner`. **Trần cấp quyền:** người không phải owner chỉ thêm vào vai trò, hoặc gán cho người dùng vai trò có, những quyền chính mình đang có (`app.guard_grant_ceiling`, 0013c).
- Phiên có hạn tuyệt đối `auth_sessions.expires_at` = lúc đăng nhập + `security.refresh_token_ttl_days`; refresh không kéo dài. Hàm pgcrypto không cấp `EXECUTE` cho PUBLIC. Nhật ký che thêm tên/SĐT người bán (`purchase_receipts`) và SĐT CTV.
- Pool DB: `statement_timeout`/`lock_timeout`/`idle_in_transaction_session_timeout`; DB ngoài máy bắt buộc TLS kiểm chứng chỉ (`DB_SSL_CA` hoặc `sslmode=verify-full`, thiếu thì từ chối nối).
- Tên người dùng cho danh sách/lịch sử qua `app.user_display_name(id)` (chỉ họ tên, cần đăng nhập) và `app.fn_users_with_permission(perm)`.

- Nhập Excel (BR-IMP-*): máy chủ **không bao giờ mở tệp** (trình duyệt đọc, gửi JSON ≤ 300 dòng) nên không có bề mặt zip-bomb/tệp độc ở máy chủ; quyền kiểm theo loại (cần đủ danh sách ở `src/lib/import/perms.ts`) và ghi bằng quyền của người dùng (RLS); CCCD mã hóa tầng ứng dụng, không lặp lại trong phản hồi/audit; `app.fn_audit_import` chỉ ghi số đếm + mã phiếu.

- Thông báo đẩy (FR-PUSH-*, migration 0020): `push_subscriptions.p256dh`/`auth` là **bí mật mã hóa tin đẩy** — `wf_app` chỉ có `SELECT` các cột còn lại và chỉ dòng của mình (RLS `user_id = current_user`); không có `INSERT/UPDATE/DELETE` trực tiếp, ghi qua `app.fn_register_push_subscription` (cùng endpoint đã thuộc người khác ⇒ chuyển chủ, phục vụ máy dùng chung; tối đa 10 thiết bị/người) và `app.fn_remove_push_subscription` (chỉ của mình); chỉ `wf_worker` đọc khóa để gửi. `push_outbox` chỉ `wf_worker`. Endpoint API (mọi người dùng đã đăng nhập, chỉ dữ liệu của mình): `GET/PUT /api/v1/me/push-config`, `POST/DELETE /api/v1/me/push-subscriptions`, `POST /api/v1/me/push-subscriptions/test` (1 lần/10 giây/người). Tin đẩy chỉ chứa tiêu đề ≤ 120, nội dung ≤ 200, liên kết nội bộ (`safeLink`: bắt đầu `/`, chặn `//`, `\\`, ký tự điều khiển), id thông báo — không mã người dùng/email/PII. `sw.js` cũng kiểm đường dẫn trước khi mở. Audit `push.subscribed/unsubscribed` không kèm endpoint/khóa. `sw.js`/`offline.html`/`offline.js` ngoài proxy CSP: có CSP tĩnh riêng ở `next.config.ts`.

## 8b. Nhật ký hoạt động cấp request (BR-SEC-11; migration `0021_activity`)

Bổ sung cho `audit_logs` (thay đổi **dữ liệu**, do trigger/hàm DB ghi): `activity_logs` trả lời "**ai đã gọi API nào, lúc nào, kết quả gì, từ máy nào**" ở mức yêu cầu — kể cả thao tác thất bại/bị từ chối và các lần **đọc nhạy cảm** (audit chỉ thấy khi dữ liệu đổi).

- **Ghi** (`src/server/activity.ts`, móc ở `api()` trong `http.ts`): xếp vào hàng chờ trong bộ nhớ rồi `after()` (Next) ghi **sau khi đã trả phản hồi**, gộp mọi request đang chờ thành **một** `INSERT … unnest` dưới `wf_worker` (pool phụ) ⇒ không thêm độ trễ cho request; lỗi ghi không bao giờ làm hỏng request (chỉ `console.error`); hàng chờ tràn (DB hỏng) ⇒ bỏ bớt. Ghi: **mọi thao tác ghi** (POST/PUT/PATCH/DELETE, kể cả 4xx/5xx và 403), trừ `SKIP_ROUTES` (đánh dấu thông báo đã đọc, báo lỗi trình duyệt, heartbeat); **GET chỉ khi** là sự kiện nhạy cảm hoặc bị từ chối quyền (403, trừ khi chỉ thiếu 2FA/đổi mật khẩu). Không bao giờ ghi: health, huy hiệu, thông báo (poll), tìm kiếm gõ từng phím, `/auth/me`, `/system/status`, tra cứu chiếc.
- **Mã sự kiện nhạy cảm** (`activity_logs.action`, gắn ở máy chủ từ method + route + `format=xlsx`, không lưu query): `export` (xuất Excel báo cáo), `print` (in phiếu bán/phiếu sửa, tem), `view_report` (xem báo cáo, báo cáo CTV; trang Tổng quan tự nạp nên không ghi), `view_audit` (xem nhật ký). (`view_cost`, `reveal_pii` đã gỡ cùng các API giá vốn/CCCD — CF-14.) Các sự kiện đã có audit riêng (`report.exported`) **cùng `request_id`** ⇒ nối được hai bảng.
- **Riêng tư theo cấu trúc**: cột `route` là **mẫu** (`/api/v1/collab/claims/[id]/confirm`), không chứa giá trị tham số, query, nội dung gửi lên, tên/SĐT/CCCD; CHECK ở DB chặn ký tự lạ (`?`, `=`, khoảng trắng, chữ có dấu), `entity_id` chỉ nhận UUID, `ip_hash` chỉ hex (IP băm HMAC, không IP thô). Tham số không phải UUID (có thể là PII) chỉ tồn tại ở dạng `[id]`.
- **Đọc**: chỉ quyền `audit.view` (policy RLS `has_permission('audit.view')`; API kiểm sớm); `wf_app` không INSERT/UPDATE/DELETE. Tên người dùng qua `app.user_display_name`. Giao diện Quản trị → **Hoạt động** (`/quan-tri/hoat-dong`): tab "Thao tác" (lọc người, khu vực, khoảng ngày, kết quả, chỉ sự kiện nhạy cảm) và tab "Đăng nhập".
- **Lịch sử đăng nhập không nhân đôi dữ liệu**: tab "Đăng nhập" đọc lại `audit_logs` với `action` thuộc `auth.*` (đăng nhập, sai mật khẩu, khóa tạm, sai mã 2FA, dùng mã khôi phục, dùng lại refresh token, đổi mật khẩu, thiết bị tin cậy…) và `user.password_reset`/`user.status` do `activity-labels.ts` (`AUTH_EVENT_LABEL`) gắn nhãn tiếng Việt.
- **Append-only + dọn có kiểm**: trigger `tg_activity_immutable` chặn UPDATE; `tg_no_truncate` chặn TRUNCATE; DELETE **chỉ** thành công khi chạy trong `app.fn_activity_purge()` (SECURITY DEFINER, owner `wf_definer`, `EXECUTE` chỉ `wf_worker`): trigger yêu cầu đồng thời `current_user = 'wf_definer'` và cờ cục bộ `app.activity_purge='on'` do chính hàm đặt/xóa trong transaction ⇒ `wf_definer`/`wf_worker` gọi DELETE trực tiếp đều bị chặn. Giữ `activity.retention_days` ngày (mặc định **180**, **sàn 30** dù cài đặt/tham số nhỏ hơn); job `activity-purge` chạy hằng ngày; mỗi lần xóa ghi audit `activity.purged` (số dòng).
- Rủi ro chấp nhận: ghi sau phản hồi có thể mất một lô nếu máy chủ bị ngắt đúng khoảng đó (nhật ký là chứng cứ phụ trợ; nguồn sự thật nghiệp vụ vẫn là `audit_logs` ghi cùng transaction).

## 9. Kiểm thử bảo mật

Bộ **PT-xx** (`test-plan`) chạy trong CI mỗi lần phát hành: ma trận vai trò × endpoint nhạy cảm; truy vấn trực tiếp dưới `wf_app` không `SET app.current_user_id` ⇒ 0 dòng ở mọi bảng; thử UPDATE/DELETE/TRUNCATE trên bảng bất biến; thử mass-assignment; kiểm test cấu trúc "mọi bảng `public` có RLS bật + FORCE".

## 8c. Vòng 2 — CTV chỉ ở mức giới hạn (customer-feedback-02, migration 0023)

- **Vai trò CTV chỉ còn `collab.view_own`.** Migration 0023 gỡ `customer.view_own`, `customer.create`, `sale.view_own`, `sale.create_draft` khỏi vai trò `collaborator`. Vì không còn quyền đọc bảng nào ngoài `collaborator_offers`/`collaborator_claims` (đúng hàng của mình), CTV phải đọc qua ba hàm `SECURITY DEFINER` chỉ trả cột an toàn: `app.fn_my_offers()` (chiếc được giao + **giá niêm yết** + cờ "đã có CTV khác báo"), `app.fn_my_claims(n)` (báo bán của mình: trạng thái, lý do từ chối — **không giá**), `app.fn_my_collab_stats(from,to,period)` (**chỉ** `period_start, units_sold`).
- **CTV không bao giờ thấy:** doanh thu (cửa hàng hay của mình), giá vốn, giá bán ghi trên đơn, đơn bán, khách hàng, sửa chữa, báo cáo, chiếc không giao cho mình, chào hàng/báo bán của CTV khác. Tổng quan của CTV không có thẻ số. Kiểm bằng **PT-14** (`tests/api/m12-collab.test.mjs`, `db-simple-mode.test.mjs`, `m8-reports`, `m11-search`).
- **Không còn đường lấy giá vốn/CCCD qua API:** đã gỡ `GET /catalog/units/[id]/cost`, `POST /catalog/units/[id]/cost-adjust`, `POST /customers/[id]/reveal-id`, `POST /customers/[id]/anonymize`. Giá nhập vẫn được ghi **nội bộ** (`unit_cost_entries`, `sale_line_costs`) để dữ liệu và bất biến I8 nhất quán, nhưng `wf_app` không `SELECT` và không API nào trả ra (m1-catalog kiểm `!/"cost/`).
- **Tên + SĐT khách do CTV nhập** là PII: không vào URL/log; `tg_audit` che `customer_name`, `customer_phone`, `note` của `collaborator_claims`; chuông thông báo chỉ nêu mã chiếc, không nêu tên khách.
- **Bất biến liên quan** (kiểm hằng đêm bởi `fn_consistency_check`): I13 chào hàng `active` ⇒ chiếc `in_stock`; I14 báo bán `pending` ⇒ chiếc `in_stock` + chào hàng `active`; I15 báo bán `confirmed` ⇒ có đơn bán.
