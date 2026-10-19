"use client";
// PDF phiếu bán hàng (A5). CHỈ dùng dữ liệu máy chủ đã lọc quyền; không có giá vốn/lãi/giá thu — phiếu giao khách. Hạn bảo hành in theo từng chiếc.
// Bản in lại có dải "BẢN IN LẠI (lần n)" như trang in.
import type { SaleDetail } from "@/components/trade/types";
import { formatDateVn } from "@/lib/dates";
import type { StoreInfo } from "@/lib/store-info";
import { C, FONT, baseDoc, banner, buildPdfBlob, doubleRule, fileSlug, infoGrid, kvList, letterhead, money, sectionBar, signatures, th, tableLayout, type Content, type KV, type TableCell } from "./core";

const lineTitle = (l: SaleDetail["lines"][number]) => [l.brandName, l.modelName].filter(Boolean).join(" ") || "Đồng hồ";
const lineSub = (l: SaleDetail["lines"][number]) => [l.assetCode, l.serialNo ? `SN ${l.serialNo}` : ""].filter(Boolean).join(" · ");

export function saleDocDefinition(sale: SaleDetail, store: StoreInfo["store"], reprint: { n: number } | null) {
  const body: TableCell[][] = [[th("#", "center"), th("Sản phẩm"), th("Bảo hành"), th("Thành tiền", "right")]];
  sale.lines.forEach((l, i) =>
    body.push([
      { text: String(i + 1), alignment: "center", color: C.muted },
      { stack: [{ text: lineTitle(l), font: FONT.semi, color: C.ink }, ...(lineSub(l) ? [{ text: lineSub(l), fontSize: 7.5, color: C.muted }] : [])] },
      { text: l.warrantyEnd ? `đến ${formatDateVn(l.warrantyEnd)}` : "Không", fontSize: 8.5 },
      { text: money(l.lineTotal), alignment: "right", font: FONT.semi, color: C.ink },
    ]),
  );
  const totals: KV[] = [{ k: "Tổng cộng", v: money(sale.grandTotal), bold: true }];

  const content: Content[] = [];
  if (reprint) content.push(banner(`BẢN IN LẠI (lần ${reprint.n})`));
  content.push(
    letterhead({ name: store.name || "WatchFlow", address: store.address, phone: store.phone, taxCode: store.taxCode }, { kind: "Phiếu bán hàng", code: sale.code, date: formatDateVn(sale.docDate) }),
    doubleRule(),
    infoGrid([
      { k: "Khách hàng", v: sale.customerName ?? "Khách lẻ" },
      { k: "Điện thoại", v: sale.customerPhone ?? "" },
    ]),
    sectionBar("Chi tiết"),
    { table: { headerRows: 1, widths: [14, "*", 70, 70], body, dontBreakRows: true }, layout: tableLayout },
    { margin: [0, 8, 0, 0], columns: [{ width: "*", text: "" }, { width: 210, ...(kvList(totals) as object) }] } as Content,
  );
  if (store.warrantyTerms && sale.lines.some((l) => l.warrantyEnd)) content.push(sectionBar("Điều khoản bảo hành"), { text: store.warrantyTerms, fontSize: 7.5, color: C.muted, margin: [0, 2, 0, 0] });
  if (store.receiptFooter) content.push({ text: store.receiptFooter, alignment: "center", italics: true, fontSize: 8.5, color: C.muted, margin: [0, 8, 0, 0] });
  content.push(signatures([{ title: "Khách hàng", hint: "(Ký, ghi rõ họ tên)", name: sale.customerName }, { title: "Người bán", hint: "(Ký, ghi rõ họ tên)", name: sale.confirmedByName }]));
  return baseDoc({ title: `Phiếu bán ${sale.code}`.trim(), storeName: store.name || "WatchFlow" }, content);
}

/** Dựng PDF phiếu bán ⇒ { blob, filename }. */
export async function buildSalePdf(sale: SaleDetail, store: StoreInfo["store"], reprint: { n: number } | null) {
  const blob = await buildPdfBlob(saleDocDefinition(sale, store, reprint));
  return { blob, filename: `Phieu_ban_${fileSlug(sale.code)}${reprint ? "_in_lai" : ""}.pdf`, title: `Phiếu bán ${sale.code}`.trim() };
}
