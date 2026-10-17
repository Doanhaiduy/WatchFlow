import "server-only";
// Báo cáo: mỗi mã báo cáo ⇒ đúng một hàm DB app.rpt_* (kiểm quyền trong thân — BR-SEC-02). Xuất Excel dùng CÙNG dữ liệu (PT-05).
import ExcelJS from "exceljs";
import type { Tx } from "./db";

type Col = { key: string; header: string; money?: boolean; width?: number };
export type ReportDef = {
  title: string;
  /** Gọi hàm DB, trả dữ liệu JSON */
  run: (tx: Tx, q: { from: string; to: string; group: string; days?: number }) => Promise<unknown>;
  /** Bảng chính để xuất Excel */
  sheets: (data: unknown) => { name: string; cols: Col[]; rows: Record<string, unknown>[] }[];
};

const fn = async (tx: Tx, sql: string, p: unknown[]) => (await tx.one<{ r: unknown }>(`SELECT ${sql} AS r`, p))!.r;
const arr = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);

export const REPORTS: Record<string, ReportDef> = {
  revenue: {
    title: "Doanh thu",
    run: (tx, q) => fn(tx, "app.rpt_revenue($1,$2,$3)", [q.from, q.to, q.group]),
    sheets: (d) => [{ name: "Doanh thu", rows: arr(d), cols: [{ key: "period", header: "Kỳ" }, { key: "salesRevenue", header: "Bán hàng", money: true },
      { key: "repairRevenue", header: "Sửa chữa", money: true }, { key: "revenue", header: "Tổng doanh thu", money: true }, { key: "invoiceCount", header: "Số phiếu" },
      { key: "avgPerInvoice", header: "TB/phiếu", money: true }] }],
  },
  profit: {
    title: "Lợi nhuận gộp",
    run: async (tx, q) => ({ periods: await fn(tx, "app.rpt_profit($1,$2,$3)", [q.from, q.to, q.group]), lines: await fn(tx, "app.rpt_profit_lines($1,$2)", [q.from, q.to]) }),
    sheets: (d) => {
      const x = d as { periods: unknown; lines: unknown };
      return [
        { name: "Theo kỳ", rows: arr(x.periods), cols: [{ key: "period", header: "Kỳ" }, { key: "revenue", header: "Doanh thu", money: true }, { key: "cogs", header: "Giá vốn", money: true },
          { key: "grossProfit", header: "Lãi gộp", money: true }, { key: "marginPct", header: "Biên lãi %" }] },
        { name: "Từng dòng", rows: arr(x.lines), cols: [{ key: "docDate", header: "Ngày" }, { key: "saleCode", header: "Phiếu" }, { key: "item", header: "Hàng", width: 36 },
          { key: "brand", header: "Thương hiệu" }, { key: "channel", header: "Kênh" }, { key: "revenue", header: "Doanh thu", money: true }, { key: "cost", header: "Giá vốn", money: true },
          { key: "grossProfit", header: "Lãi gộp", money: true }] },
      ];
    },
  },
  moves: {
    title: "Nhập & xuất hàng",
    run: (tx, q) => fn(tx, "app.rpt_moves($1,$2)", [q.from, q.to]),
    sheets: (d) => {
      const x = d as { inbound: unknown; outbound: Record<string, unknown> };
      return [
        { name: "Nhập", rows: arr(x.inbound), cols: [{ key: "kind", header: "Loại" }, { key: "source", header: "Nguồn", width: 28 }, { key: "receipts", header: "Số phiếu" },
          { key: "units", header: "Số chiếc" }, { key: "partQty", header: "SL linh kiện" }, { key: "value", header: "Giá trị", money: true }] },
        { name: "Xuất", rows: Object.entries(x.outbound ?? {}).map(([k, v]) => ({ k, v })), cols: [{ key: "k", header: "Chỉ số", width: 24 }, { key: "v", header: "Số lượng" }] },
      ];
    },
  },
  stock: {
    title: "Tồn kho theo giá vốn",
    run: (tx) => fn(tx, "app.rpt_stock_value()", []),
    sheets: (d) => {
      const x = d as { units: unknown; parts: unknown };
      return [
        { name: "Đồng hồ", rows: arr(x.units), cols: [{ key: "assetCode", header: "Mã" }, { key: "model", header: "Loại", width: 30 }, { key: "brand", header: "Thương hiệu" },
          { key: "serialNo", header: "Serial" }, { key: "status", header: "Trạng thái" }, { key: "location", header: "Vị trí", width: 22 }, { key: "cost", header: "Giá vốn", money: true },
          { key: "price", header: "Giá bán", money: true }, { key: "expectedProfit", header: "Lãi dự kiến", money: true }] },
        { name: "Linh kiện", rows: arr(x.parts), cols: [{ key: "code", header: "Mã" }, { key: "name", header: "Tên", width: 30 }, { key: "qty", header: "SL" },
          { key: "avgCost", header: "Bình quân" }, { key: "value", header: "Giá trị", money: true }] },
      ];
    },
  },
  aging: {
    title: "Hàng tồn lâu ngày",
    run: (tx, q) => fn(tx, "app.rpt_aging($1)", [q.days ?? null]),
    sheets: (d) => [{ name: "Tồn lâu", rows: arr(d), cols: [{ key: "assetCode", header: "Mã" }, { key: "model", header: "Loại", width: 30 }, { key: "stockSince", header: "Vào kho" },
      { key: "days", header: "Số ngày" }, { key: "location", header: "Vị trí" }, { key: "cost", header: "Giá vốn", money: true }] }],
  },
  "open-balances": {
    title: "Phiếu còn nợ",
    run: (tx) => fn(tx, "app.rpt_open_balances()", []),
    sheets: (d) => {
      const x = d as { due: unknown; held: unknown };
      return [
        { name: "Còn nợ", rows: arr(x.due), cols: [{ key: "code", header: "Phiếu" }, { key: "docDate", header: "Ngày" }, { key: "customer", header: "Khách", width: 24 },
          { key: "phone", header: "SĐT" }, { key: "payable", header: "Phải thu", money: true }, { key: "paid", header: "Đã trả", money: true }, { key: "due", header: "Còn nợ", money: true },
          { key: "dueDate", header: "Hẹn trả" }] },
        { name: "Cọc đang giữ", rows: arr(x.held), cols: [{ key: "code", header: "Chứng từ" }, { key: "customer", header: "Khách", width: 24 }, { key: "held", header: "Đang giữ", money: true }] },
      ];
    },
  },
  repairs: {
    title: "Doanh thu sửa chữa",
    run: (tx, q) => fn(tx, "app.rpt_repair($1,$2)", [q.from, q.to]),
    sheets: (d) => [{ name: "Sửa chữa", rows: arr(d), cols: [{ key: "code", header: "Phiếu" }, { key: "deliveredDate", header: "Ngày giao" }, { key: "chargeMode", header: "Tính phí" },
      { key: "customer", header: "Khách", width: 24 }, { key: "serviceRevenue", header: "Dịch vụ", money: true }, { key: "partsRevenue", header: "Linh kiện", money: true },
      { key: "revenue", header: "Doanh thu", money: true }, { key: "partsCost", header: "Giá vốn LK", money: true }, { key: "warrantyCost", header: "Chi phí BH", money: true },
      { key: "grossProfit", header: "Lãi gộp", money: true }] }],
  },
  collections: {
    title: "Tiền thu",
    run: (tx, q) => fn(tx, "app.rpt_collections($1,$2)", [q.from, q.to]),
    sheets: (d) => {
      const x = d as { rows: unknown; byDay: unknown };
      return [
        { name: "Theo mục đích", rows: arr(x.rows), cols: [{ key: "purpose", header: "Mục đích" }, { key: "direction", header: "Chiều" }, { key: "method", header: "Cách" },
          { key: "count", header: "Số lần" }, { key: "amount", header: "Số tiền", money: true }] },
        { name: "Theo ngày", rows: arr(x.byDay), cols: [{ key: "day", header: "Ngày" }, { key: "net", header: "Thực thu", money: true }] },
      ];
    },
  },
  shrinkage: {
    title: "Hao hụt kiểm kê",
    run: (tx, q) => fn(tx, "app.rpt_shrinkage($1,$2)", [q.from, q.to]),
    sheets: (d) => [{ name: "Hao hụt", rows: arr(d), cols: [{ key: "stocktake", header: "Đợt" }, { key: "date", header: "Ngày" }, { key: "item", header: "Mã" },
      { key: "name", header: "Tên", width: 28 }, { key: "diff", header: "Lệch" }, { key: "reason", header: "Lý do" }, { key: "loss", header: "Tổn thất", money: true }] }],
  },
  warranty: {
    title: "Bảo hành sắp hết hạn",
    run: (tx, q) => fn(tx, "app.rpt_warranty_expiring($1)", [q.days ?? null]),
    sheets: (d) => [{ name: "Bảo hành", rows: arr(d), cols: [{ key: "code", header: "Mã BH" }, { key: "kind", header: "Loại" }, { key: "endDate", header: "Hết hạn" },
      { key: "daysLeft", header: "Còn (ngày)" }, { key: "customer", header: "Khách", width: 24 }, { key: "phone", header: "SĐT" }, { key: "item", header: "Đồng hồ", width: 24 }] }],
  },
};

export async function toXlsx(title: string, sheets: ReturnType<ReportDef["sheets"]>, meta: string): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WatchFlow";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.addRow([title]).font = { bold: true, size: 13 };
    ws.addRow([meta]).font = { italic: true, color: { argb: "FF6E7194" } };
    ws.addRow([]);
    const head = ws.addRow(s.cols.map((c) => c.header));
    head.font = { bold: true };
    for (const r of s.rows) ws.addRow(s.cols.map((c) => r[c.key] ?? null));
    s.cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width ?? Math.max(12, c.header.length + 2);
      if (c.money) col.numFmt = "#,##0";
    });
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
