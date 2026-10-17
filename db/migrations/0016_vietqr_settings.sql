-- 0016 — VietQR khi thu bằng chuyển khoản: cài đặt tài khoản nhận tiền của cửa hàng.
-- Chỉ thêm 4 dòng cài đặt (bảng settings đã có RLS/grant/audit từ 0003; sửa qua app.fn_set_setting, cần quyền settings.manage).
-- Mã QR được vẽ ngay trên trình duyệt từ các giá trị này — KHÔNG gọi dịch vụ ngoài và KHÔNG tự ghi nhận tiền (BR-PAY-02):
-- người thu chỉ bấm "Xác nhận" sau khi thấy tiền vào tài khoản. Chưa cấu hình ⇒ giao diện không hiện QR.
--   payment.bank_bin          mã BIN 6 số của ngân hàng (NAPAS) — chọn từ danh sách trong Quản trị → Cài đặt
--   payment.account_no        số tài khoản nhận (4–19 ký tự chữ-số)
--   payment.account_name      tên chủ tài khoản (hiển thị cạnh QR)
--   payment.transfer_template mẫu nội dung chuyển khoản; "{code}" = mã phiếu (mặc định chỉ mã phiếu)
-- Áp lại nhiều lần không lỗi và không ghi đè giá trị đã chỉnh.
BEGIN;

INSERT INTO public.settings (key, value, description) VALUES
  ('payment.bank_bin', '""', 'Mã BIN (6 số) ngân hàng nhận tiền chuyển khoản — dùng tạo mã VietQR'),
  ('payment.account_no', '""', 'Số tài khoản nhận tiền chuyển khoản'),
  ('payment.account_name', '""', 'Tên chủ tài khoản nhận tiền chuyển khoản'),
  ('payment.transfer_template', '"{code}"', 'Mẫu nội dung chuyển khoản; {code} = mã phiếu')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

COMMIT;
