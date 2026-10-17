import { z } from "zod";
import { PaymentLine } from "./payments";

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");

export const SaleLineInput = z.discriminatedUnion("lineType", [
  z.object({ lineType: z.literal("watch"), unitId: z.string().uuid(), unitPrice: money, note: z.string().max(300).nullable().optional() }),
  z.object({ lineType: z.literal("part"), partId: z.string().uuid(), qty: z.number().int().positive().max(10000), unitPrice: money, note: z.string().max(300).nullable().optional() }),
]);
export const TradeInInput = z.object({
  credit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  modelId: z.string().uuid(),
  serialNo: z.string().trim().max(60).nullable().optional(),
  hasSerial: z.boolean().default(true),
  condition: z.enum(["new", "used", "refurbished"]).default("used"),
  conditionGrade: z.string().regex(/^([ABC]|\d{1,3}%)$/).nullable().optional(),
  conditionNote: z.string().trim().max(500).nullable().optional(),
  initialStatus: z.enum(["in_stock", "inspecting"]).default("inspecting"),
  locationId: z.string().uuid(),
  listPrice: money.nullable().optional(),
  rebuyUnitId: z.string().uuid().nullable().optional(),
});
export const SaleBody = z.object({
  customerId: z.string().uuid().nullable().optional(),
  docDate: isoDate.optional(),
  backdateReason: z.string().trim().max(500).nullable().optional(),
  reservationId: z.string().uuid().nullable().optional(),
  orderDiscount: money.default(0),
  dueDate: isoDate.nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(SaleLineInput).max(100),
  tradeIns: z.array(TradeInInput).max(3).default([]),
});
export const ConfirmSaleBody = z.object({
  payments: z.array(PaymentLine.pick({ method: true, amount: true })).max(5).default([]),
  cashTendered: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
});
export const SaleListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "confirmed", "voided"]).optional(),
  due: z.enum(["true"]).optional(),
  customerId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  mine: z.enum(["1"]).optional(),
});
export const ReservationBody = z.object({
  unitId: z.string().uuid(),
  customerId: z.string().uuid(),
  holdUntil: isoDate.nullable().optional(),
  method: z.enum(["cash", "bank_transfer"]),
  deposit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  cashTendered: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export const CancelReservationBody = z.object({
  mode: z.enum(["refund", "forfeit"]),
  method: z.enum(["cash", "bank_transfer"]).default("cash"),
  reason: z.string().trim().max(500).optional(),
});
export const WarrantyQuery = z.object({
  q: z.string().trim().max(100).optional(),
  expiring: z.enum(["1"]).optional(),
  status: z.enum(["active", "expired", "voided"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
