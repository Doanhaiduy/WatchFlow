"use client";
// PDF phiếu bán hàng (A5). CHỈ dùng dữ liệu máy chủ đã lọc quyền; KHÔNG bao giờ in giá vốn / lãi / giá thu CTV (cost, grossProfit,
// basePrice, collabEarn) — kể cả khi người dùng có quyền xem (phiếu giao khách). Bản in lại có dải "BẢN IN LẠI (lần n)" như trang in.
import type { SaleDetail } from "@/components/trade/types";
import { formatDateVn } from "@/lib/dates";
import { METHOD_LABELS } from "@/lib/types/payments";
import type { StoreInfo } from "@/lib/store-info";
import { C, FONT, baseDoc, banner, buildPdfBlob, doubleRule, fileSlug, infoGrid, kvList, letterhead, money, sectionBar, signatures, th, tableLayout, type Content, type KV, type TableCell } from "./core";

const lineTitle = (l: SaleDetail["lines"][number]) => (l.lineType === "watch" ? [l.brandName, l.modelName].filter(Boolean).join(" ") || "Đồng hồ" : `${l.partName ?? "Linh kiện"}`);
const lineSub = (l: SaleDetail["lines"][number]) => (l.lineType === "watch" ? [l.assetCode, l.serialNo ? `SN ${l.serialNo}` : ""].filter(Boolean).join(" · ") : (l.partCode ?? ""));

export function saleDocDefinition(sale: SaleDetail, store: StoreInfo["store"], reprint: { n: number } | null) {
  const posted = sale.payments.filter((p) => p.status === "posted");
  const due = sale.balance?.due ?? 0;
  const payable = sale.balance?.payable ?? sale.grandTotal;
  const body: TableCell[][] = [[th("#", "center"), th("Sản phẩm"), th("SL", "center"), th("Đơn giá", "right"), th("Thành tiền", "right")]];
  sale.lines.forEach((l, i) =>
    body.push([
      { text: String(i + 1), alignment: "center", color: C.muted },
      { stack: [{ text: lineTitle(l), font: FONT.semi, color: C.ink }, ...(lineSub(l) ? [{ text: lineSub(l), fontSize: 7.5, color: C.muted }] : [])] },
      { text: String(l.qty), alignment: "center" },
      { text: money(l.unitPrice), alignment: "right" },
      { text: money(l.lineTotal), alignment: "right", font: FONT.semi, color: C.ink },
    ]),
  );
  const totals: KV[] = [];
  if (sale.discountTotal > 0) totals.push({ k: "Giảm giá", v: `-${money(sale.discountTotal)}` });
  if (sale.tradeInTotal > 0) totals.push({ k: "Thu cũ đổi mới", v: `-${money(sale.tradeInTotal)}` });
  if (sale.depositApplied > 0) totals.push({ k: "Cọc đã trừ", v: `-${money(sale.depositApplied)}` });
  totals.push({ k: "Phải thu", v: money(payable), bold: true });
  for (const p of posted) totals.push({ k: `Đã thu — ${METHOD_LABELS[p.method]}`, v: money(p.amount) });
  if (sale.cashTendered && posted.some((p) => p.method === "cash")) totals.push({ k: "Khách đưa (tiền mặt)", v: money(sale.cashTendered) });
  if (due > 0) totals.push({ k: `Còn nợ${sale.dueDate ? ` (hẹn ${formatDateVn(sale.dueDate)})` : ""}`, v: money(due), bold: true, color: C.red });

  const content: Content[] = [];
  if (reprint) content.push(banner(`BẢN IN LẠI (lần ${reprint.n})`));
  content.push(
    letterhead({ name: store.name || "WatchFlow", address: store.address, phone: store.phone, taxCode: store.taxCode }, { kind: "Phiếu bán hàng", code: sale.code ?? "—", date: formatDateVn(sale.docDate) }),
    doubleRule(),
    infoGrid([
      { k: "Khách hàng", v: sale.customerName ?? "Khách lẻ" },
      { k: "Điện thoại", v: sale.customerPhone ?? "" },
    ]),
    sectionBar("Chi tiết"),
    { table: { headerRows: 1, widths: [14, "*", 20, 62, 66], body, dontBreakRows: true }, layout: tableLayout },
    { margin: [0, 8, 0, 0], columns: [{ width: "*", text: "" }, { width: 210, ...(kvList(totals) as object) }] } as Content,
  );
  if (sale.warranties.length > 0) {
    content.push(
      sectionBar("Bảo hành"),
      { ul: sale.warranties.map((w) => ({ text: `${w.code}: từ ${formatDateVn(w.startDate)} đến ${formatDateVn(w.endDate)}` })), fontSize: 8.5, markerColor: C.accent },
    );
  }
  if (store.warrantyTerms && sale.warranties.length > 0) content.push({ text: store.warrantyTerms, fontSize: 7.5, color: C.muted, margin: [0, 4, 0, 0] });
  if (store.receiptFooter) content.push({ text: store.receiptFooter, alignment: "center", italics: true, fontSize: 8.5, color: C.muted, margin: [0, 8, 0, 0] });
  content.push(signatures([{ title: "Khách hàng", hint: "(Ký, ghi rõ họ tên)", name: sale.customerName }, { title: "Người bán", hint: "(Ký, ghi rõ họ tên)", name: sale.confirmedByName ?? sale.createdByName }]));
  return baseDoc({ title: `Phiếu bán ${sale.code ?? ""}`.trim(), storeName: store.name || "WatchFlow" }, content);
}

/** Dựng PDF phiếu bán ⇒ { blob, filename }. */
export async function buildSalePdf(sale: SaleDetail, store: StoreInfo["store"], reprint: { n: number } | null) {
  const blob = await buildPdfBlob(saleDocDefinition(sale, store, reprint));
  return { blob, filename: `Phieu_ban_${fileSlug(sale.code ?? "nhap")}${reprint ? "_in_lai" : ""}.pdf`, title: `Phiếu bán ${sale.code ?? ""}`.trim() };
}
