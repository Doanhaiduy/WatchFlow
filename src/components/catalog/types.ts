// Kiểu dữ liệu phía client cho module catalog/linh kiện/khách (khớp DTO máy chủ). Trường `cost` chỉ có khi máy chủ trả (cost.view).
export type UnitDto = {
  id: string; assetCode: string; status: string; condition: string; conditionGrade: string | null; conditionNote?: string | null;
  serialNo: string | null; hasSerial: boolean;
  model: { id: string; code: string; name: string; referenceNo: string | null };
  brand: { id: string; name: string };
  location: { id: string; name: string } | null;
  heldBy: { id: string; name: string | null } | null;
  listPrice: number; promoPrice: number | null; promoFrom: string | null; promoTo: string | null; effectivePrice: number;
  stockSince: string | null; daysInStock: number | null; thumbUrl: string | null; version: number; cost?: number | null;
};
export type UnitList = { items: UnitDto[]; page: number; pageSize: number; total: number; counts: Record<string, number> };
export type UnitDetail = UnitDto & {
  specs: Record<string, string | number | null> | null;
  manufacturerWarrantyUntil: string | null; note: string | null; createdAt?: string;
  accessories: Array<{ id: string; kind: string; present: boolean; note: string | null }>;
  photos: Array<{ id: string; kind: string; url: string; thumbUrl: string; width: number | null; height: number | null }>;
};
export type Brand = { id: string; name: string; country: string | null; isActive: boolean; version: number; modelCount: number };
export type Model = {
  id: string; code: string; brandId: string; brandName: string; name: string; referenceNo: string | null; caliber: string | null; movementType: string | null;
  caseSizeMm: number | null; caseMaterial: string | null; strapType: string | null; dialColor: string | null; glassType: string | null;
  waterResistanceM: number | null; gender: string | null; originCountry: string | null; description: string | null; isActive: boolean; version: number; stockCount?: number;
};
export type Location = { id: string; name: string; kind: string; note: string | null; isActive: boolean; version: number; unitCount: number };
export type Part = {
  id: string; code: string; name: string; categoryId: string; categoryName: string; uom: string; specs: string | null; salePrice: number;
  reorderLevel: number; qtyOnHand: number; isActive: boolean; version: number; isLow?: boolean; avgCost?: string | null;
  compatibility?: Array<{ id: string; brandId: string; brandName: string; modelId: string | null; modelName: string | null; note: string | null }>;
};
export type PartCategory = { id: string; name: string; isActive: boolean; version: number; partCount: number };
export type Customer = {
  id: string; code: string; fullName: string; phone: string | null; email: string | null; address: string | null; groupId: string | null; groupName: string | null;
  note: string | null; idMasked: string | null; hasIdNumber: boolean; isActive: boolean; anonymizedAt: string | null; version: number; createdAt: string; createdByName: string | null;
  watches?: Array<{ id: string; brandText: string | null; modelText: string | null; serialNo: string | null; unitId: string | null; note: string | null; createdAt: string }>;
};
export type CustomerGroup = { id: string; name: string; note: string | null; isActive: boolean; customerCount: number };

/** Tên hiển thị: nếu tên loại đã bắt đầu bằng tên hãng thì không lặp lại hãng */
export const unitTitle = (u: Pick<UnitDto, "brand" | "model">) =>
  u.model.name.toLowerCase().startsWith(u.brand.name.toLowerCase()) ? u.model.name : `${u.brand.name} ${u.model.name}`;

/** Ghép tên hãng + loại, không lặp hãng nếu tên loại đã bắt đầu bằng tên hãng */
export const joinTitle = (brand?: string | null, model?: string | null) => {
  const b = (brand ?? "").trim(), m = (model ?? "").trim();
  return m.toLowerCase().startsWith(b.toLowerCase()) ? m : `${b} ${m}`.trim();
};
