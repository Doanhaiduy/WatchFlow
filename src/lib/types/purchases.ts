import { z } from "zod";

// Thêm đồng hồ vào kho (từng chiếc hoặc Nhập từ Excel) vẫn đi qua phiếu nhập 1 dòng — chỉ để lưu nguồn gốc; bản gọn (CF-14) không còn màn Nhập hàng.
export const PURCHASE_KINDS = ["purchase", "opening"] as const;
export const COST_KINDS = ["shipping", "inspection", "repair", "customs", "other"] as const;

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");

export const PurchaseLineInput = z.discriminatedUnion("lineType", [
  z.object({
    lineType: z.literal("watch"),
    modelId: z.string().uuid(),
    serialNo: z.string().trim().max(60).nullable().optional(),
    hasSerial: z.boolean().default(true),
    condition: z.enum(["new", "used", "refurbished"]),
    conditionGrade: z.string().regex(/^([ABC]|\d{1,3}%)$/).nullable().optional(),
    conditionNote: z.string().trim().max(1000).nullable().optional(),
    initialStatus: z.enum(["in_stock", "inspecting"]).default("in_stock"),
    locationId: z.string().uuid().nullable().optional(),
    listPrice: money.nullable().optional(),
    rebuyUnitId: z.string().uuid().nullable().optional(),
    unitPrice: money,
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    lineType: z.literal("part"),
    partId: z.string().uuid(),
    qty: z.number().int().positive().max(100000),
    unitPrice: money,
    note: z.string().trim().max(500).nullable().optional(),
  }),
]);
export const PurchaseCostInput = z.object({
  kind: z.enum(COST_KINDS),
  description: z.string().trim().max(200).nullable().optional(),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  allocateMethod: z.enum(["by_value", "equal"]).default("by_value"),
});
export const PurchaseBody = z.object({
  kind: z.enum(PURCHASE_KINDS),
  sourceName: z.string().trim().max(200).nullable().optional(),
  sellerCustomerId: z.string().uuid().nullable().optional(),
  docDate: isoDate.optional(),
  backdateReason: z.string().trim().max(500).nullable().optional(),
  paymentNote: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  lines: z.array(PurchaseLineInput).max(200),
  costs: z.array(PurchaseCostInput).max(20).default([]),
});
