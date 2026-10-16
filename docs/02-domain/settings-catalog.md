# Danh mục cấu hình (settings)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`)
> Lưu ở bảng `settings` (`key`, `value jsonb`, mô tả, người sửa, thời điểm). Mọi thay đổi ghi audit. Chỉnh ở **Quản trị → Cài đặt** (`settings.manage`). Thêm khóa mới = thêm dòng ở đây + migration seed + kiểu trong `src/lib/settings-catalog.ts`. **Đổi giá trị chỉ áp cho chứng từ tạo sau đó** (chứng từ cũ giữ giá trị đã chốt khi cần, vd. hạn bảo hành).

## 1. Cửa hàng (in trên phiếu)

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `store.name` | — (bắt buộc nhập) | Tên cửa hàng |
| `store.address`, `store.phone` | — | In trên phiếu |
| `store.tax_code` | — | Mã số thuế (tùy chọn) |
| `store.logo_file_id` | — | Logo in trên phiếu |
| `store.receipt_footer` | "Cảm ơn quý khách!" | Chân phiếu bán |
| `store.warranty_terms` | (mẫu) | Điều khoản bảo hành in trên phiếu |
| `store.repair_terms` | (mẫu) | Điều khoản nhận sửa chữa in trên phiếu nhận |

## 2. Bán hàng

| Khóa | Mặc định | Ý nghĩa | BR |
|---|---|---|---|
| `sales.void_window_hours` | 24 | Cửa sổ hủy phiếu bán | BR-SALE-10 |
| `sales.allow_walkin_debt` | false | Cho phép nợ với khách vãng lai | BR-SALE-07 |
| `sales.default_due_days` | 7 | Hạn hẹn trả mặc định khi bán nợ | BR-SALE-07 |
| `reservation.hold_days` | 7 | Hạn giữ hàng mặc định | BR-RSV-02 |
| `reservation.min_deposit_pct` | 10 | Cọc tối thiểu (% giá niêm yết) | BR-RSV-02 |
| `reservation.max_hold_days` | 30 | Trần hạn giữ | BR-RSV-02 |
| `doc.max_backdate_days` | 7 | Cho phép ghi ngày chứng từ lùi tối đa N ngày (lùi hơn cần `doc.backdate` + lý do) | BR-GEN-08 |

> Hạn mức giảm giá không nằm ở `settings` mà ở `roles.max_discount_pct` (theo vai trò). Mặc định: owner 100, sales 5, warehouse 0, collaborator 0 (CTV tự định giá bán, không áp hạn mức — BR-COL-04).

## 3. Bảo hành (thay cho thời hạn đổi trả — CF-02)

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `warranty.shop_months.new` | 12 | Bảo hành cửa hàng — hàng mới |
| `warranty.shop_months.used` | 3 | — hàng cũ |
| `warranty.shop_months.refurbished` | 3 | — hàng đã sửa/làm mới |
| `warranty.repair_days` | 90 | Bảo hành sau sửa chữa (ngày) |
| `warranty.expiry_alert_days` | 14 | Nhắc trước khi hết hạn |

> Khách chưa chốt thời hạn bảo hành ("blabla" — CF-02): các giá trị trên là mặc định tạm; đổi ở đây là xong, không cần sửa mã.

## 4. Cộng tác viên

| Khóa | Mặc định | Ý nghĩa | BR |
|---|---|---|---|
| `collab.hold_alert_days` | 30 | Cảnh báo chiếc ở CTV quá N ngày chưa bán/thu hồi | BR-COL-11 |
| `collab.warn_below_cost` | true | Cảnh báo khi giá thu giao CTV < giá vốn | BR-COL-01 |

## 5. Kho & nhập hàng

| Khóa | Mặc định | Ý nghĩa | BR |
|---|---|---|---|
| `inventory.aging_days` | 90 | Ngưỡng "tồn lâu" | BR-INV-04 |
| `purchase.require_seller_id` | true | Bắt buộc giấy tờ người bán khi thu mua/thu cũ | BR-PUR-09 |
| `unit.require_photo_on_buyback` | true | Bắt buộc ảnh máy khi thu mua | BR-PUR-09 |
| `purchase.default_cost_allocation` | `by_value` | Cách phân bổ chi phí mặc định (`by_value`/`equal`) | BR-PUR-05 |
| `unit.search_min_chars` | 2 | Số ký tự tối thiểu để tìm | — |

## 6. Sửa chữa

| Khóa | Mặc định | Ý nghĩa | BR |
|---|---|---|---|
| `repair.require_quote_approval` | **false** | Bắt buộc ghi nhận khách đồng ý báo giá trước khi sửa | BR-REP-04 |
| `repair.require_intake_photo` | **false** | Bắt buộc ảnh hiện trạng khi nhận (ảnh tùy chọn — CF-04) | BR-REP-02 |
| `repair.pickup_alert_days` | 14 | Nhắc máy hoàn thành chưa lấy | BR-REP-12 |
| `repair.allow_delivery_with_debt` | true | Cho phép giao máy ghi nợ (cần quyền) | BR-REP-07 |

## 7. Bảo mật & phiên

| Khóa | Mặc định | Ý nghĩa | BR |
|---|---|---|---|
| `security.access_token_ttl_seconds` | 900 | Thời hạn access token | BR-SEC-04 |
| `security.refresh_token_ttl_days` | 30 | Thời hạn refresh token | BR-SEC-04 |
| `security.max_failed_logins` | 5 | Số lần sai trước khi khóa tạm | BR-SEC-04 |
| `security.lockout_minutes` | 15 | Thời gian khóa tạm | BR-SEC-04 |
| `security.mfa_required_roles` | `["owner"]` | Vai trò bắt buộc TOTP | BR-SEC-04 |
| `security.password_min_length` | 10 | Độ dài tối thiểu | BR-SEC-04 |
| `security.pii_reveal_requires_reason` | true | Xem CCCD đầy đủ phải nêu lý do | BR-SEC-03 |

## 8. Hệ thống

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `backup.heartbeat_max_hours` | 36 | Quá ngưỡng ⇒ cảnh báo (BR-BAK-02) |
| `ui.disabled_modules` | `[]` | Danh sách module ẩn/bảo trì (cờ tính năng) |
| `feature.ai.enabled` | false | Công tắc tổng AI (ngoài đường găng) |
| `notifications.enabled_types` | (tất cả) | Loại thông báo trong ứng dụng đang bật |

## 9. Đã bỏ khỏi danh mục (hoãn — xem archive)
`sales.return_window_days`, `sales.return_window_days_used` (đổi trả), `commission.pay_when` (hoa hồng), `repair.internal_labor_costing` (không tiền công), `finance.allow_negative_cash`, `finance.books_start_date`, `finance.debt_alert_days` (quỹ/kỳ/công nợ).

## 10. Cách đọc cấu hình trong code

- Máy chủ: `getSetting<T>(key)` (cache ngắn 30 giây theo instance, vô hiệu khi sửa) — có sẵn kiểu qua `SettingsCatalog`.
- Hàm DB: `app.setting(key, default)` (STABLE) dùng trong `fn_*`.
- Không bao giờ đọc cấu hình thẳng ở client để **quyết định nghiệp vụ**; client chỉ dùng để hiển thị gợi ý (máy chủ/DB luôn kiểm lại).
