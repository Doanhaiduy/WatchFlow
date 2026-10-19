// Danh mục báo cáo (khớp src/server/reports.ts) + cách hiển thị bảng. Bản gọn (CF-17): chỉ 3 báo cáo — Doanh thu, Số lượng đồng hồ, Cộng tác viên.
// Quyền ở đây chỉ để ẩn/hiện mục; máy chủ kiểm lại (403 nếu thiếu).
import type { Permission } from "@/lib/permissions";

export type Col = { key: string; label: string; money?: boolean; date?: boolean; num?: boolean };
export type Section = { title: string; path?: string; cols: Col[]; totals?: string[]; kv?: boolean };
export type ReportMeta = {
  /** Mã báo cáo ở máy chủ (/api/v1/reports/<code>) */
  code: string;
  /** Đường dẫn trang (/bao-cao/<slug>) */
  slug: string;
  title: string;
  desc: string;
  perm: Permission | Permission[];
  /** Có chọn khoảng ngày */
  dates?: boolean;
  /** Có chọn nhóm theo ngày/tháng/quý/năm */
  group?: boolean;
  sections: Section[];
};

export const REPORTS: ReportMeta[] = [
  { code: "revenue", slug: "doanh-thu", title: "Doanh thu", desc: "Bán tại cửa hàng + CTV bán + sửa chữa, theo ngày / tháng / quý / năm", perm: "report.sales", dates: true, group: true,
    sections: [{ title: "Doanh thu theo kỳ", cols: [{ key: "period", label: "Kỳ", date: true }, { key: "shopRevenue", label: "Bán tại cửa hàng", money: true }, { key: "collabRevenue", label: "CTV bán", money: true }, { key: "repairRevenue", label: "Sửa chữa", money: true }, { key: "revenue", label: "Tổng", money: true }, { key: "invoiceCount", label: "Số đơn", num: true }, { key: "unitsSold", label: "Số chiếc bán", num: true }, { key: "collabUnits", label: "Trong đó CTV", num: true }, { key: "repairCount", label: "Máy sửa", num: true }], totals: ["shopRevenue", "collabRevenue", "repairRevenue", "revenue", "invoiceCount", "unitsSold", "collabUnits", "repairCount"] }] },
  { code: "units", slug: "so-luong", title: "Số lượng đồng hồ", desc: "Đã bán trong kỳ (theo hãng, theo kênh) và đang có trong kho", perm: ["report.sales", "report.inventory"], dates: true,
    sections: [
      { title: "Tổng hợp", path: "summary", kv: true, cols: [{ key: "k", label: "Chỉ số" }, { key: "v", label: "Số chiếc", num: true }] },
      { title: "Đã bán theo hãng", path: "soldByBrand", cols: [{ key: "brand", label: "Hãng" }, { key: "units", label: "Số chiếc", num: true }], totals: ["units"] },
      { title: "Đang có trong kho theo hãng", path: "stockByBrand", cols: [{ key: "brand", label: "Hãng" }, { key: "units", label: "Số chiếc", num: true }], totals: ["units"] },
    ] },
  { code: "collab", slug: "cong-tac-vien", title: "Cộng tác viên", desc: "Số chiếc và doanh thu CTV mang về — theo từng CTV và theo kỳ", perm: "collab.view", dates: true, group: true,
    sections: [
      { title: "Theo cộng tác viên", path: "byCollaborator", cols: [{ key: "name", label: "Cộng tác viên" }, { key: "units", label: "Số chiếc", num: true }, { key: "revenue", label: "Doanh thu", money: true }], totals: ["units", "revenue"] },
      { title: "Theo kỳ", path: "periods", cols: [{ key: "period", label: "Kỳ", date: true }, { key: "units", label: "Số chiếc", num: true }, { key: "revenue", label: "Doanh thu", money: true }, { key: "collaborators", label: "Số CTV có đơn", num: true }], totals: ["units", "revenue"] },
      { title: "Chi tiết kỳ × CTV", path: "rows", cols: [{ key: "period", label: "Kỳ", date: true }, { key: "name", label: "Cộng tác viên" }, { key: "units", label: "Số chiếc", num: true }, { key: "revenue", label: "Doanh thu", money: true }], totals: ["units", "revenue"] },
    ] },
];

export const bySlug = (s: string) => REPORTS.find((r) => r.slug === s);
export const byCode = (c: string) => REPORTS.find((r) => r.code === c);
