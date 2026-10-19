import "server-only";
// Báo cáo (CF-17): chỉ 3 báo cáo — Doanh thu, Số lượng đồng hồ, Cộng tác viên. Mỗi mã ⇒ một hàm DB app.rpt_* (kiểm quyền trong thân — BR-SEC-02). Xuất Excel dùng CÙNG dữ liệu (PT-05).
import ExcelJS from "exceljs";
import type { Tx } from "./db";

type Col = { key: string; header: string; money?: boolean; width?: number };
export type ReportDef = {
  title: string;
  /** Gọi hàm DB, trả dữ liệu JSON */
  run: (tx: Tx, q: { from: string; to: string; group: string }) => Promise<unknown>;
  /** Bảng chính để xuất Excel */
  sheets: (data: unknown) => { name: string; cols: Col[]; rows: Record<string, unknown>[] }[];
};

const fn = async (tx: Tx, sql: string, p: unknown[]) => (await tx.one<{ r: unknown }>(`SELECT ${sql} AS r`, p))!.r;
const arr = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);

export const REPORTS: Record<string, ReportDef> = {
  // R1 Doanh thu theo ngày/tháng/quý/năm: cửa hàng + CTV + sửa chữa, kèm số đơn và số chiếc (doanh thu từ chứng từ — BR-PAY-02)
  revenue: {
    title: "Doanh thu",
    run: (tx, q) => fn(tx, "app.rpt_revenue($1,$2,$3)", [q.from, q.to, q.group]),
    sheets: (d) => [{ name: "Doanh thu", rows: arr(d), cols: [{ key: "period", header: "Kỳ" }, { key: "shopRevenue", header: "Bán tại cửa hàng", money: true },
      { key: "collabRevenue", header: "CTV bán", money: true }, { key: "repairRevenue", header: "Sửa chữa", money: true }, { key: "revenue", header: "Tổng doanh thu", money: true },
      { key: "invoiceCount", header: "Số đơn bán" }, { key: "unitsSold", header: "Số chiếc bán" }, { key: "collabUnits", header: "Trong đó CTV bán" }, { key: "repairCount", header: "Số máy sửa" }] }],
  },
  // R2 Số lượng đồng hồ: đã bán trong kỳ (theo hãng, theo kênh) + tồn kho hiện tại theo hãng
  units: {
    title: "Số lượng đồng hồ",
    run: async (tx, q) => {
      const x = (await fn(tx, "app.rpt_units($1,$2)", [q.from, q.to])) as { sold: { total: number; shop: number; collab: number; byBrand: unknown }; stock: { sellable: number; inspecting: number; offered: number; byBrand: unknown } };
      return {
        summary: [
          { k: "Đã bán trong kỳ", v: x.sold.total }, { k: "  - Bán tại cửa hàng", v: x.sold.shop }, { k: "  - CTV bán", v: x.sold.collab },
          { k: "Đang sẵn sàng bán", v: x.stock.sellable }, { k: "Chờ kiểm tra", v: x.stock.inspecting }, { k: "Đang giao cho CTV", v: x.stock.offered },
        ],
        soldByBrand: x.sold.byBrand,
        stockByBrand: x.stock.byBrand,
      };
    },
    sheets: (d) => {
      const x = d as { summary: unknown; soldByBrand: unknown; stockByBrand: unknown };
      return [
        { name: "Tổng hợp", rows: arr(x.summary), cols: [{ key: "k", header: "Chỉ số", width: 28 }, { key: "v", header: "Số chiếc" }] },
        { name: "Đã bán theo hãng", rows: arr(x.soldByBrand), cols: [{ key: "brand", header: "Hãng", width: 24 }, { key: "units", header: "Số chiếc" }] },
        { name: "Tồn kho theo hãng", rows: arr(x.stockByBrand), cols: [{ key: "brand", header: "Hãng", width: 24 }, { key: "units", header: "Số chiếc" }] },
      ];
    },
  },
  // R3 Cộng tác viên mang về (chỉ chủ): số chiếc + doanh thu theo kỳ và theo từng CTV
  collab: {
    title: "Cộng tác viên",
    run: (tx, q) => fn(tx, "app.rpt_collab_sales($1,$2,$3)", [q.from, q.to, q.group]),
    sheets: (d) => {
      const x = d as { periods: unknown; byCollaborator: unknown; rows: unknown };
      return [
        { name: "Theo CTV", rows: arr(x.byCollaborator), cols: [{ key: "name", header: "Cộng tác viên", width: 26 }, { key: "units", header: "Số chiếc" }, { key: "revenue", header: "Doanh thu", money: true }] },
        { name: "Theo kỳ", rows: arr(x.periods), cols: [{ key: "period", header: "Kỳ" }, { key: "units", header: "Số chiếc" }, { key: "revenue", header: "Doanh thu", money: true }, { key: "collaborators", header: "Số CTV có đơn" }] },
        { name: "Chi tiết", rows: arr(x.rows), cols: [{ key: "period", header: "Kỳ" }, { key: "name", header: "Cộng tác viên", width: 26 }, { key: "units", header: "Số chiếc" }, { key: "revenue", header: "Doanh thu", money: true }] },
      ];
    },
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
