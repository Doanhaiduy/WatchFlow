// Hợp đồng dữ liệu auth (dùng chung form + API)
import { z } from "zod";

export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ").max(200),
  password: z.string().min(1, "Nhập mật khẩu").max(200),
});
export const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại").max(200),
  newPassword: z.string().min(1, "Nhập mật khẩu mới").max(200),
});
export const MfaVerifyBody = z.object({ code: z.string().trim().min(6, "Nhập mã 6 số").max(20), /** Tin cậy thiết bị này (bỏ bước mã 2FA ở lần đăng nhập sau) */ trustDevice: z.boolean().optional() });
export const ReauthBody = z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(20).optional() });
