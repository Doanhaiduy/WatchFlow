import { z } from "zod";

const money = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
const reason = z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500);

export const ProfileBody = z.object({
  phone: z.string().trim().max(20).nullable().optional(),
  area: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
/** Chủ giao các chiếc cho một hay nhiều CTV (chiếc vẫn ở kho; CTV nào báo đã bán trước được giữ) */
export const OfferBody = z.object({
  unitIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất một chiếc").max(100),
  collaboratorIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất một cộng tác viên").max(50),
  note: z.string().trim().max(500).nullable().optional(),
});
export const WithdrawBody = z.object({ unitId: z.string().uuid(), collaboratorId: z.string().uuid().nullable().optional() });
export const OfferListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  collaboratorId: z.string().uuid().optional(),
  pendingOnly: z.enum(["1"]).optional(),
});
/** CTV báo đã bán: tên + SĐT khách (bắt buộc), ghi chú. KHÔNG nhập giá. */
export const ClaimBody = z.object({
  unitId: z.string().uuid(),
  customerName: z.string().trim().min(1, "Nhập họ tên khách").max(120),
  customerPhone: z.string().trim().min(8, "Nhập số điện thoại khách").max(20),
  note: z.string().trim().max(500).nullable().optional(),
});
/** Chủ xác nhận: giá mặc định = giá niêm yết, sửa được */
export const ConfirmClaimBody = z.object({
  price: money.optional(),
  docDate: isoDate.optional(),
  warrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
  backdateReason: z.string().trim().max(500).nullable().optional(),
});
export const RejectClaimBody = z.object({ reason });
export const ClaimListQuery = z.object({
  status: z.enum(["pending", "decided", "all"]).default("pending"),
  collaboratorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export const StatsQuery = z.object({
  period: z.enum(["day", "month", "quarter", "year"]).default("month"),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
