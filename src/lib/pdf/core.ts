"use client";
// Lõi tạo PDF VECTOR tiếng Việt (chữ thật, chọn/tìm được, nhẹ) bằng pdfmake + font Be Vietnam Pro (OFL) nhúng từ /fonts/pdf (cùng máy chủ,
// không tải từ Internet). Port từ Lưu Xá (ref-sources/domus-francis/src/lib/pdf/core.ts), bỏ phần riêng của nhà thờ/lưu xá.
// Dựng ở TRÌNH DUYỆT bằng dynamic import để không phình bundle. Tài liệu PDF là "giấy in" nên dùng bảng màu cố định (không theo chế độ tối).
import type { Content, ContentTable, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

export const C = {
  accent: "#4140D2",
  accentDark: "#2E2DA3",
  tint: "#EEF1FB",
  tintLine: "#CBD0EE",
  ink: "#1B1B3A",
  text: "#2A2B4A",
  muted: "#575A7E",
  faint: "#8A8DAD",
  line: "#DDE0F0",
  zebra: "#F7F8FD",
  green: "#0B7A55",
  red: "#C7343A",
  amber: "#965F00",
};

export const FONT = { body: "BeVietnam", semi: "BeVietnamSemi", heavy: "BeVietnamHeavy" } as const;

// ---------------------------------------------------------------------
// Nạp pdfmake + font (một lần)
// ---------------------------------------------------------------------
type PdfMakeLib = typeof import("pdfmake/build/pdfmake");
let libPromise: Promise<PdfMakeLib> | null = null;

async function loadLib(): Promise<PdfMakeLib> {
  if (!libPromise) {
    libPromise = (async () => {
      const mod = (await import("pdfmake/build/pdfmake")) as unknown as { default?: PdfMakeLib } & PdfMakeLib;
      const lib = (mod.default ?? mod) as PdfMakeLib;
      const base = `${window.location.origin}/fonts/pdf/BeVietnamPro-`;
      lib.addFonts({
        [FONT.body]: { normal: `${base}Regular.ttf`, bold: `${base}Bold.ttf`, italics: `${base}Italic.ttf`, bolditalics: `${base}SemiBoldItalic.ttf` },
        [FONT.semi]: { normal: `${base}SemiBold.ttf`, bold: `${base}Bold.ttf`, italics: `${base}SemiBoldItalic.ttf`, bolditalics: `${base}SemiBoldItalic.ttf` },
        [FONT.heavy]: { normal: `${base}ExtraBold.ttf`, bold: `${base}ExtraBold.ttf`, italics: `${base}SemiBoldItalic.ttf`, bolditalics: `${base}SemiBoldItalic.ttf` },
      });
      return lib;
    })().catch((e) => {
      libPromise = null;
      throw e;
    });
  }
  return libPromise;
}

/** Chuẩn hóa chữ cho font PDF: NFC, thay mũi tên (font không có) bằng ›, bỏ emoji và ✓ ✗ ★. Không cắt khoảng trắng. */
function fixGlyphs(t: string): string {
  return t
    .normalize("NFC")
    .replace(/[→⟶]/g, "›")
    .replace(/←/g, "‹")
    .replace(/[↑↓]/g, "")
    .replace(/[✓✔✗✘]\s?/g, "")
    .replace(/[★☆]/g, "*")
    .replace(/(?:[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}|\u{200D})\s?/gu, "");
}

/** Duyệt toàn bộ nội dung, làm sạch mọi trường `text` (và chuỗi trần trong mảng). */
function sanitizeNode(n: unknown): unknown {
  if (typeof n === "string") return fixGlyphs(n);
  if (Array.isArray(n)) return n.map(sanitizeNode);
  if (n && typeof n === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      if (k === "text") out[k] = sanitizeNode(v);
      else if (typeof v === "object" && v !== null) out[k] = sanitizeNode(v);
      else out[k] = v;
    }
    return out;
  }
  return n;
}

/** Dựng PDF từ định nghĩa tài liệu ⇒ Blob (application/pdf). */
export async function buildPdfBlob(rawDef: TDocumentDefinitions): Promise<Blob> {
  const lib = await loadLib();
  const def: TDocumentDefinitions = { ...rawDef, content: sanitizeNode(rawDef.content) as TDocumentDefinitions["content"] };
  return (await lib.createPdf(def).getBlob()) as Blob;
}

const withExt = (name: string) => (name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`);

/** Tải một Blob về máy. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = withExt(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Trình duyệt có chia sẻ được TỆP (Web Share Level 2: điện thoại — Zalo, Messenger, Mail…) không. */
export function canSharePdf(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File([new Blob(["%PDF-"])], "x.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

/** Chia sẻ PDF qua hộp chia sẻ của hệ điều hành. Trả false nếu người dùng đóng hộp thoại (không phải lỗi); ném lỗi khi không hỗ trợ. */
export async function sharePdfBlob(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], withExt(filename), { type: "application/pdf" });
  if (!navigator.canShare?.({ files: [file] })) throw new Error("Thiết bị này không hỗ trợ chia sẻ tệp.");
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false;
    throw e;
  }
}

// ---------------------------------------------------------------------
// Tiện ích định dạng
// ---------------------------------------------------------------------
/** Tiền VND nguyên: 1.500.000 đ (chỉ để hiển thị; số tiền luôn do máy chủ tính). */
export const money = (v: number) => `${Math.round(v).toLocaleString("vi-VN")} đ`;

/** Tên tệp không dấu, không ký tự lạ. */
export const fileSlug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const nowText = () => {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---------------------------------------------------------------------
// Bố cục chung (A5 dọc — khổ phiếu giao khách)
// ---------------------------------------------------------------------
export type StoreHead = { name: string; address?: string; phone?: string; taxCode?: string };

export interface PageOptions {
  /** Tên tài liệu (metadata + đầu trang từ trang 2) */
  title: string;
  storeName: string;
  footerNote?: string;
}

const MARGIN: [number, number, number, number] = [30, 34, 30, 42];
export const INNER_W = 420 - MARGIN[0] - MARGIN[2];

/** Khung tài liệu A5: lề, chân trang có số trang, kiểu chữ mặc định. */
export function baseDoc(opts: PageOptions, content: Content[]): TDocumentDefinitions {
  return {
    pageSize: "A5",
    pageOrientation: "portrait",
    pageMargins: MARGIN,
    info: { title: opts.title, author: opts.storeName, creator: "WatchFlow", producer: "pdfmake" },
    defaultStyle: { font: FONT.body, fontSize: 9, color: C.text, lineHeight: 1.25 },
    footer: (page: number, pages: number) => ({
      margin: [MARGIN[0], 10, MARGIN[2], 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: INNER_W, y2: 0, lineWidth: 0.5, lineColor: C.line }] },
        {
          margin: [0, 4, 0, 0],
          columns: [
            { width: "*", text: opts.footerNote ?? `${opts.storeName} · in ngày ${nowText()}`, fontSize: 7, color: C.faint },
            { width: "auto", text: `Trang ${page}/${pages}`, fontSize: 7, color: C.muted, alignment: "right" },
          ],
        },
      ],
    }),
    styles: {
      h1: { font: FONT.heavy, fontSize: 15, color: C.ink, characterSpacing: 0.3 },
      h2: { font: FONT.heavy, fontSize: 11, color: C.ink },
      muted: { color: C.muted, fontSize: 8 },
      label: { color: C.muted, fontSize: 7.5 },
    },
    content,
  };
}

/** Đầu phiếu: tên cửa hàng + địa chỉ/ĐT/MST (trái), loại phiếu + mã + ngày (phải). */
export function letterhead(store: StoreHead, right: { kind: string; code: string; date?: string }): Content {
  const info = [store.address, store.phone ? `ĐT: ${store.phone}` : "", store.taxCode ? `MST: ${store.taxCode}` : ""].filter(Boolean);
  return {
    columns: [
      {
        width: "*",
        stack: [
          { text: store.name.toUpperCase(), font: FONT.heavy, fontSize: 11, color: C.ink },
          ...info.map((t) => ({ text: t, fontSize: 7.5, color: C.muted, margin: [0, 1, 0, 0] as [number, number, number, number] })),
        ],
      },
      {
        width: "auto",
        alignment: "right" as const,
        stack: [
          { text: right.kind.toUpperCase(), bold: true, fontSize: 8, color: C.accent, characterSpacing: 0.4 },
          { text: right.code, font: FONT.heavy, fontSize: 12, color: C.ink, margin: [0, 2, 0, 0] },
          ...(right.date ? [{ text: right.date, fontSize: 7.5, color: C.muted, margin: [0, 1, 0, 0] as [number, number, number, number] }] : []),
        ],
      },
    ],
    columnGap: 8,
  } as Content;
}

/** Đường kẻ đôi dưới đầu phiếu. */
export const doubleRule = (): Content => ({
  margin: [0, 7, 0, 8],
  canvas: [
    { type: "line", x1: 0, y1: 0, x2: INNER_W, y2: 0, lineWidth: 1.8, lineColor: C.accent },
    { type: "line", x1: 0, y1: 3.5, x2: INNER_W, y2: 3.5, lineWidth: 0.5, lineColor: C.accent },
  ],
});

/** Dải nổi bật (vd. BẢN IN LẠI). */
export function banner(text: string, color: string = C.red): Content {
  return {
    margin: [0, 0, 0, 7],
    table: { widths: ["*"], body: [[{ text, bold: true, alignment: "center", color, fontSize: 9.5, margin: [0, 3, 0, 3] }]] },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => color, vLineColor: () => color },
  } as ContentTable;
}

/** Thanh tiêu đề mục. */
export function sectionBar(text: string): Content {
  return {
    margin: [0, 9, 0, 4],
    table: { widths: ["*"], body: [[{ text: text.toUpperCase(), font: FONT.semi, fontSize: 8, color: C.ink, characterSpacing: 0.4, margin: [5, 3, 5, 3] }]] },
    layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2.5 : 0), vLineColor: () => C.accent, fillColor: () => C.tint },
    unbreakable: true,
  } as ContentTable;
}

/** Bố cục bảng chuẩn: tiêu đề nền nhạt, kẻ ngang mảnh. */
export const tableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0.7 : 0.35),
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i === 0 ? C.tintLine : C.line),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
  fillColor: (row: number, node: { table: { headerRows?: number } }) => ((node.table.headerRows ?? 0) > row ? C.tint : null),
};

export const th = (text: string, align: "left" | "right" | "center" = "left"): TableCell => ({ text, font: FONT.semi, fontSize: 7.5, color: C.accentDark, alignment: align });

export type KV = { k: string; v: string; bold?: boolean; color?: string };

/** Danh sách "nhãn … giá trị" (nhãn trái, giá trị phải). */
export function kvList(items: KV[], opts: { size?: number } = {}): Content {
  const size = opts.size ?? 9;
  return {
    table: {
      widths: ["*", "auto"],
      body: items.map((it) => [
        { text: it.k, fontSize: size, color: C.muted },
        { text: it.v, fontSize: size, alignment: "right", bold: !!it.bold, color: it.color ?? C.ink, font: it.bold ? FONT.semi : FONT.body },
      ]),
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 1.8, paddingBottom: () => 1.8 },
  } as ContentTable;
}

/** Lưới thông tin 2 cột "nhãn: giá trị" (bên trái/phải). */
export function infoGrid(items: Array<{ k: string; v: string }>): Content {
  const rows: TableCell[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i]!;
    const b = items[i + 1];
    const cell = (it?: { k: string; v: string }): TableCell =>
      it ? { stack: [{ text: it.k, fontSize: 7, color: C.muted }, { text: it.v || "—", fontSize: 9, color: C.ink }] } : { text: "" };
    rows.push([cell(a), cell(b)]);
  }
  return {
    table: { widths: ["*", "*"], body: rows, dontBreakRows: true },
    layout: { hLineWidth: (i: number, n: { table: { body: unknown[] } }) => (i === n.table.body.length ? 0 : 0.35), hLineColor: () => C.line, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 6, paddingTop: () => 3, paddingBottom: () => 3 },
  } as ContentTable;
}

/** Khối chữ ký nhiều cột. */
export function signatures(cols: Array<{ title: string; hint: string; name?: string | null }>): Content {
  return {
    unbreakable: true,
    margin: [0, 12, 0, 0],
    columns: cols.map((c) => ({
      width: "*",
      alignment: "center" as const,
      stack: [
        { text: c.title.toUpperCase(), font: FONT.semi, fontSize: 8, color: C.ink },
        { text: c.hint, italics: true, fontSize: 7, color: C.faint, margin: [0, 1, 0, 0] },
        { text: c.name ?? "", font: FONT.semi, fontSize: 9, color: C.ink, margin: [0, 38, 0, 0] },
      ],
    })),
  };
}

export type { Content, TableCell, TDocumentDefinitions };
