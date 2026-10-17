// Nhập Excel hàng loạt — định nghĩa cột + chuẩn hóa giá trị (dùng chung trình duyệt & máy chủ, KHÔNG phụ thuộc DB).
// Tên cột nhận cả tiếng Việt có/không dấu và vài từ đồng nghĩa; "Hãng" (thương hiệu) và "Hạng" (tình trạng) chỉ khác dấu nên khớp theo dấu trước.
// Mẫu port: ref-sources/domus-francis members-import-file.ts (đã đổi cột + bỏ phần ghi thành viên).

export const IMPORT_MAX_ROWS = 300;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_KINDS = ["customers", "watches", "parts"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_KIND_INFO: Record<ImportKind, { label: string; short: string; slug: string; sheetFile: string }> = {
  customers: { label: "Khách hàng", short: "Khách", slug: "khach", sheetFile: "Mau_nhap_khach_hang.xlsx" },
  watches: { label: "Đồng hồ tồn đầu kỳ", short: "Đồng hồ", slug: "dong-ho", sheetFile: "Mau_nhap_dong_ho_ton_dau.xlsx" },
  parts: { label: "Linh kiện (tồn đầu kỳ)", short: "Linh kiện", slug: "linh-kien", sheetFile: "Mau_nhap_linh_kien.xlsx" },
};

export type ImportColumn = {
  key: string;
  title: string;
  /** Tên khác (đã bỏ dấu, chữ thường, chỉ chữ-số cách nhau một dấu cách) */
  aliases: readonly string[];
  /** Tên khác phải khớp CÓ DẤU (chữ thường) — để phân biệt Hãng/Hạng */
  exact?: readonly string[];
  required?: boolean;
  /** Hai dòng ví dụ (giả) cho tệp mẫu */
  examples: readonly [string, string];
  note: string;
  width?: number;
};

export const CUSTOMER_COLUMNS: readonly ImportColumn[] = [
  { key: "fullName", title: "Họ và tên", required: true, aliases: ["ho ten", "ho va ten", "ten", "ten khach", "ten khach hang", "khach hang", "full name", "name"], examples: ["Nguyễn Văn Mẫu", "Trần Thị Ví Dụ"], note: "Bắt buộc, tối đa 120 ký tự.", width: 26 },
  { key: "phone", title: "Số điện thoại", aliases: ["sdt", "so dt", "dien thoai", "so dien thoai", "phone", "mobile", "di dong", "tel"], examples: ["0900 000 001", "+84 900 000 002"], note: "SĐT Việt Nam (10 số, 0 đầu hoặc +84). Excel làm mất số 0 đầu vẫn được nhận. Trùng SĐT với khách có sẵn/trong tệp ⇒ báo trùng, mặc định bỏ qua.", width: 18 },
  { key: "email", title: "Email", aliases: ["mail", "e mail", "thu dien tu", "email"], examples: ["mau@example.com", ""], note: "Tùy chọn.", width: 26 },
  { key: "address", title: "Địa chỉ", aliases: ["dia chi", "address"], examples: ["12 Đường Giả, Quận 1", ""], note: "Tùy chọn, tối đa 300 ký tự.", width: 36 },
  { key: "group", title: "Nhóm khách", aliases: ["nhom", "nhom khach", "loai khach", "phan loai", "group"], examples: ["Khách quen", ""], note: "Tên nhóm đã có (xem sheet “Danh mục”). Không khớp ⇒ để trống nhóm và cảnh báo.", width: 18 },
  { key: "note", title: "Ghi chú", aliases: ["ghi chu", "note", "ghi chu khac"], examples: ["[VÍ DỤ] Xóa dòng này trước khi nhập", "[VÍ DỤ] Xóa dòng này trước khi nhập"], note: "Tùy chọn, tối đa 1000 ký tự.", width: 34 },
  { key: "idNumber", title: "CCCD/CMND", aliases: ["cccd", "cmnd", "can cuoc", "can cuoc cong dan", "so cccd", "so cmnd", "cccd cmnd", "cmnd cccd", "so giay to", "giay to"], examples: ["", ""], note: "Tùy chọn. 6–20 chữ/số. Được mã hóa khi lưu (như khi tạo khách ở màn Khách hàng); không hiện lại trên màn xem trước.", width: 18 },
];

export const WATCH_COLUMNS: readonly ImportColumn[] = [
  { key: "brand", title: "Hãng", aliases: ["hang", "thuong hieu", "brand", "nhan hieu", "hang san xuat"], exact: ["hãng"], examples: ["Seiko", "Casio"], note: "Tên hãng đã có. Cần khi tên loại trùng giữa nhiều hãng, hoặc khi chọn “tự tạo loại mới”.", width: 16 },
  { key: "model", title: "Loại / Model", required: true, aliases: ["loai", "loai model", "loai mau", "model", "mau", "mau dong ho", "dong ho", "ten loai", "ten dong ho", "ma loai", "ma model", "ma", "ten"], examples: ["SEIKO-5-SRPD55", "Casio MTP-V001"], note: "Bắt buộc. Mã loại hoặc tên loại đã có (xem sheet “Danh mục”). Chưa có ⇒ tạo ở Đồng hồ → Loại & hãng (hoặc bật “tự tạo loại mới” khi nhập nếu bạn có quyền).", width: 26 },
  { key: "serial", title: "Serial", aliases: ["serial", "so serial", "seri", "so seri", "ma serial", "serial no", "sn"], examples: ["MAU-0001", "MAU-0002"], note: "Số serial. Để trống = đồng hồ không có serial (cảnh báo). Trùng serial trong kho (cùng hãng) hoặc trong tệp ⇒ báo lỗi.", width: 18 },
  { key: "condition", title: "Tình trạng", required: true, aliases: ["tinh trang", "tinh trang may", "condition", "moi cu", "trang thai may"], examples: ["Mới", "Cũ"], note: "Bắt buộc: Mới / Cũ / Đã sửa (làm mới). Hàng Cũ và Đã sửa luôn vào kho ở trạng thái “Chờ kiểm tra” (cần hạng + ảnh mới chuyển được sang Sẵn sàng bán).", width: 14 },
  { key: "grade", title: "Hạng tình trạng", aliases: ["hang tinh trang", "xep hang", "cap do", "grade", "do moi", "hang cu"], exact: ["hạng"], examples: ["", "B"], note: "Tùy chọn: A, B, C hoặc % mới (vd. 95%).", width: 16 },
  { key: "cost", title: "Giá vốn (giá thu)", required: true, aliases: ["gia von", "gia thu", "gia nhap", "gia mua", "gia von gia thu", "gia thu vao", "cost"], examples: ["6000000", "1200000"], note: "Bắt buộc. Số nguyên đồng, không âm (6000000 hoặc 6.000.000). Đây là giá vốn của chiếc.", width: 18 },
  { key: "listPrice", title: "Giá niêm yết", aliases: ["gia niem yet", "gia ban", "gia ban niem yet", "gia ban le", "list price"], examples: ["7500000", "1500000"], note: "Tùy chọn. Số nguyên đồng. Để trống = 0 (đặt giá sau ở màn đồng hồ).", width: 16 },
  { key: "location", title: "Vị trí kho", aliases: ["vi tri", "vi tri kho", "kho", "noi cat", "location"], examples: ["Tủ trưng bày 1", "Két sắt"], note: "Tên vị trí đã có (xem sheet “Danh mục”). Để trống ⇒ dùng vị trí mặc định chọn lúc nhập.", width: 20 },
  { key: "note", title: "Ghi chú", aliases: ["ghi chu", "note", "ghi chu khac", "mo ta"], examples: ["[VÍ DỤ] Xóa dòng này trước khi nhập", "[VÍ DỤ] Xóa dòng này trước khi nhập"], note: "Tùy chọn, tối đa 500 ký tự.", width: 34 },
];

export const PART_COLUMNS: readonly ImportColumn[] = [
  { key: "code", title: "Mã linh kiện", required: true, aliases: ["ma", "ma lk", "ma linh kien", "code", "sku"], examples: ["PIN-377", "KINH-SAP-28"], note: "Bắt buộc. Chữ, số và . _ / - (tối đa 41 ký tự). Mã đã có ⇒ báo trùng (mặc định bỏ qua).", width: 18 },
  { key: "name", title: "Tên linh kiện", required: true, aliases: ["ten", "ten lk", "ten linh kien", "name", "linh kien"], examples: ["Pin 377", "Kính sapphire 28mm"], note: "Bắt buộc, tối đa 160 ký tự.", width: 28 },
  { key: "category", title: "Danh mục", required: true, aliases: ["danh muc", "nhom", "nhom linh kien", "loai", "category"], examples: ["Pin", "Kính"], note: "Bắt buộc. Tên danh mục đã có (xem sheet “Danh mục”).", width: 18 },
  { key: "uom", title: "Đơn vị", aliases: ["don vi", "dvt", "don vi tinh", "unit", "uom"], examples: ["viên", "cái"], note: "Tùy chọn, mặc định “cái”.", width: 12 },
  { key: "qty", title: "Tồn đầu", aliases: ["ton dau", "ton dau ky", "ton", "ton kho", "so luong", "sl", "qty"], examples: ["50", "10"], note: "Số nguyên ≥ 0. 0/để trống = chỉ tạo linh kiện, không nhập kho.", width: 12 },
  { key: "cost", title: "Giá vốn (đ/đơn vị)", aliases: ["gia von", "gia nhap", "don gia", "gia mua", "gia thu", "cost"], examples: ["15000", "120000"], note: "Số nguyên đồng/đơn vị. Bắt buộc khi Tồn đầu > 0.", width: 18 },
  { key: "reorder", title: "Ngưỡng cảnh báo", aliases: ["nguong canh bao", "nguong", "ton toi thieu", "muc canh bao", "canh bao", "reorder", "min"], examples: ["10", "3"], note: "Tùy chọn. Tồn ≤ ngưỡng ⇒ cảnh báo sắp hết. Mặc định 0.", width: 16 },
  { key: "salePrice", title: "Giá bán", aliases: ["gia ban", "gia", "don gia ban", "sale price"], examples: ["30000", "250000"], note: "Tùy chọn. Số nguyên đồng. Mặc định 0.", width: 14 },
  { key: "note", title: "Ghi chú", aliases: ["ghi chu", "note", "mo ta", "quy cach"], examples: ["[VÍ DỤ] Xóa dòng này trước khi nhập", "[VÍ DỤ] Xóa dòng này trước khi nhập"], note: "Tùy chọn (lưu vào quy cách linh kiện mới).", width: 34 },
];

export const IMPORT_COLUMNS: Record<ImportKind, readonly ImportColumn[]> = { customers: CUSTOMER_COLUMNS, watches: WATCH_COLUMNS, parts: PART_COLUMNS };

/** Bỏ dấu tiếng Việt, đ→d, chữ thường, chỉ giữ chữ-số cách nhau một dấu cách */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const lowerNfc = (s: string) => s.normalize("NFC").replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function headerKey(cols: readonly ImportColumn[], header: string): string | null {
  const raw = lowerNfc(header);
  if (!raw) return null;
  const ex = cols.find((c) => c.exact?.includes(raw));
  if (ex) return ex.key;
  const f = foldText(header.replace(/\*/g, ""));
  if (!f) return null;
  return cols.find((c) => foldText(c.title) === f || c.aliases.includes(f))?.key ?? null;
}

export type TableRow = { line: number; cells: Record<string, string> };
export type TableResult = { rows: TableRow[]; unknownHeaders: string[]; skippedExamples: number; missingColumns: string[] };

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  if (typeof v === "number") return Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : String(v)) : "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: unknown }).text ?? "")).join("").trim();
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return cellText(o.text);
    if ("error" in o) return "";
    return "";
  }
  return String(v).trim();
}

/** Dòng ví dụ của tệp mẫu mở đầu một ô bằng "[VÍ DỤ]" — bị bỏ qua khi đọc */
const isExampleMark = (t: string) => /^\[\s*v[íi]\s*d[ụu]\s*\]/i.test(t.normalize("NFC").trim());

/** Bảng ô → các dòng theo tiêu đề cột. Dòng tiêu đề = dòng đầu (trong 15 dòng đầu) có ≥ 2 cột nhận ra và có ít nhất một cột bắt buộc. */
export function rowsFromTable(kind: ImportKind, table: unknown[][]): TableResult {
  const cols = IMPORT_COLUMNS[kind];
  const required = cols.filter((c) => c.required);
  let headerIdx = -1;
  let map: (string | null)[] = [];
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const m = (table[i] ?? []).map((h) => headerKey(cols, cellText(h)));
    const known = m.filter(Boolean);
    if (known.length >= 2 && required.some((c) => known.includes(c.key))) { headerIdx = i; map = m; break; }
  }
  if (headerIdx < 0) throw new Error(`Không thấy dòng tiêu đề ở đầu tệp (cần cột “${required[0]!.title}”…). Hãy dùng tệp mẫu để tải về.`);
  const seen = new Set<string>();
  const unknownHeaders: string[] = [];
  (table[headerIdx] ?? []).forEach((h, i) => {
    const t = cellText(h);
    if (map[i]) seen.add(map[i]!);
    else if (t) unknownHeaders.push(t);
  });
  const missingColumns = required.filter((c) => !seen.has(c.key)).map((c) => c.title);
  const rows: TableRow[] = [];
  let skippedExamples = 0;
  table.slice(headerIdx + 1).forEach((line, idx) => {
    const cells: Record<string, string> = {};
    let any = false;
    let example = false;
    (line ?? []).forEach((v, i) => {
      const t = cellText(v);
      if (!t) return;
      if (isExampleMark(t)) example = true;
      const k = map[i];
      if (k && !(k in cells)) { cells[k] = t; any = true; }
    });
    if (!any) return;
    if (example) { skippedExamples++; return; }
    rows.push({ line: headerIdx + 2 + idx, cells });
  });
  return { rows, unknownHeaders, skippedExamples, missingColumns };
}

/** CSV (có thể có BOM, dấu phẩy / chấm phẩy / tab, ô trong ngoặc kép). */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(String.fromCharCode(0xfeff)) ? text.slice(1) : text;
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => first.split(ch).length - 1;
  const delim = count(";") > count(",") && count(";") >= count("\t") ? ";" : count("\t") > count(",") ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const pushRow = () => {
    row.push(cur);
    cur = "";
    if (row.some((x) => x.trim())) out.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; pushRow(); }
    else cur += c;
  }
  if (cur !== "" || row.length) pushRow();
  return out;
}

// ---------- Chuẩn hóa giá trị ô (máy chủ dùng khi kiểm tra từng dòng) ----------

/** SĐT Việt Nam → chữ số bắt đầu bằng 0 (10 số di động, 10–11 số cố định). Thiếu số 0 đầu (Excel hay bỏ) thì thêm lại. */
export function normalizePhoneVN(raw: string): { phone: string | null; error?: string; fixed?: boolean } {
  const s = raw.trim();
  if (!s) return { phone: null };
  if (/[^\d\s+().-]/.test(s)) return { phone: null, error: "SĐT có ký tự lạ — chỉ gồm chữ số, dấu cách, + . - ( )" };
  let d = s.replace(/\D/g, "");
  let fixed = false;
  if (s.startsWith("+")) {
    if (!d.startsWith("84")) return { phone: null, error: "SĐT quốc tế không phải +84 (Việt Nam)" };
    d = "0" + d.slice(2);
  } else if (d.startsWith("84") && d.length >= 11) d = "0" + d.slice(2);
  else if (d.length === 9 && /^[35789]/.test(d)) { d = "0" + d; fixed = true; }
  if (!/^0\d{9,10}$/.test(d)) return { phone: null, error: "SĐT không hợp lệ (cần 10 chữ số, bắt đầu bằng 0)" };
  return { phone: d, fixed };
}

/** Tiền VND nguyên: "6000000", "6.000.000", "6,000,000", "6 000 000", "6000000đ". Không nhận số lẻ/âm. */
export function parseMoneyVnd(raw: string): { value: number | null; error?: string } {
  let s = raw.trim().replace(/\s+/g, "").replace(/(vnđ|vnd|đ|d)$/i, "");
  if (!s) return { value: null };
  if (s.startsWith("-")) return { value: null, error: "Giá không được âm" };
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  if (/^\d+[.,]0+$/.test(s)) s = s.replace(/[.,]0+$/, ""); // Excel xuất 6000000.0
  if (!/^\d+$/.test(s)) return { value: null, error: "Không phải số nguyên đồng (vd. 6000000 hoặc 6.000.000)" };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n > 10_000_000_000_000) return { value: null, error: "Số tiền quá lớn" };
  return { value: n };
}

/** Số nguyên không âm (số lượng, ngưỡng) */
export function parseCount(raw: string, max = 100000): { value: number | null; error?: string } {
  const s = raw.trim().replace(/\s+/g, "").replace(/[.,]0+$/, "");
  if (!s) return { value: null };
  if (!/^\d+$/.test(s)) return { value: null, error: "Phải là số nguyên không âm" };
  const n = Number(s);
  if (n > max) return { value: null, error: `Quá lớn (tối đa ${max.toLocaleString("vi-VN")})` };
  return { value: n };
}

export type WatchCondition = "new" | "used" | "refurbished";
export function parseCondition(raw: string): WatchCondition | null {
  const f = foldText(raw);
  if (!f) return null;
  if (["moi", "new", "hang moi", "nguyen seal", "full box moi", "moi 100"].includes(f)) return "new";
  if (["cu", "used", "da qua su dung", "qua su dung", "like new", "secondhand", "2nd"].includes(f)) return "used";
  if (["da sua", "lam moi", "da sua lam moi", "refurbished", "refurb", "da lam moi", "sua lam moi"].includes(f)) return "refurbished";
  return null;
}

/** Hạng A/B/C hoặc "95%" (chấp nhận "95 %") */
export function parseGrade(raw: string): { value: string | null; error?: string } {
  const s = raw.trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return { value: null };
  if (/^[ABC]$/.test(s)) return { value: s };
  const m = /^(\d{1,3})%$/.exec(s);
  if (m && Number(m[1]) <= 100) return { value: `${Number(m[1])}%` };
  return { value: null, error: "Hạng phải là A, B, C hoặc % mới (vd. 95%)" };
}

/** CCCD/CMND: bỏ khoảng trắng; Excel làm mất số 0 đầu (11→12 số, 8→9 số) thì thêm lại. */
export function normalizeIdNumber(raw: string): { value: string | null; error?: string; fixed?: boolean } {
  let s = raw.replace(/[\s.-]/g, "").toUpperCase();
  if (!s) return { value: null };
  let fixed = false;
  if (/^\d+$/.test(s) && (s.length === 11 || s.length === 8)) { s = "0" + s; fixed = true; }
  if (!/^[0-9A-Z]{6,20}$/.test(s)) return { value: null, error: "Số giấy tờ phải gồm 6–20 chữ/số" };
  return { value: s, fixed };
}

/** Serial chuẩn hóa như app.norm_serial: bỏ khoảng trắng - _ / . và viết hoa */
export function normSerial(s: string | null | undefined): string | null {
  const x = (s ?? "").replace(/[\s\-_/.]/g, "").toUpperCase();
  return x || null;
}

/** Dò magic bytes: xlsx = ZIP ("PK\x03\x04"); csv = văn bản UTF-8 không chứa byte NUL */
export function sniffFile(bytes: Uint8Array): "xlsx" | "csv" | "unknown" {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "xlsx";
  if (bytes.length >= 2 && bytes[0] === 0xd0 && bytes[1] === 0xcf) return "unknown"; // .xls cũ
  const n = Math.min(bytes.length, 4096);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return "unknown";
  return "csv";
}
