// Nhãn tiếng Việt cho nhật ký hoạt động (Quản trị → Nhật ký → Truy cập & đăng nhập). Khóa = "<PHƯƠNG THỨC> <route mẫu>", route là đường dẫn API với giá trị
// tham số thay bằng [tên] (vd. "POST /api/v1/sales/[id]/confirm"). Dùng chung cho máy chủ (gắn nhãn, lọc theo khu vực) và giao diện.
// Port từ mẫu Lưu Xá (activity-labels), đổi sang miền WatchFlow. Route mới chưa có nhãn vẫn hiển thị (nhãn dự phòng "<PT> <route>").

export const ACTIVITY_AREAS: Record<string, string> = {
  sales: "Bán hàng",
  unit: "Kho & đồng hồ",
  customer: "Khách hàng",
  repair: "Sửa chữa",
  collab: "Cộng tác viên",
  report: "Báo cáo & xuất file",
  admin: "Người dùng & cài đặt",
  auth: "Đăng nhập & bảo mật",
  other: "Khác",
};

const A = (area: string, entries: Record<string, string>): [string, string, string][] => Object.entries(entries).map(([k, label]) => [k, area, label]);

const RULES: [string, string, string][] = [
  ...A("sales", {
    "POST /api/v1/sales": "Ghi đơn bán",
    "POST /api/v1/sales/[id]/void": "Hủy đơn bán",
    "POST /api/v1/sales/[id]/print": "In phiếu bán",
  }),
  ...A("unit", {
    "POST /api/v1/purchases/quick": "Thêm đồng hồ vào kho",
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
    "POST /api/v1/catalog/units/[id]/release": "Kiểm tra đạt — sẵn sàng bán",
    "POST /api/v1/catalog/units/[id]/restore": "Khôi phục chiếc",
    "POST /api/v1/catalog/units/[id]/writeoff": "Ghi mất / thanh lý chiếc",
    "GET /api/v1/catalog/units/[id]/label": "In tem chiếc",
    "POST /api/v1/files": "Tải tệp / ảnh lên",
  }),
  ...A("customer", {
    "POST /api/v1/customers": "Thêm khách hàng",
    "PATCH /api/v1/customers/[id]": "Sửa khách hàng",
    "POST /api/v1/customers/[id]/watches": "Ghi đồng hồ của khách",
  }),
  ...A("repair", {
    "POST /api/v1/repairs": "Nhận máy sửa chữa",
    "PATCH /api/v1/repairs/[id]": "Sửa phiếu sửa chữa",
    "POST /api/v1/repairs/[id]/cancel": "Hủy phiếu sửa",
    "POST /api/v1/repairs/[id]/complete": "Sửa xong",
    "POST /api/v1/repairs/[id]/deliver": "Giao máy sau sửa",
    "POST /api/v1/repairs/[id]/lines": "Thêm khoản tiền sửa",
    "PATCH /api/v1/repairs/[id]/lines/[lineId]": "Sửa khoản tiền sửa",
    "DELETE /api/v1/repairs/[id]/lines/[lineId]": "Xóa khoản tiền sửa",
    "POST /api/v1/repairs/[id]/status": "Đổi trạng thái phiếu sửa",
    "POST /api/v1/service-types": "Thêm loại dịch vụ sửa",
  }),
  ...A("collab", {
    "PATCH /api/v1/collaborators/[id]": "Sửa hồ sơ cộng tác viên",
    "POST /api/v1/collab/offers": "Giao đồng hồ cho CTV",
    "POST /api/v1/collab/offers/withdraw": "Thu hồi đồng hồ đã giao CTV",
    "POST /api/v1/collab/claims/[id]/confirm": "Xác nhận CTV bán được",
    "POST /api/v1/collab/claims/[id]/reject": "Từ chối CTV báo bán",
    "POST /api/v1/collab/me/claims": "CTV báo đã bán",
    "POST /api/v1/collab/me/claims/[id]/cancel": "CTV rút lại báo bán",
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
  sales: "sales",
  purchases: "unit", catalog: "unit", files: "unit",
  customers: "customer",
  repairs: "repair", warranties: "repair", "service-types": "repair",
  collaborators: "collab", collab: "collab",
  reports: "report",
  users: "admin", roles: "admin", settings: "admin", audit: "admin", activity: "admin", system: "admin", permissions: "admin",
  auth: "auth", me: "auth",
};

/** Mã sự kiện đọc nhạy cảm (cột activity_logs.action) → nhãn tiếng Việt. */
export const ACTIVITY_ACTIONS: Record<string, string> = {
  export: "Xuất Excel",
  print: "In phiếu / tem",
  view_report: "Xem báo cáo",
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
