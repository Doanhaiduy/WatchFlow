import { z } from "zod";

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");

/** Ghi đơn bán (FR-SALE-20): chiếc + giá, khách, ngày, ghi chú. Khách: chọn sẵn (customerId) hoặc nhập mới (customer). */
export const RecordSaleBody = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    customer: z.object({ fullName: z.string().trim().min(1, "Nhập họ tên khách").max(120), phone: z.string().trim().max(20).nullable().optional() }).optional(),
    docDate: isoDate.optional(),
    backdateReason: z.string().trim().max(500).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    lines: z
      .array(
        z.object({
          unitId: z.string().uuid(),
          price: money,
          /** Hạn bảo hành (tháng); bỏ trống = mặc định theo tình trạng (mới 12, cũ 3); 0 = không bảo hành */
          warrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
        }),
      )
      .min(1, "Chọn ít nhất một chiếc")
      .max(20),
  })
  .refine((b) => !!b.customerId || !!b.customer, { message: "Cần chọn hoặc nhập khách hàng", path: ["customer"] });

export const SaleListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["confirmed", "voided"]).optional(),
  customerId: z.string().uuid().optional(),
  channel: z.enum(["shop", "collab"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
