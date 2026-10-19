// Danh mục quyền — PHẢI khớp bảng permissions (seed 0002_iam.sql). Test tests/api kiểm hai bên khớp.
// Kiểm theo permission, không theo tên vai trò (BR-SEC-01).
export const PERMISSIONS = {
  "user.manage": { module: "iam", label: "Quản lý người dùng", sensitive: true },
  "role.manage": { module: "iam", label: "Quản lý vai trò & quyền", sensitive: true },
  "settings.view": { module: "platform", label: "Xem cài đặt", sensitive: false },
  "settings.manage": { module: "platform", label: "Sửa cài đặt", sensitive: true },
  "audit.view": { module: "platform", label: "Xem nhật ký hoạt động", sensitive: true },
  "system.health": { module: "platform", label: "Xem tình trạng hệ thống", sensitive: false },
  "system.backup": { module: "platform", label: "Xem trạng thái sao lưu", sensitive: false },
  "doc.backdate": { module: "platform", label: "Ghi lùi ngày chứng từ quá hạn mức", sensitive: true },
  "catalog.view": { module: "catalog", label: "Xem đồng hồ", sensitive: false },
  "catalog.manage": { module: "catalog", label: "Quản lý danh mục & chiếc", sensitive: false },
  "unit.price.edit": { module: "catalog", label: "Sửa giá bán", sensitive: false },
  "unit.release": { module: "catalog", label: "Chuyển chờ kiểm tra → sẵn sàng bán", sensitive: false },
  "location.manage": { module: "catalog", label: "Quản lý vị trí kho", sensitive: false },
  "part.view": { module: "parts", label: "Xem linh kiện", sensitive: false },
  "part.manage": { module: "parts", label: "Quản lý linh kiện", sensitive: false },
  "part.stock.adjust": { module: "parts", label: "Điều chỉnh tồn linh kiện", sensitive: false },
  "customer.view": { module: "partners", label: "Xem mọi khách hàng", sensitive: false },
  "customer.view_own": { module: "partners", label: "Xem khách do mình tạo", sensitive: false },
  "customer.create": { module: "partners", label: "Tạo khách hàng", sensitive: false },
  "customer.manage": { module: "partners", label: "Sửa khách hàng", sensitive: false },
  "customer.pii.view": { module: "partners", label: "Xem CCCD đầy đủ", sensitive: true },
  "cost.view": { module: "cost", label: "Xem giá vốn (giá thu của cửa hàng)", sensitive: true },
  "cost.adjust": { module: "cost", label: "Điều chỉnh giá vốn", sensitive: true },
  "profit.view": { module: "cost", label: "Xem lợi nhuận", sensitive: true },
  "debt.view": { module: "cost", label: "Xem phiếu còn nợ", sensitive: false },
  "purchase.view": { module: "purchasing", label: "Xem phiếu nhập", sensitive: false },
  "purchase.create": { module: "purchasing", label: "Lập phiếu nhập nháp", sensitive: false },
  "purchase.confirm": { module: "purchasing", label: "Xác nhận phiếu nhập", sensitive: false },
  "purchase.void": { module: "purchasing", label: "Hủy phiếu nhập", sensitive: true },
  "sale.view": { module: "sales", label: "Xem đơn bán", sensitive: false },
  "sale.view_own": { module: "sales", label: "Xem phiếu bán của mình", sensitive: false },
  "sale.create_draft": { module: "sales", label: "Lập phiếu bán nháp", sensitive: false },
  "sale.confirm": { module: "sales", label: "Ghi đơn bán & xác nhận CTV báo bán", sensitive: false },
  "sale.below_cost": { module: "sales", label: "Bán dưới giá vốn", sensitive: true },
  "sale.void": { module: "sales", label: "Hủy đơn bán", sensitive: true },
  "reservation.manage": { module: "sales", label: "Giữ hàng / hoàn cọc", sensitive: false },
  "reservation.forfeit": { module: "sales", label: "Tịch thu cọc", sensitive: true },
  "warranty.view": { module: "sales", label: "Xem hạn bảo hành", sensitive: false },
  "payment.create": { module: "payments", label: "Ghi thanh toán", sensitive: false },
  "payment.void": { module: "payments", label: "Hủy thanh toán", sensitive: true },
  "collab.view": { module: "collaborators", label: "Xem cộng tác viên & thống kê", sensitive: true },
  "collab.manage": { module: "collaborators", label: "Giao đồng hồ cho cộng tác viên", sensitive: true },
  "collab.view_own": { module: "collaborators", label: "CTV: xem hàng được giao & báo đã bán", sensitive: false },
  "repair.view": { module: "repairs", label: "Xem phiếu sửa", sensitive: false },
  "repair.create": { module: "repairs", label: "Nhận máy sửa", sensitive: false },
  "repair.update": { module: "repairs", label: "Cập nhật phiếu sửa", sensitive: false },
  "repair.price.edit": { module: "repairs", label: "Sửa giá dòng sửa chữa", sensitive: false },
  "repair.deliver": { module: "repairs", label: "Giao máy sửa", sensitive: false },
  "stocktake.manage": { module: "inventory", label: "Kiểm kê", sensitive: false },
  "stock.writeoff": { module: "inventory", label: "Thanh lý / ghi mất chiếc", sensitive: true },
  "report.sales": { module: "reports", label: "Báo cáo bán hàng", sensitive: false },
  "report.inventory": { module: "reports", label: "Báo cáo kho", sensitive: false },
  "report.export": { module: "reports", label: "Xuất file báo cáo", sensitive: false },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_CODES = Object.keys(PERMISSIONS) as Permission[];

export const MODULE_LABELS: Record<string, string> = {
  iam: "Tài khoản & quyền", platform: "Hệ thống", catalog: "Đồng hồ", partners: "Khách hàng",
  purchasing: "Thêm đồng hồ", sales: "Bán hàng", collaborators: "Cộng tác viên",
  repairs: "Sửa chữa", inventory: "Kho", reports: "Báo cáo",
};

/**
 * Quyền của tính năng đã bỏ ở bản gọn (CF-10…CF-14): vẫn nằm trong DB (hàm cũ còn dùng) nhưng KHÔNG hiện ở Quản trị → Vai trò & quyền.
 * Không dùng để kiểm quyền ở giao diện/API mới.
 */
export const RETIRED_PERMISSIONS: ReadonlySet<string> = new Set([
  "part.view", "part.manage", "part.stock.adjust", "customer.pii.view", "cost.view", "cost.adjust", "profit.view", "debt.view",
  "purchase.view", "purchase.void", "sale.view_own", "sale.create_draft", "sale.below_cost", "reservation.manage", "reservation.forfeit",
  "payment.create", "payment.void", "stocktake.manage",
]);

export function isPermission(x: string): x is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, x);
}

/** Có quyền trong danh sách quyền của phiên */
export function can(perms: readonly string[] | undefined, p: Permission | Permission[]): boolean {
  if (!perms) return false;
  return Array.isArray(p) ? p.some((x) => perms.includes(x)) : perms.includes(p);
}
