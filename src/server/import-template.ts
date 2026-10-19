import "server-only";
// Tệp mẫu .xlsx nhập hàng loạt: sheet "Dữ liệu" (cột + 2 dòng ví dụ giả bắt đầu bằng [VÍ DỤ] — bị bỏ qua khi đọc), "Hướng dẫn" (tiếng Việt),
// "Danh mục" (giá trị đang có trong cửa hàng để điền cho khớp). Mọi ô Dữ liệu đặt sẵn định dạng Text ⇒ Excel không làm mất số 0 đầu SĐT/CCCD.
import ExcelJS from "exceljs";
import type { Tx } from "./db";
import { IMPORT_COLUMNS, IMPORT_KIND_INFO, IMPORT_MAX_ROWS, type ImportKind } from "@/lib/import/columns";

const HEAD_FILL = "FFDDE7F5";
const REQ_FILL = "FFFCE9D3";

async function refLists(tx: Tx, kind: ImportKind): Promise<{ title: string; values: string[] }[]> {
  if (kind === "customers") return [];
  {
    const m = await tx.q<{ brand: string; code: string; name: string }>(
      "SELECT b.name AS brand, m.code, m.name FROM public.watch_models m JOIN public.brands b ON b.id = m.brand_id WHERE m.is_active AND b.is_active ORDER BY b.name, m.name LIMIT 2000");
    const l = await tx.q<{ name: string }>("SELECT name FROM public.storage_locations WHERE is_active ORDER BY name");
    return [
      { title: "Hãng", values: m.map((x) => x.brand) },
      { title: "Mã loại", values: m.map((x) => x.code) },
      { title: "Tên loại", values: m.map((x) => x.name) },
      { title: "Vị trí kho", values: l.map((x) => x.name) },
      { title: "Tình trạng", values: ["Mới", "Cũ", "Đã sửa"] },
      { title: "Hạng tình trạng", values: ["A", "B", "C", "95%"] },
    ];
  }
}

const GUIDE: Record<ImportKind, string[]> = {
  customers: [
    "Mỗi khách một dòng ở sheet “Dữ liệu”, giữ nguyên dòng tiêu đề. Chỉ cột “Họ và tên” là bắt buộc; cột nào không có cứ để trống.",
    "Hai dòng có chữ [VÍ DỤ] chỉ để minh họa — có thể để nguyên (hệ thống tự bỏ qua) hoặc xóa.",
    "Tối đa 300 dòng mỗi lần. Hệ thống cho XEM TRƯỚC từng dòng (hợp lệ / lỗi kèm lý do / trùng) rồi bạn mới xác nhận ghi.",
    "SĐT trùng với khách có sẵn hoặc trùng trong tệp được báo “trùng” — mặc định bỏ qua, bạn có thể chọn nhập vẫn.",
  ],
  watches: [
    "Mỗi chiếc đồng hồ một dòng ở sheet “Dữ liệu”. Cột bắt buộc: Loại/Model, Tình trạng (và Vị trí kho nếu không chọn vị trí mặc định lúc nhập).",
    "Loại/Model phải khớp loại đã có (mã hoặc tên — xem sheet “Danh mục”). Chưa có thì tạo ở Đồng hồ → Loại & hãng, hoặc bật “tự tạo loại mới” lúc nhập (cần quyền quản lý danh mục; cần ghi cột Hãng).",
    "Hàng Cũ và Đã sửa luôn vào kho ở trạng thái “Chờ kiểm tra”: cần hạng tình trạng + ảnh mới chuyển sang “Sẵn sàng bán”.",
    "Serial trùng với chiếc đã có trong kho (cùng hãng) hoặc trùng trong tệp sẽ bị chặn. Để trống serial = đồng hồ không có serial.",
    "Giá niêm yết: số nguyên đồng, không âm, không số lẻ (7500000 hoặc 7.500.000). Hai dòng [VÍ DỤ] tự bị bỏ qua.",
  ],
};

export async function buildTemplate(tx: Tx, kind: ImportKind): Promise<{ buffer: Buffer; fileName: string }> {
  const cols = IMPORT_COLUMNS[kind];
  const info = IMPORT_KIND_INFO[kind];
  const wb = new ExcelJS.Workbook();
  wb.creator = "WatchFlow";
  const ws = wb.addWorksheet("Dữ liệu", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.required ? `${c.title} *` : c.title, key: c.key, width: c.width ?? 18, style: { numFmt: "@" } }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 30;
  cols.forEach((c, i) => {
    head.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? REQ_FILL : HEAD_FILL } };
  });
  for (const n of [0, 1]) {
    const row = ws.getRow(2 + n);
    cols.forEach((c, i) => {
      row.getCell(i + 1).value = c.examples[n as 0 | 1];
      row.getCell(i + 1).numFmt = "@";
      row.getCell(i + 1).font = { italic: true, color: { argb: "FF6B7280" } };
    });
  }
  // Định dạng Text cho các dòng trống (đủ số dòng tối đa mỗi lần)
  for (let r = 4; r <= IMPORT_MAX_ROWS + 3; r++) cols.forEach((_c, i) => { ws.getRow(r).getCell(i + 1).numFmt = "@"; });

  const g = wb.addWorksheet("Hướng dẫn");
  g.columns = [{ width: 24 }, { width: 10 }, { width: 28 }, { width: 100 }];
  g.getCell("A1").value = `Hướng dẫn nhập ${info.label.toLowerCase()} từ Excel`;
  g.getCell("A1").font = { bold: true, size: 14 };
  let r = 3;
  for (const t of GUIDE[kind]) {
    g.mergeCells(r, 1, r, 4);
    g.getCell(r, 1).value = `• ${t}`;
    g.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
    g.getRow(r).height = Math.max(18, Math.ceil(t.length / 120) * 18);
    r++;
  }
  r++;
  ["Cột", "Bắt buộc", "Ví dụ", "Giá trị chấp nhận / lưu ý"].forEach((t, i) => {
    const cell = g.getCell(r, i + 1);
    cell.value = t;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
  });
  r++;
  for (const c of cols) {
    g.getCell(r, 1).value = c.title;
    g.getCell(r, 1).font = { bold: true };
    g.getCell(r, 2).value = c.required ? "Có" : "";
    g.getCell(r, 3).value = c.examples[0].startsWith("[") ? "" : c.examples[0];
    g.getCell(r, 4).value = c.note;
    g.getCell(r, 4).alignment = { wrapText: true, vertical: "top" };
    g.getRow(r).height = Math.max(18, Math.ceil(c.note.length / 110) * 18);
    r++;
  }

  const lists = await refLists(tx, kind);
  const ref = wb.addWorksheet("Danh mục");
  if (!lists.length) ref.getCell(1, 1).value = "Không có danh mục tham chiếu cho loại này.";
  lists.forEach((l, i) => {
    ref.getColumn(i + 1).width = 24;
    const h = ref.getCell(1, i + 1);
    h.value = l.title;
    h.font = { bold: true };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    l.values.forEach((v, k) => { ref.getCell(2 + k, i + 1).value = v; });
  });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName: info.sheetFile };
}
