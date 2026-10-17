// Danh mục cài đặt (docs/02-domain/settings-catalog.md) — khớp seed 0003_platform.sql. Test kiểm hai bên khớp.
import { z } from "zod";

const int = (min = 0, max = 100000) => z.number().int().min(min).max(max);

export const SETTINGS = {
  "store.name": { group: "Cửa hàng", label: "Tên cửa hàng", schema: z.string().min(1).max(120) },
  "store.address": { group: "Cửa hàng", label: "Địa chỉ", schema: z.string().max(300) },
  "store.phone": { group: "Cửa hàng", label: "Điện thoại", schema: z.string().max(30) },
  "store.tax_code": { group: "Cửa hàng", label: "Mã số thuế", schema: z.string().max(30) },
  "store.logo_file_id": { group: "Cửa hàng", label: "Logo", schema: z.string().uuid().nullable() },
  "store.receipt_footer": { group: "Cửa hàng", label: "Chân phiếu bán", schema: z.string().max(500) },
  "store.warranty_terms": { group: "Cửa hàng", label: "Điều khoản bảo hành", schema: z.string().max(3000) },
  "store.repair_terms": { group: "Cửa hàng", label: "Điều khoản nhận sửa", schema: z.string().max(3000) },
  "sales.void_window_hours": { group: "Bán hàng", label: "Cửa sổ hủy phiếu bán (giờ)", schema: int(0, 720) },
  "sales.allow_walkin_debt": { group: "Bán hàng", label: "Cho nợ với khách vãng lai", schema: z.boolean() },
  "sales.default_due_days": { group: "Bán hàng", label: "Hạn hẹn trả mặc định (ngày)", schema: int(0, 365) },
  "reservation.hold_days": { group: "Bán hàng", label: "Hạn giữ hàng mặc định (ngày)", schema: int(1, 365) },
  "reservation.min_deposit_pct": { group: "Bán hàng", label: "Cọc tối thiểu (%)", schema: int(0, 100) },
  "reservation.max_hold_days": { group: "Bán hàng", label: "Trần hạn giữ (ngày)", schema: int(1, 365) },
  "doc.max_backdate_days": { group: "Bán hàng", label: "Ghi lùi ngày chứng từ tối đa (ngày)", schema: int(0, 365) },
  "warranty.shop_months.new": { group: "Bảo hành", label: "Hàng mới (tháng)", schema: int(0, 120) },
  "warranty.shop_months.used": { group: "Bảo hành", label: "Hàng cũ (tháng)", schema: int(0, 120) },
  "warranty.shop_months.refurbished": { group: "Bảo hành", label: "Hàng đã sửa/làm mới (tháng)", schema: int(0, 120) },
  "warranty.repair_days": { group: "Bảo hành", label: "Sau sửa chữa (ngày)", schema: int(0, 3650) },
  "warranty.expiry_alert_days": { group: "Bảo hành", label: "Nhắc trước khi hết hạn (ngày)", schema: int(0, 365) },
  "collab.hold_alert_days": { group: "Cộng tác viên", label: "Cảnh báo chiếc ở CTV quá (ngày)", schema: int(1, 365) },
  "collab.warn_below_cost": { group: "Cộng tác viên", label: "Cảnh báo giá thu dưới giá vốn", schema: z.boolean() },
  "inventory.aging_days": { group: "Kho & nhập hàng", label: "Ngưỡng tồn lâu (ngày)", schema: int(1, 3650) },
  "purchase.require_seller_id": { group: "Kho & nhập hàng", label: "Bắt buộc giấy tờ người bán", schema: z.boolean() },
  "unit.require_photo_on_buyback": { group: "Kho & nhập hàng", label: "Bắt buộc ảnh máy khi thu mua", schema: z.boolean() },
  "purchase.default_cost_allocation": { group: "Kho & nhập hàng", label: "Phân bổ chi phí mặc định", schema: z.enum(["by_value", "equal"]) },
  "unit.search_min_chars": { group: "Kho & nhập hàng", label: "Số ký tự tối thiểu để tìm", schema: int(1, 10) },
  "repair.require_quote_approval": { group: "Sửa chữa", label: "Bắt buộc khách đồng ý báo giá", schema: z.boolean() },
  "repair.require_intake_photo": { group: "Sửa chữa", label: "Bắt buộc ảnh khi nhận máy", schema: z.boolean() },
  "repair.pickup_alert_days": { group: "Sửa chữa", label: "Nhắc máy chưa lấy (ngày)", schema: int(1, 365) },
  "repair.allow_delivery_with_debt": { group: "Sửa chữa", label: "Cho giao máy ghi nợ", schema: z.boolean() },
  "payment.bank_bin": { group: "Thanh toán", label: "Ngân hàng nhận tiền (VietQR)", schema: z.string().regex(/^(\d{6})?$/) },
  "payment.account_no": { group: "Thanh toán", label: "Số tài khoản nhận tiền", schema: z.string().regex(/^([0-9A-Za-z]{4,19})?$/) },
  "payment.account_name": { group: "Thanh toán", label: "Tên chủ tài khoản", schema: z.string().max(80) },
  "payment.transfer_template": { group: "Thanh toán", label: "Mẫu nội dung chuyển khoản ({code} = mã phiếu)", schema: z.string().max(40) },
  "security.access_token_ttl_seconds": { group: "Bảo mật", label: "Thời hạn access token (giây)", schema: int(60, 3600) },
  "security.refresh_token_ttl_days": { group: "Bảo mật", label: "Thời hạn đăng nhập (ngày)", schema: int(1, 90) },
  "security.max_failed_logins": { group: "Bảo mật", label: "Số lần sai trước khi khóa", schema: int(3, 20) },
  "security.lockout_minutes": { group: "Bảo mật", label: "Thời gian khóa tạm (phút)", schema: int(1, 1440) },
  "security.mfa_required_roles": { group: "Bảo mật", label: "Vai trò bắt buộc xác thực 2 bước", schema: z.array(z.string()) },
  "security.password_min_length": { group: "Bảo mật", label: "Độ dài mật khẩu tối thiểu", schema: int(8, 128) },
  "security.trusted_device_days": { group: "Bảo mật", label: "Tin cậy thiết bị ở bước 2FA (ngày, 0 = tắt)", schema: int(0, 90) },
  "activity.retention_days": { group: "Bảo mật", label: "Giữ nhật ký hoạt động (ngày, tối thiểu 30)", schema: int(30, 3650) },
  "security.pii_reveal_requires_reason": { group: "Bảo mật", label: "Xem CCCD phải nêu lý do", schema: z.boolean() },
  "backup.heartbeat_max_hours": { group: "Hệ thống", label: "Cảnh báo sao lưu cũ hơn (giờ)", schema: int(1, 720) },
  "storage.purge_after_days": { group: "Hệ thống", label: "Giữ ảnh đã xóa trước khi xóa thật (ngày)", schema: int(0, 365) },
  "storage.quota_mb": { group: "Hệ thống", label: "Hạn mức kho lưu trữ (MB)", schema: int(1, 10000000) },
  "storage.warn_percent": { group: "Hệ thống", label: "Cảnh báo kho lưu trữ từ (% hạn mức)", schema: int(1, 100) },
  "storage.critical_percent": { group: "Hệ thống", label: "Khẩn kho lưu trữ từ (% hạn mức)", schema: int(1, 100) },
  "ui.disabled_modules": { group: "Hệ thống", label: "Module tạm ẩn", schema: z.array(z.string()) },
  "feature.ai.enabled": { group: "Hệ thống", label: "Bật AI", schema: z.boolean() },
  "notifications.enabled_types": { group: "Hệ thống", label: "Loại thông báo đang bật", schema: z.array(z.string()) },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
export function isSettingKey(k: string): k is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, k);
}
