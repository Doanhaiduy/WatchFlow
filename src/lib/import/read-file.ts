"use client";
// Đọc tệp Excel/CSV ngay trong trình duyệt (máy chủ không bao giờ mở tệp .xlsx của người dùng ⇒ không có rủi ro zip-bomb/phân tích tệp độc hại phía máy chủ).
// Kiểm: kích thước ≤ 5 MB, đuôi .xlsx/.csv, magic bytes khớp đuôi. Máy chủ chỉ nhận JSON các dòng (≤ 300) rồi kiểm tra lại từng ô.
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, parseCsv, rowsFromTable, sniffFile, type ImportKind, type TableResult } from "./columns";

const MAX_SCAN_ROWS = 5000;

export async function readImportFile(file: File, kind: ImportKind): Promise<TableResult & { fileName: string }> {
  if (file.size === 0) throw new Error("Tệp rỗng.");
  if (file.size > IMPORT_MAX_FILE_BYTES) throw new Error("Tệp quá lớn (tối đa 5 MB).");
  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx");
  const isCsv = name.endsWith(".csv");
  if (!isXlsx && !isCsv) throw new Error("Chỉ nhận tệp .xlsx (Excel) hoặc .csv. Tệp .xls cũ: mở bằng Excel rồi “Lưu thành” .xlsx.");
  const buf = await file.arrayBuffer();
  const sniff = sniffFile(new Uint8Array(buf));
  if ((isXlsx && sniff !== "xlsx") || (isCsv && sniff !== "csv")) throw new Error("Nội dung tệp không đúng định dạng của đuôi tệp. Hãy dùng tệp mẫu hoặc lưu lại đúng định dạng.");
  let table: unknown[][];
  if (isCsv) {
    table = parseCsv(new TextDecoder("utf-8").decode(buf));
  } else {
    let wb: import("exceljs").Workbook;
    try {
      const ExcelJS = (await import("exceljs")).default;
      wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
    } catch {
      throw new Error("Không đọc được tệp Excel (tệp hỏng hoặc đặt mật khẩu).");
    }
    const sheets = wb.worksheets;
    const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
    const ws = sheets.find((s) => ["du lieu", "data"].includes(fold(s.name))) ?? sheets.find((s) => !["huong dan", "danh muc"].includes(fold(s.name))) ?? sheets[0];
    if (!ws) throw new Error("Tệp Excel không có sheet nào.");
    if (ws.rowCount > MAX_SCAN_ROWS) throw new Error(`Sheet “${ws.name}” có quá nhiều dòng (${ws.rowCount}). Mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} dòng dữ liệu.`);
    table = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).values as unknown[];
      table.push(Array.isArray(v) ? v.slice(1) : []);
    }
  }
  const res = rowsFromTable(kind, table);
  return { ...res, fileName: file.name };
}
