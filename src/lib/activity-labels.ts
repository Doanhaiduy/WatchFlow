// Nhãn tiếng Việt cho nhật ký hoạt động (Quản trị → Hoạt động). Khóa = "<PHƯƠNG THỨC> <route mẫu>", route là đường dẫn API với giá trị
// tham số thay bằng [tên] (vd. "POST /api/v1/sales/[id]/confirm"). Dùng chung cho máy chủ (gắn nhãn, lọc theo khu vực) và giao diện.
// Port từ mẫu Lưu Xá (activity-labels), đổi sang miền WatchFlow. Route mới chưa có nhãn vẫn hiển thị (nhãn dự phòng "<PT> <route>").

export const ACTIVITY_AREAS: Record<string, string> = {
  sales: "Bán hàng & giữ hàng",
  purchase: "Nhập hàng",
  unit: "Kho & đồng hồ",
  part: "Linh kiện",
  customer: "Khách hàng",
  repair: "Sửa chữa & bảo hành",
  collab: "Cộng tác viên",
  stocktake: "Kiểm kê",
  report: "Báo cáo & xuất file",
  admin: "Người dùng & cài đặt",
  auth: "Đăng nhập & bảo mật",
  other: "Khác",
};

const A = (area: string, entries: Record<string, string>): [string, string, string][] => Object.entries(entries).map(([k, label]) => [k, area, label]);

const RULES: [string, string, string][] = [
  ...A("sales", {
    "POST /api/v1/sales": "Tạo phiếu bán nháp",
    "PATCH /api/v1/sales/[id]": "Sửa phiếu bán nháp",
    "DELETE /api/v1/sales/[id]": "Xóa phiếu bán nháp",
    "POST /api/v1/sales/[id]/confirm": "Xác nhận phiếu bán",
    "POST /api/v1/sales/[id]/void": "Hủy phiếu bán",
    "POST /api/v1/sales/[id]/payments": "Ghi thanh toán phiếu bán",
    "POST /api/v1/sales/[id]/print": "In phiếu bán",
    "POST /api/v1/payments/[id]/void": "Hủy khoản thanh toán",
    "POST /api/v1/reservations": "Giữ hàng / nhận cọc",
    "POST /api/v1/reservations/[id]/cancel": "Hủy giữ hàng",
    "POST /api/v1/reservations/[id]/convert": "Chuyển giữ hàng thành phiếu bán",
    "GET /api/v1/documents/[type]/[id]/balance": "Xem công nợ chứng từ",
  }),
  ...A("purchase", {
    "POST /api/v1/purchases": "Tạo phiếu nhập nháp",
    "POST /api/v1/purchases/quick": "Nhập nhanh một chiếc",
    "PATCH /api/v1/purchases/[id]": "Sửa phiếu nhập nháp",
    "DELETE /api/v1/purchases/[id]": "Xóa phiếu nhập nháp",
    "POST /api/v1/purchases/[id]/confirm": "Xác nhận phiếu nhập",
    "POST /api/v1/purchases/[id]/void": "Hủy phiếu nhập",
    "GET /api/v1/purchases/export": "Xuất Excel phiếu nhập",
  }),
  ...A("unit", {
    "POST /api/v1/catalog/brands": "Thêm thương hiệu",
    "PATCH /api/v1/catalog/brands/[id]": "Sửa thương hiệu",
    "POST /api/v1/catalog/models": "Thêm mẫu đồng hồ",
    "PATCH /api/v1/catalog/models/[id]": "Sửa mẫu đồng hồ",
    "POST /api/v1/catalog/locations": "Thêm vị trí kho",
    "PATCH /api/v1/catalog/locations/[id]": "Sửa vị trí kho",
    "PATCH /api/v1/catalog/units/[id]": "Sửa thông tin chiếc đồng hồ",
    "POST /api/v1/catalog/units/[id]/price": "Đổi giá bán",
    "POST /api/v1/catalog/units/[id]/move": "Chuyển vị trí kho",
    "POST /api/v1/catalog/units/[id]/identity": "Sửa serial / nhận dạng",
    "POST /api/v1/catalog/units/[id]/cost-adjust": "Điều chỉnh giá vốn",
    "POST /api/v1/catalog/units/[id]/release": "Nhả giữ chiếc",
    "POST /api/v1/catalog/units/[id]/restore": "Khôi phục chiếc",
    "POST /api/v1/catalog/units/[id]/writeoff": "Xuất hủy / ghi mất chiếc",
    "GET /api/v1/catalog/units/[id]/cost": "Xem giá vốn chiếc",
    "GET /api/v1/catalog/units/[id]/label": "In tem chiếc",
    "POST /api/v1/files": "Tải tệp / ảnh lên",
  }),
  ...A("part", {
    "POST /api/v1/parts": "Thêm linh kiện",
    "PATCH /api/v1/parts/[id]": "Sửa linh kiện",
    "POST /api/v1/parts/[id]/adjust": "Điều chỉnh tồn linh kiện",
    "POST /api/v1/part-categories": "Thêm nhóm linh kiện",
    "PATCH /api/v1/part-categories/[id]": "Sửa nhóm linh kiện",
  }),
  ...A("customer", {
    "POST /api/v1/customers": "Thêm khách hàng",
    "PATCH /api/v1/customers/[id]": "Sửa khách hàng",
    "POST /api/v1/customers/[id]/reveal-id": "Xem CCCD đầy đủ của khách",
    "POST /api/v1/customers/[id]/anonymize": "Ẩn danh khách hàng",
    "POST /api/v1/customers/[id]/watches": "Ghi đồng hồ của khách",
    "POST /api/v1/customer-groups": "Thêm nhóm khách",
    "PATCH /api/v1/customer-groups/[id]": "Sửa nhóm khách",
  }),
  ...A("repair", {
    "POST /api/v1/repairs": "Nhận máy sửa chữa",
    "PATCH /api/v1/repairs/[id]": "Sửa phiếu sửa chữa",
    "POST /api/v1/repairs/[id]/approve-quote": "Khách duyệt báo giá sửa",
    "POST /api/v1/repairs/[id]/cancel": "Hủy phiếu sửa",
    "POST /api/v1/repairs/[id]/complete": "Hoàn thành sửa chữa",
    "POST /api/v1/repairs/[id]/deliver": "Giao máy sau sửa",
    "POST /api/v1/repairs/[id]/lines": "Thêm dòng báo giá sửa",
    "PATCH /api/v1/repairs/[id]/lines/[lineId]": "Sửa dòng báo giá sửa",
    "DELETE /api/v1/repairs/[id]/lines/[lineId]": "Xóa dòng báo giá sửa",
    "POST /api/v1/repairs/[id]/lines/[lineId]/consume": "Dùng linh kiện cho phiếu sửa",
    "POST /api/v1/repairs/[id]/lines/[lineId]/unconsume": "Hoàn linh kiện về kho",
    "POST /api/v1/repairs/[id]/payments": "Ghi thanh toán phiếu sửa",
    "POST /api/v1/repairs/[id]/status": "Đổi trạng thái phiếu sửa",
    "POST /api/v1/warranties/[id]/open-repair": "Mở phiếu sửa từ bảo hành",
    "POST /api/v1/service-types": "Thêm loại dịch vụ sửa",
  }),
  ...A("collab", {
    "PATCH /api/v1/collaborators/[id]": "Sửa cộng tác viên",
    "POST /api/v1/collaborators/[id]/assignments": "Giao hàng cho CTV",
    "POST /api/v1/collaborators/[id]/return": "Thu hồi hàng từ CTV",
    "POST /api/v1/collaborators/[id]/settlements": "Quyết toán với CTV",
    "POST /api/v1/assignments/[id]/void": "Hủy phiếu giao CTV",
    "POST /api/v1/settlements/[id]/void": "Hủy quyết toán CTV",
    "POST /api/v1/collab/me/sales": "CTV tạo đơn bán",
  }),
  ...A("stocktake", {
    "POST /api/v1/stocktakes": "Mở đợt kiểm kê",
    "POST /api/v1/stocktakes/[id]/lines": "Ghi kết quả kiểm kê",
    "POST /api/v1/stocktakes/[id]/cancel": "Hủy đợt kiểm kê",
    "POST /api/v1/stocktakes/[id]/reconcile": "Chốt đợt kiểm kê",
  }),
  ...A("report", {
    "GET /api/v1/reports/[code]": "Xem báo cáo / xuất Excel báo cáo",
    "GET /api/v1/reports/collaborators": "Xem báo cáo cộng tác viên",
    "GET /api/v1/reports/dashboard": "Xem tổng quan kinh doanh",
  }),
  ...A("admin", {
    "POST /api/v1/users": "Tạo tài khoản",
    "PATCH /api/v1/users/[id]": "Sửa tài khoản",
    "POST /api/v1/users/[id]/reset-password": "Đặt lại mật khẩu người dùng",
    "PUT /api/v1/users/[id]/roles": "Đổi vai trò người dùng",
    "POST /api/v1/users/[id]/set-status": "Khóa / mở khóa tài khoản",
    "POST /api/v1/roles": "Tạo vai trò",
    "PATCH /api/v1/roles/[id]": "Sửa vai trò",
    "PUT /api/v1/roles/[id]/permissions": "Đổi quyền của vai trò",
    "PATCH /api/v1/settings": "Đổi cài đặt hệ thống",
    "GET /api/v1/audit": "Xem nhật ký thay đổi dữ liệu",
    "GET /api/v1/activity": "Xem nhật ký hoạt động",
    "GET /api/v1/activity/logins": "Xem lịch sử đăng nhập",
  }),
  ...A("auth", {
    "POST /api/v1/auth/logout": "Đăng xuất",
    "POST /api/v1/auth/change-password": "Đổi mật khẩu",
    "POST /api/v1/auth/reauth": "Xác thực lại (thao tác nhạy cảm)",
    "POST /api/v1/auth/mfa/setup": "Bắt đầu bật xác thực 2 bước",
    "POST /api/v1/auth/mfa/verify": "Nhập mã xác thực 2 bước",
    "POST /api/v1/auth/mfa/disable": "Tắt xác thực 2 bước",
    "POST /api/v1/auth/sessions/[id]/revoke": "Thu hồi phiên đăng nhập",
    "DELETE /api/v1/auth/trusted-devices": "Quên các thiết bị đã tin cậy",
    "DELETE /api/v1/auth/trusted-devices/[id]": "Bỏ tin cậy một thiết bị",
    "PUT /api/v1/me/push-config": "Đổi cài đặt thông báo đẩy",
    "POST /api/v1/me/push-subscriptions": "Bật thông báo đẩy trên thiết bị",
    "DELETE /api/v1/me/push-subscriptions": "Tắt thông báo đẩy trên thiết bị",
    "POST /api/v1/me/push-subscriptions/test": "Gửi thử thông báo đẩy",
  }),
];

const BY_KEY = new Map(RULES.map(([k, area, label]) => [k, { area, label }]));

const SEGMENT_AREA: Record<string, string> = {
  sales: "sales", reservations: "sales", payments: "sales", documents: "sales",
  purchases: "purchase",
  catalog: "unit", files: "unit",
  parts: "part", "part-categories": "part",
  customers: "customer", "customer-groups": "customer",
  repairs: "repair", warranties: "repair", "service-types": "repair",
  collaborators: "collab", collab: "collab", assignments: "collab", settlements: "collab",
  stocktakes: "stocktake",
  reports: "report",
  users: "admin", roles: "admin", settings: "admin", audit: "admin", activity: "admin", system: "admin", permissions: "admin",
  auth: "auth", me: "auth",
};

/** Mã sự kiện đọc nhạy cảm (cột activity_logs.action) → nhãn tiếng Việt. */
export const ACTIVITY_ACTIONS: Record<string, string> = {
  export: "Xuất Excel",
  print: "In phiếu / tem",
  view_cost: "Xem giá vốn",
  view_report: "Xem báo cáo",
  reveal_pii: "Xem CCCD đầy đủ",
  view_audit: "Xem nhật ký",
};

export interface ActivityLabel {
  area: string;
  areaLabel: string;
  label: string;
}

/** Nhãn dễ đọc cho một thao tác; route chưa có trong bảng ⇒ "<PHƯƠNG THỨC> <route>" và suy khu vực từ đường dẫn. */
export function activityLabel(method: string, route: string, action?: string | null): ActivityLabel {
  const hit = BY_KEY.get(`${method} ${route}`);
  if (hit) {
    // Xuất Excel dùng chung route với xem báo cáo ⇒ nhãn theo action
    const label = hit.area === "report" && action === "export" ? "Xuất Excel báo cáo" : hit.label;
    return { area: hit.area, areaLabel: ACTIVITY_AREAS[hit.area]!, label };
  }
  const seg = route.split("/")[3] ?? "";
  const area = SEGMENT_AREA[seg] ?? "other";
  return { area, areaLabel: ACTIVITY_AREAS[area]!, label: `${method} ${route.replace(/^\/api\/v1/, "")}` };
}

/** Các khóa "<PHƯƠNG THỨC> <route>" có nhãn đã biết thuộc một khu vực (route chưa có nhãn suy theo đoạn đường dẫn nên lọc dùng cả tiền tố). */
export function routesOfArea(area: string): { keys: string[]; prefixes: string[] } {
  return {
    keys: RULES.filter(([, a]) => a === area).map(([k]) => k),
    prefixes: Object.entries(SEGMENT_AREA).filter(([, a]) => a === area).map(([s]) => `/api/v1/${s}`),
  };
}

/** Khóa có nhãn/route chứa chuỗi tìm kiếm (không phân biệt hoa thường). */
export function routesMatching(q: string): string[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return RULES.filter(([k, , label]) => label.toLowerCase().includes(s) || k.toLowerCase().includes(s)).map(([k]) => k);
}

/** Nhãn lý do thất bại đăng nhập / sự kiện bảo mật (audit_logs.action bắt đầu bằng "auth."). */
export const AUTH_EVENT_LABEL: Record<string, { label: string; tone: "ok" | "bad" | "hold" | "info" }> = {
  "auth.login": { label: "Đăng nhập thành công", tone: "ok" },
  "auth.login_failed": { label: "Sai mật khẩu", tone: "bad" },
  "auth.locked": { label: "Tài khoản bị khóa tạm do nhập sai nhiều lần", tone: "bad" },
  "auth.mfa_failed": { label: "Sai mã xác thực 2 bước", tone: "bad" },
  "auth.mfa_enabled": { label: "Bật xác thực 2 bước", tone: "info" },
  "auth.mfa_disabled": { label: "Tắt xác thực 2 bước", tone: "hold" },
  "auth.recovery_code_used": { label: "Dùng mã khôi phục 2FA", tone: "hold" },
  "auth.refresh_reuse": { label: "Phát hiện dùng lại phiên cũ (đã thu hồi phiên)", tone: "bad" },
  "auth.password_changed": { label: "Đổi mật khẩu", tone: "info" },
  "auth.reauth_failed": { label: "Xác thực lại thất bại", tone: "bad" },
  "auth.device_trusted": { label: "Tin cậy thiết bị này (bỏ qua mã 2FA)", tone: "hold" },
  "auth.login_trusted": { label: "Đăng nhập trên thiết bị tin cậy (không hỏi mã 2FA)", tone: "ok" },
  "auth.trusted_device_revoked": { label: "Bỏ tin cậy một thiết bị", tone: "info" },
  "auth.trusted_devices_revoked": { label: "Thu hồi mọi thiết bị tin cậy", tone: "info" },
  "user.password_reset": { label: "Chủ cửa hàng đặt lại mật khẩu", tone: "hold" },
  "user.status": { label: "Khóa / mở khóa tài khoản", tone: "hold" },
};

/** Các mã audit_logs.action được tính là sự kiện đăng nhập/bảo mật tài khoản (tab "Đăng nhập"). */
export const AUTH_EVENT_ACTIONS = Object.keys(AUTH_EVENT_LABEL);
