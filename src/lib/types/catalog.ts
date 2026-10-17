// Hợp đồng dữ liệu module catalog/parts (dùng chung form + API)
import { z } from "zod";

export const UNIT_STATUSES = ["in_stock", "reserved", "with_collaborator", "sold", "in_repair", "inspecting", "written_off", "cancelled"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export const CONDITIONS = ["new", "used", "refurbished"] as const;
export const CONDITION_LABELS: Record<(typeof CONDITIONS)[number], string> = { new: "Mới", used: "Cũ", refurbished: "Đã sửa/làm mới" };
export const MOVEMENT_TYPES = ["automatic", "manual", "quartz", "solar", "smart", "other"] as const;
export const MOVEMENT_LABELS: Record<(typeof MOVEMENT_TYPES)[number], string> = {
  automatic: "Cơ tự động", manual: "Cơ lên dây tay", quartz: "Pin (quartz)", solar: "Năng lượng mặt trời", smart: "Thông minh", other: "Khác",
};
export const LOCATION_KINDS = ["safe", "cabinet", "display", "workshop", "other"] as const;
export const LOCATION_LABELS: Record<(typeof LOCATION_KINDS)[number], string> = { safe: "Két", cabinet: "Tủ", display: "Trưng bày", workshop: "Xưởng", other: "Khác" };
export const ACCESSORY_KINDS = ["box", "papers", "warranty_card", "extra_strap", "tool", "other"] as const;
export const ACCESSORY_LABELS: Record<(typeof ACCESSORY_KINDS)[number], string> = {
  box: "Hộp", papers: "Giấy tờ", warranty_card: "Thẻ bảo hành", extra_strap: "Dây phụ", tool: "Dụng cụ", other: "Khác",
};

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ");
const reason = z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500);

export const UnitListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(), // danh sách phân tách dấu phẩy; "stock" = tồn kho (BR-UNIT-04)
  brandId: z.string().uuid().optional(),
  modelId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  condition: z.enum(CONDITIONS).optional(),
  aging: z.enum(["1"]).optional(),
  sort: z.enum(["-created_at", "price", "-price", "asset_code", "-stock_since", "stock_since"]).default("-created_at"),
});

export const BrandBody = z.object({ name: z.string().trim().min(1).max(80), country: z.string().trim().max(60).optional(), isActive: z.boolean().optional() });
export const ModelBody = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,40}$/, "Mã chỉ gồm chữ, số và . _ / -"),
  brandId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  referenceNo: z.string().trim().max(60).optional().nullable(),
  caliber: z.string().trim().max(60).optional().nullable(),
  movementType: z.enum(MOVEMENT_TYPES).optional().nullable(),
  caseSizeMm: z.number().positive().max(99).optional().nullable(),
  caseMaterial: z.string().trim().max(60).optional().nullable(),
  strapType: z.string().trim().max(60).optional().nullable(),
  dialColor: z.string().trim().max(40).optional().nullable(),
  glassType: z.string().trim().max(40).optional().nullable(),
  waterResistanceM: z.number().int().min(0).max(20000).optional().nullable(),
  gender: z.enum(["male", "female", "unisex"]).optional().nullable(),
  originCountry: z.string().trim().max(60).optional().nullable(),
  description: z.string().trim().max(3000).optional().nullable(),
  isActive: z.boolean().optional(),
});
export const LocationBody = z.object({ name: z.string().trim().min(1).max(80), kind: z.enum(LOCATION_KINDS), note: z.string().trim().max(300).optional().nullable(), isActive: z.boolean().optional() });

export const UnitInfoBody = z.object({
  condition: z.enum(CONDITIONS).optional(),
  conditionGrade: z.string().regex(/^([ABC]|\d{1,3}%)$/, "Hạng A/B/C hoặc % mới (vd. 95%)").nullable().optional(),
  conditionNote: z.string().trim().max(2000).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  manufacturerWarrantyUntil: isoDate.nullable().optional(),
  accessories: z.array(z.object({ kind: z.enum(ACCESSORY_KINDS), present: z.boolean(), note: z.string().trim().max(200).optional().nullable() })).max(20).optional(),
});
export const PriceBody = z.object({
  listPrice: money,
  promoPrice: money.nullable().optional(),
  promoFrom: isoDate.nullable().optional(),
  promoTo: isoDate.nullable().optional(),
  reason: z.string().trim().max(500).optional(),
  version: z.number().int().optional(),
});
export const MoveBody = z.object({ locationId: z.string().uuid(), note: z.string().trim().max(300).optional() });
export const ReleaseBody = z.object({ note: z.string().trim().max(500).optional() });
export const WriteoffBody = z.object({ reason });
export const RestoreBody = z.object({ locationId: z.string().uuid(), reason });
export const IdentityBody = z.object({
  modelId: z.string().uuid(),
  serialNo: z.string().trim().max(60).nullable().optional(),
  hasSerial: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  version: z.number().int().optional(),
});

export const PartListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  low: z.enum(["1"]).optional(),
});
export const PartBody = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,40}$/, "Mã chỉ gồm chữ, số và . _ / -"),
  name: z.string().trim().min(1).max(160),
  categoryId: z.string().uuid(),
  uom: z.string().trim().min(1).max(20).default("cái"),
  specs: z.string().trim().max(1000).nullable().optional(),
  salePrice: money.default(0),
  reorderLevel: z.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().optional(),
  compatibility: z.array(z.object({ brandId: z.string().uuid(), modelId: z.string().uuid().nullable().optional(), note: z.string().max(200).optional().nullable() })).max(50).optional(),
});
export const PartAdjustBody = z.object({ delta: z.number().int().refine((x) => x !== 0, "Số lượng khác 0"), reason });
export const CategoryBody = z.object({ name: z.string().trim().min(1).max(60), isActive: z.boolean().optional() });
