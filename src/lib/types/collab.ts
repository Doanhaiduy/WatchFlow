import { z } from "zod";

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
const reason = z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500);

export const ProfileBody = z.object({
  phone: z.string().trim().max(20).nullable().optional(),
  area: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
export const AssignmentBody = z.object({
  docDate: isoDate.optional(),
  note: z.string().trim().max(500).nullable().optional(),
  lines: z.array(z.object({ unitId: z.string().uuid(), basePrice: money })).min(1).max(100),
});
export const ReturnBody = z.object({ unitId: z.string().uuid(), locationId: z.string().uuid(), reason });
export const SettleBody = z.object({
  lineIds: z.array(z.string().uuid()).min(1).max(500),
  method: z.enum(["cash", "bank_transfer"]),
  docDate: isoDate.optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export const ReasonBody = z.object({ reason });
export const CollabSaleBody = z.object({
  customerId: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
  lines: z.array(z.object({ unitId: z.string().uuid(), unitPrice: money })).min(1).max(20),
});
export const StatsQuery = z.object({
  period: z.enum(["month", "quarter", "year"]).default("month"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  collaborator: z.string().uuid().optional(),
});
