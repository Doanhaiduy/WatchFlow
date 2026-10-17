import { z } from "zod";

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
export const REPAIR_STATUS_LABELS: Record<string, string> = {
  received: "Đã nhận", inspecting: "Đang kiểm tra", repairing: "Đang sửa", waiting_parts: "Chờ linh kiện", completed: "Hoàn thành", delivered: "Đã giao", cancelled: "Đã hủy",
};

export const CreateRepairBody = z.object({
  kind: z.enum(["customer", "internal"]).default("customer"),
  customerId: z.string().uuid().nullable().optional(),
  customerWatchId: z.string().uuid().nullable().optional(),
  brandText: z.string().trim().max(80).nullable().optional(),
  modelText: z.string().trim().max(120).nullable().optional(),
  serialNo: z.string().trim().max(60).nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  intakeCondition: z.string().trim().max(1000).nullable().optional(),
  complaint: z.string().trim().max(1000).nullable().optional(),
  expectedDate: isoDate.nullable().optional(),
  deposit: z.object({ method: z.enum(["cash", "bank_transfer"]), amount: money }).nullable().optional(),
});
export const RepairInfoBody = z.object({
  intakeCondition: z.string().trim().max(1000).nullable().optional(),
  complaint: z.string().trim().max(1000).nullable().optional(),
  findings: z.string().trim().max(2000).nullable().optional(),
  expectedDate: isoDate.nullable().optional(),
});
export const RepairLineBody = z.object({
  lineType: z.enum(["service", "part", "other"]),
  serviceTypeId: z.string().uuid().nullable().optional(),
  partId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  qty: z.number().int().positive().max(1000).default(1),
  unitPrice: money.nullable().optional(),
});
export const RepairStatusBody = z.object({ to: z.enum(["inspecting", "repairing", "waiting_parts"]), reason: z.string().trim().max(500).optional() });
export const CompleteBody = z.object({
  unitStatus: z.enum(["in_stock", "inspecting"]).default("in_stock"),
  condition: z.enum(["new", "used", "refurbished"]).nullable().optional(),
  grade: z.string().regex(/^([ABC]|\d{1,3}%)$/).nullable().optional(),
  findings: z.string().trim().max(2000).nullable().optional(),
});
export const DeliverBody = z.object({
  payments: z.array(z.object({ method: z.enum(["cash", "bank_transfer"]), amount: z.number().int().positive() })).max(5).default([]),
  dueDate: isoDate.nullable().optional(),
});
export const CancelRepairBody = z.object({ reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500), refundMethod: z.enum(["cash", "bank_transfer"]).default("cash") });
export const OpenWarrantyRepairBody = z.object({ complaint: z.string().trim().min(1).max(1000), intakeCondition: z.string().trim().max(1000).nullable().optional() });
export const RepairListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  status: z.string().optional(),
  kind: z.enum(["customer", "internal"]).optional(),
  q: z.string().trim().max(100).optional(),
});
