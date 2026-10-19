import { z } from "zod";

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
export const REPAIR_STATUS_LABELS: Record<string, string> = {
  received: "Đã nhận", inspecting: "Đang kiểm tra", repairing: "Đang sửa", waiting_parts: "Chờ linh kiện", completed: "Sửa xong", delivered: "Đã giao", cancelled: "Đã hủy",
};

// Nhận máy sửa (CF-16): khách (bắt buộc có SĐT) + máy + lỗi + hẹn trả. Đã bỏ: sửa nội bộ, cọc, linh kiện, duyệt báo giá.
export const CreateRepairBody = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    customer: z.object({ fullName: z.string().trim().min(1, "Nhập họ tên khách").max(120), phone: z.string().trim().min(8, "Nhập số điện thoại khách").max(20) }).optional(),
    customerWatchId: z.string().uuid().nullable().optional(),
    brandText: z.string().trim().max(80).nullable().optional(),
    modelText: z.string().trim().max(120).nullable().optional(),
    serialNo: z.string().trim().max(60).nullable().optional(),
    intakeCondition: z.string().trim().max(1000).nullable().optional(),
    complaint: z.string().trim().min(1, "Ghi lỗi hoặc yêu cầu của khách").max(1000),
    expectedDate: isoDate.nullable().optional(),
    /** Sửa miễn phí theo bảo hành còn hạn của khách */
    warrantyId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => !!b.customerId || !!b.customer, { message: "Cần chọn hoặc nhập khách hàng", path: ["customer"] });
export const RepairInfoBody = z.object({
  intakeCondition: z.string().trim().max(1000).nullable().optional(),
  complaint: z.string().trim().max(1000).nullable().optional(),
  findings: z.string().trim().max(2000).nullable().optional(),
  expectedDate: isoDate.nullable().optional(),
});
export const RepairLineBody = z.object({
  lineType: z.enum(["service", "other"]),
  serviceTypeId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  unitPrice: money.nullable().optional(),
});
export const RepairStatusBody = z.object({ to: z.enum(["inspecting", "repairing", "waiting_parts"]), reason: z.string().trim().max(500).optional() });
export const CompleteBody = z.object({ findings: z.string().trim().max(2000).nullable().optional() });
export const CancelRepairBody = z.object({ reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500) });
export const RepairListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
});
