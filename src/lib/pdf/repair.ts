"use client";
// PDF phiếu nhận máy sửa / phiếu giao máy sửa (A5). Không in giá vốn / lãi.
import type { RepairDetail } from "@/components/repairs/types";
import { statusInfo } from "@/components/ui/status";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import type { StoreInfo } from "@/lib/store-info";
import { C, FONT, baseDoc, buildPdfBlob, doubleRule, fileSlug, infoGrid, kvList, letterhead, money, sectionBar, signatures, th, tableLayout, type Content, type KV, type TableCell } from "./core";

const lineName = (l: RepairDetail["lines"][number]) => (l.lineType === "service" ? (l.serviceName ?? "Dịch vụ") : (l.description ?? "Khác"));

export function repairDocDefinition(r: RepairDetail, store: StoreInfo["store"], delivery: boolean) {
  const content: Content[] = [
    letterhead(
      { name: store.name || "WatchFlow", address: store.address, phone: store.phone, taxCode: store.taxCode },
      { kind: delivery ? "Phiếu giao máy sửa" : "Phiếu nhận máy sửa", code: r.code, date: formatDateTimeVn(delivery && r.deliveredAt ? r.deliveredAt : r.receivedAt).split(" ").pop() },
    ),
    doubleRule(),
    infoGrid([
      { k: "Khách hàng", v: r.customerName ?? "—" },
      { k: "Điện thoại", v: r.customerPhone ?? "" },
      { k: "Ngày nhận", v: formatDateTimeVn(r.receivedAt) },
      { k: delivery ? "Ngày giao" : "Hẹn trả", v: delivery ? (r.deliveredAt ? formatDateTimeVn(r.deliveredAt) : "—") : (r.expectedDate ? formatDateVn(r.expectedDate) : "—") },
    ]),
    sectionBar("Máy & yêu cầu"),
    infoGrid([
      { k: "Đồng hồ", v: `${r.watchLabel ?? "—"}${r.serialNo ? ` · SN ${r.serialNo}` : ""}` },
      { k: "Trạng thái", v: statusInfo("repair", r.status).label },
      { k: "Lỗi / yêu cầu của khách", v: r.complaint ?? "—" },
      { k: "Tình trạng lúc nhận", v: r.intakeCondition ?? "—" },
    ]),
  ];
  if (delivery) {
    const body: TableCell[][] = [[th("#", "center"), th("Hạng mục"), th("SL", "center"), th("Đơn giá", "right"), th("Thành tiền", "right")]];
    r.lines.forEach((l, i) =>
      body.push([
        { text: String(i + 1), alignment: "center", color: C.muted },
        { text: lineName(l) },
        { text: String(l.qty), alignment: "center" },
        { text: money(l.unitPrice), alignment: "right" },
        { text: money(l.lineTotal), alignment: "right", font: FONT.semi, color: C.ink },
      ]),
    );
    const total = r.chargeMode === "warranty_free" ? 0 : (r.finalTotal ?? r.linesTotal);
    const totals: KV[] = [{ k: r.chargeMode === "warranty_free" ? "Tổng cộng (miễn phí theo bảo hành)" : "Tổng cộng", v: money(total), bold: true }];
    content.push(
      sectionBar("Chi phí sửa chữa"),
      r.lines.length > 0 ? { table: { headerRows: 1, widths: [14, "*", 20, 62, 66], body, dontBreakRows: true }, layout: tableLayout } : { text: "Không có hạng mục tính phí.", color: C.muted },
      { margin: [0, 8, 0, 0], columns: [{ width: "*", text: "" }, { width: 210, ...(kvList(totals) as object) }] } as Content,
    );
    if (r.warranty) content.push({ text: `Bảo hành sau sửa: từ ${formatDateVn(r.warranty.startDate)} đến ${formatDateVn(r.warranty.endDate)}`, fontSize: 8.5, margin: [0, 6, 0, 0] });
    if (store.receiptFooter) content.push({ text: store.receiptFooter, alignment: "center", italics: true, fontSize: 8.5, color: C.muted, margin: [0, 8, 0, 0] });
  } else {
    if (store.repairTerms) content.push(sectionBar("Điều khoản nhận sửa"), { text: store.repairTerms, fontSize: 8, color: C.muted });
  }
  content.push(signatures([{ title: "Khách hàng", hint: "(Ký, ghi rõ họ tên)", name: r.customerName }, { title: "Nhân viên", hint: "(Ký, ghi rõ họ tên)", name: r.receivedByName }]));
  return baseDoc({ title: `${delivery ? "Phiếu giao máy sửa" : "Phiếu nhận máy sửa"} ${r.code}`, storeName: store.name || "WatchFlow" }, content);
}

export async function buildRepairPdf(r: RepairDetail, store: StoreInfo["store"], delivery: boolean) {
  const blob = await buildPdfBlob(repairDocDefinition(r, store, delivery));
  return { blob, filename: `${delivery ? "Phieu_giao_may" : "Phieu_nhan_may"}_${fileSlug(r.code)}.pdf`, title: `${delivery ? "Phiếu giao máy sửa" : "Phiếu nhận máy sửa"} ${r.code}` };
}
