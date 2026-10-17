// Danh mục báo cáo R1–R12 (khớp src/server/reports.ts) + cách hiển thị bảng. Quyền ở đây chỉ để ẩn/hiện mục; máy chủ kiểm lại (403 nếu thiếu).
import type { Permission } from "@/lib/permissions";

export type Col = { key: string; label: string; money?: boolean; date?: boolean; num?: boolean };
export type Section = { title: string; path?: string; cols: Col[]; totals?: string[]; kv?: boolean };
export type ReportMeta = {
  code: string;
  no: string;
  title: string;
  desc: string;
  perm: Permission | Permission[];
  dates?: boolean;
  group?: boolean;
  days?: boolean;
  sections: Section[];
};

export const REPORTS: ReportMeta[] = [
  { code: "revenue", no: "R1", title: "Doanh thu", desc: "Bán hàng + sửa chữa theo ngày/tháng/quý/năm", perm: "report.sales", dates: true, group: true,
    sections: [{ title: "Doanh thu theo kỳ", cols: [{ key: "period", label: "Kỳ", date: true }, { key: "salesRevenue", label: "Bán hàng", money: true }, { key: "repairRevenue", label: "Sửa chữa", money: true }, { key: "revenue", label: "Tổng", money: true }, { key: "invoiceCount", label: "Số phiếu", num: true }, { key: "avgPerInvoice", label: "TB/phiếu", money: true }], totals: ["salesRevenue", "repairRevenue", "revenue", "invoiceCount"] }] },
  { code: "profit", no: "R2", title: "Lợi nhuận gộp", desc: "Doanh thu trừ giá vốn, theo kỳ và từng dòng", perm: "profit.view", dates: true, group: true,
    sections: [
      { title: "Theo kỳ", path: "periods", cols: [{ key: "period", label: "Kỳ", date: true }, { key: "revenue", label: "Doanh thu", money: true }, { key: "cogs", label: "Giá vốn", money: true }, { key: "grossProfit", label: "Lãi gộp", money: true }, { key: "marginPct", label: "Biên lãi %", num: true }], totals: ["revenue", "cogs", "grossProfit"] },
      { title: "Từng dòng", path: "lines", cols: [{ key: "docDate", label: "Ngày", date: true }, { key: "saleCode", label: "Phiếu" }, { key: "item", label: "Hàng" }, { key: "brand", label: "Hãng" }, { key: "channel", label: "Kênh" }, { key: "revenue", label: "Doanh thu", money: true }, { key: "cost", label: "Giá vốn", money: true }, { key: "grossProfit", label: "Lãi gộp", money: true }], totals: ["revenue", "cost", "grossProfit"] },
    ] },
  { code: "moves", no: "R3", title: "Nhập & xuất hàng", desc: "Hàng vào kho theo nguồn, hàng ra theo loại", perm: ["report.inventory", "purchase.view"], dates: true,
    sections: [
      { title: "Nhập", path: "inbound", cols: [{ key: "kind", label: "Loại" }, { key: "source", label: "Nguồn" }, { key: "receipts", label: "Số phiếu", num: true }, { key: "units", label: "Số chiếc", num: true }, { key: "partQty", label: "SL linh kiện", num: true }, { key: "value", label: "Giá trị", money: true }], totals: ["receipts", "units", "partQty", "value"] },
      { title: "Xuất", path: "outbound", kv: true, cols: [{ key: "k", label: "Chỉ số" }, { key: "v", label: "Số lượng", num: true }] },
    ] },
  { code: "stock", no: "R4", title: "Tồn kho theo giá vốn", desc: "Giá trị tồn đồng hồ và linh kiện", perm: ["report.inventory", "cost.view"],
    sections: [
      { title: "Đồng hồ", path: "units", cols: [{ key: "assetCode", label: "Mã" }, { key: "model", label: "Loại" }, { key: "brand", label: "Hãng" }, { key: "serialNo", label: "Serial" }, { key: "status", label: "Trạng thái" }, { key: "location", label: "Vị trí" }, { key: "cost", label: "Giá vốn", money: true }, { key: "price", label: "Giá bán", money: true }, { key: "expectedProfit", label: "Lãi dự kiến", money: true }], totals: ["cost", "price", "expectedProfit"] },
      { title: "Linh kiện", path: "parts", cols: [{ key: "code", label: "Mã" }, { key: "name", label: "Tên" }, { key: "qty", label: "SL", num: true }, { key: "avgCost", label: "Giá vốn BQ", money: true }, { key: "value", label: "Giá trị", money: true }], totals: ["value"] },
    ] },
  { code: "aging", no: "R5", title: "Hàng tồn lâu ngày", desc: "Chiếc nằm kho quá ngưỡng", perm: ["report.inventory", "catalog.view"], days: true,
    sections: [{ title: "Tồn lâu", cols: [{ key: "assetCode", label: "Mã" }, { key: "model", label: "Loại" }, { key: "stockSince", label: "Vào kho", date: true }, { key: "days", label: "Số ngày", num: true }, { key: "location", label: "Vị trí" }, { key: "cost", label: "Giá vốn", money: true }], totals: ["cost"] }] },
  { code: "open-balances", no: "R6", title: "Phiếu còn nợ", desc: "Khách còn nợ và cọc đang giữ", perm: ["debt.view", "report.sales"],
    sections: [
      { title: "Còn nợ", path: "due", cols: [{ key: "code", label: "Phiếu" }, { key: "docDate", label: "Ngày", date: true }, { key: "customer", label: "Khách" }, { key: "phone", label: "SĐT" }, { key: "payable", label: "Phải thu", money: true }, { key: "paid", label: "Đã trả", money: true }, { key: "due", label: "Còn nợ", money: true }, { key: "dueDate", label: "Hẹn trả", date: true }], totals: ["payable", "paid", "due"] },
      { title: "Cọc đang giữ", path: "held", cols: [{ key: "code", label: "Chứng từ" }, { key: "customer", label: "Khách" }, { key: "held", label: "Đang giữ", money: true }], totals: ["held"] },
    ] },
  { code: "repairs", no: "R7", title: "Doanh thu sửa chữa", desc: "Phiếu sửa đã giao: doanh thu, giá vốn linh kiện, lãi", perm: ["report.sales", "repair.view"], dates: true,
    sections: [{ title: "Sửa chữa", cols: [{ key: "code", label: "Phiếu" }, { key: "deliveredDate", label: "Ngày giao", date: true }, { key: "chargeMode", label: "Tính phí" }, { key: "customer", label: "Khách" }, { key: "serviceRevenue", label: "Dịch vụ", money: true }, { key: "partsRevenue", label: "Linh kiện", money: true }, { key: "revenue", label: "Doanh thu", money: true }, { key: "partsCost", label: "Giá vốn LK", money: true }, { key: "warrantyCost", label: "Chi phí BH", money: true }, { key: "grossProfit", label: "Lãi gộp", money: true }], totals: ["serviceRevenue", "partsRevenue", "revenue", "partsCost", "warrantyCost", "grossProfit"] }] },
  { code: "collections", no: "R8", title: "Tiền thu", desc: "Thực thu theo mục đích, hình thức và theo ngày", perm: ["report.sales", "debt.view"], dates: true,
    sections: [
      { title: "Theo mục đích", path: "rows", cols: [{ key: "purpose", label: "Mục đích" }, { key: "direction", label: "Chiều" }, { key: "method", label: "Hình thức" }, { key: "count", label: "Số lần", num: true }, { key: "amount", label: "Số tiền", money: true }], totals: ["count", "amount"] },
      { title: "Theo ngày", path: "byDay", cols: [{ key: "day", label: "Ngày", date: true }, { key: "net", label: "Thực thu", money: true }], totals: ["net"] },
    ] },
  { code: "shrinkage", no: "R10", title: "Hao hụt kiểm kê", desc: "Chênh lệch và tổn thất từ các đợt kiểm kê", perm: ["report.inventory", "stocktake.manage"], dates: true,
    sections: [{ title: "Hao hụt", cols: [{ key: "stocktake", label: "Đợt" }, { key: "date", label: "Ngày", date: true }, { key: "item", label: "Mã" }, { key: "name", label: "Tên" }, { key: "diff", label: "Lệch", num: true }, { key: "reason", label: "Lý do" }, { key: "loss", label: "Tổn thất", money: true }], totals: ["loss"] }] },
  { code: "warranty", no: "R11", title: "Bảo hành sắp hết hạn", desc: "Danh sách để nhắc khách", perm: ["warranty.view", "report.sales"], days: true,
    sections: [{ title: "Bảo hành", cols: [{ key: "code", label: "Mã BH" }, { key: "kind", label: "Loại" }, { key: "endDate", label: "Hết hạn", date: true }, { key: "daysLeft", label: "Còn (ngày)", num: true }, { key: "customer", label: "Khách" }, { key: "phone", label: "SĐT" }, { key: "item", label: "Đồng hồ" }] }] },
];

export const byCode = (c: string) => REPORTS.find((r) => r.code === c);
