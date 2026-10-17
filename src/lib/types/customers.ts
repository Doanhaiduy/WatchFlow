import { z } from "zod";

const phone = z.string().trim().max(20).regex(/^[0-9+().\s-]*$/, "Số điện thoại không hợp lệ");
export const CustomerBody = z.object({
  fullName: z.string().trim().min(1, "Nhập tên khách").max(120),
  phone: phone.optional().nullable(),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ").max(200).optional().nullable().or(z.literal("").transform(() => null)),
  address: z.string().trim().max(300).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  idNumber: z.string().trim().regex(/^[0-9A-Za-z]{6,20}$/, "Số giấy tờ 6–20 chữ/số").optional().nullable().or(z.literal("").transform(() => null)),
  /** Bỏ qua cảnh báo trùng SĐT */
  force: z.boolean().optional(),
});
export const CustomerListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  groupId: z.string().uuid().optional(),
  idNumber: z.string().trim().max(20).optional(),
  active: z.enum(["1", "0"]).optional(),
});
export const RevealBody = z.object({ reason: z.string().trim().max(500).default("") });
export const AnonymizeBody = z.object({ reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500) });
export const CustomerWatchBody = z.object({
  brandText: z.string().trim().max(80).optional().nullable(),
  modelText: z.string().trim().max(120).optional().nullable(),
  serialNo: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});
export const GroupBody = z.object({ name: z.string().trim().min(1).max(60), note: z.string().trim().max(300).optional().nullable(), isActive: z.boolean().optional() });
