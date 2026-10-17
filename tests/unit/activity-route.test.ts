// UT-activity — nhật ký hoạt động: route mẫu không chứa giá trị tham số/query/PII; chọn request nào được ghi; mã đọc nhạy cảm; nhãn tiếng Việt.
import { describe, expect, it } from "vitest";
import { ROUTE_RE, actionOf, entityIdOf, routeOf, shouldRecord } from "@/lib/activity-route";
import { activityLabel, routesOfArea } from "@/lib/activity-labels";

const ID = "0192f0a0-1b2c-7d3e-8f40-0123456789ab";

describe("routeOf", () => {
  it("thay giá trị tham số bằng [tên]", () => {
    expect(routeOf(`/api/v1/sales/${ID}/confirm`, { id: ID })).toBe("/api/v1/sales/[id]/confirm");
    expect(routeOf(`/api/v1/repairs/${ID}/lines/${ID.replace("ab", "cd")}`, { id: ID, lineId: ID.replace("ab", "cd") })).toBe("/api/v1/repairs/[id]/lines/[lineId]");
  });
  it("route tĩnh giữ nguyên; bỏ query nếu lỡ có", () => {
    expect(routeOf("/api/v1/catalog/units/lookup", {})).toBe("/api/v1/catalog/units/lookup");
    expect(routeOf("/api/v1/customers?phone=0912345678", {})).toBe("/api/v1/customers");
  });
  it("kết quả luôn khớp ROUTE_RE; giá trị lạ (PII) không lọt vào route khi đã có trong params", () => {
    const r = routeOf("/api/v1/customers/0912345678/watches", { id: "0912345678" });
    expect(r).toBe("/api/v1/customers/[id]/watches");
    expect(ROUTE_RE.test(r)).toBe(true);
    expect(ROUTE_RE.test("/api/v1/customers?phone=1")).toBe(false);
    expect(ROUTE_RE.test("/api/v1/khách")).toBe(false);
  });
});

describe("entityIdOf", () => {
  it("lấy UUID đầu tiên, bỏ qua giá trị khác", () => {
    expect(entityIdOf({ code: "doanh-thu", id: ID })).toBe(ID);
    expect(entityIdOf({ code: "r1" })).toBeNull();
    expect(entityIdOf({ id: "0912345678" })).toBeNull();
  });
});

describe("actionOf", () => {
  const q = (s = "") => new URLSearchParams(s);
  it("xuất Excel, in, giá vốn, báo cáo, CCCD", () => {
    expect(actionOf("GET", "/api/v1/reports/[code]", q("format=xlsx"))).toBe("export");
    expect(actionOf("GET", "/api/v1/reports/[code]", q("format=json"))).toBe("view_report");
    expect(actionOf("GET", "/api/v1/purchases/export", q())).toBe("export");
    expect(actionOf("GET", "/api/v1/catalog/units/[id]/cost", q())).toBe("view_cost");
    expect(actionOf("POST", "/api/v1/sales/[id]/print", q())).toBe("print");
    expect(actionOf("POST", "/api/v1/customers/[id]/reveal-id", q())).toBe("reveal_pii");
    expect(actionOf("GET", "/api/v1/sales", q())).toBeNull();
  });
  it("xem nhật ký chỉ ghi trang đầu", () => {
    expect(actionOf("GET", "/api/v1/activity", q())).toBe("view_audit");
    expect(actionOf("GET", "/api/v1/activity", q("before=x"))).toBeNull();
    expect(actionOf("GET", "/api/v1/audit", q("page=3"))).toBeNull();
  });
});

describe("shouldRecord", () => {
  it("ghi mọi thao tác ghi, kể cả lỗi", () => {
    expect(shouldRecord("POST", "/api/v1/sales/[id]/confirm", 200, null, null)).toBe(true);
    expect(shouldRecord("POST", "/api/v1/sales/[id]/confirm", 422, "WF-VALIDATION", null)).toBe(true);
    expect(shouldRecord("DELETE", "/api/v1/sales/[id]", 403, "WF-AUTH-FORBIDDEN", null)).toBe(true);
  });
  it("bỏ qua poll/đánh dấu đã đọc/tự báo lỗi", () => {
    expect(shouldRecord("POST", "/api/v1/notifications/read-all", 200, null, null)).toBe(false);
    expect(shouldRecord("POST", "/api/v1/public/client-error", 204, null, null)).toBe(false);
    expect(shouldRecord("GET", "/api/v1/me/badges", 200, null, null)).toBe(false);
    expect(shouldRecord("GET", "/api/v1/search", 403, "WF-AUTH-FORBIDDEN", null)).toBe(false);
  });
  it("đọc thường không ghi; đọc nhạy cảm và 403 thì ghi", () => {
    expect(shouldRecord("GET", "/api/v1/sales", 200, null, null)).toBe(false);
    expect(shouldRecord("GET", "/api/v1/catalog/units/[id]/cost", 200, null, "view_cost")).toBe(true);
    expect(shouldRecord("GET", "/api/v1/reports/[code]", 403, "WF-AUTH-FORBIDDEN", "view_report")).toBe(true);
    expect(shouldRecord("GET", "/api/v1/sales", 403, "WF-AUTH-FORBIDDEN", null)).toBe(true);
    expect(shouldRecord("GET", "/api/v1/sales", 403, "WF-AUTH-MFA-REQUIRED", null)).toBe(false);
  });
});

describe("nhãn", () => {
  it("route có nhãn", () => {
    expect(activityLabel("POST", "/api/v1/sales/[id]/confirm").label).toBe("Xác nhận phiếu bán");
    expect(activityLabel("GET", "/api/v1/reports/[code]", "export").label).toBe("Xuất Excel báo cáo");
  });
  it("route chưa có nhãn: suy khu vực theo đoạn đường dẫn, nhãn dự phòng", () => {
    const l = activityLabel("POST", "/api/v1/sales/[id]/chua-co-nhan");
    expect(l.area).toBe("sales");
    expect(l.label).toContain("/sales/[id]/chua-co-nhan");
    expect(activityLabel("GET", "/api/v1/zzz").area).toBe("other");
  });
  it("routesOfArea trả khóa + tiền tố", () => {
    const r = routesOfArea("repair");
    expect(r.keys).toContain("POST /api/v1/repairs/[id]/deliver");
    expect(r.prefixes).toContain("/api/v1/repairs");
  });
});
