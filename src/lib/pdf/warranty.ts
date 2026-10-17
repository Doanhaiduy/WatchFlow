"use client";
// PDF phiếu bảo hành (A5) từ bản ghi bảo hành (GET /api/v1/warranties) + điều khoản bảo hành trong cài đặt cửa hàng.
import type { Warranty } from "@/components/trade/types";
import { formatDateVn } from "@/lib/dates";
import type { StoreInfo } from "@/lib/store-info";
import { C, baseDoc, banner, buildPdfBlob, doubleRule, fileSlug, infoGrid, letterhead, sectionBar, signatures, type Content } from "./core";

export function warrantyDocDefinition(w: Warranty, store: StoreInfo["store"]) {
  const watch = w.modelName ?? ([w.brandText, w.modelText].filter(Boolean).join(" ") || "Đồng hồ");
  const content: Content[] = [];
  if (w.effectiveStatus === "voided") content.push(banner("PHIẾU BẢO HÀNH ĐÃ HỦY"));
  else if (w.effectiveStatus === "expired") content.push(banner("ĐÃ HẾT HẠN BẢO HÀNH", C.amber));
  content.push(
    letterhead({ name: store.name || "WatchFlow", address: store.address, phone: store.phone, taxCode: store.taxCode }, { kind: "Phiếu bảo hành", code: w.code, date: `Đến ${formatDateVn(w.endDate)}` }),
    doubleRule(),
    sectionBar("Sản phẩm"),
    infoGrid([
      { k: "Đồng hồ", v: watch },
      { k: "Mã chiếc", v: w.assetCode ?? "" },
      { k: "Số serial", v: w.serialNo ?? "" },
      { k: "Phiếu bán", v: w.saleCode ?? "" },
    ]),
    sectionBar("Khách hàng & hiệu lực"),
    infoGrid([
      { k: "Khách hàng", v: w.customerName ?? "Khách lẻ" },
      { k: "Điện thoại", v: w.customerPhone ?? "" },
      { k: "Bắt đầu", v: formatDateVn(w.startDate) },
      { k: "Hết hạn", v: formatDateVn(w.endDate) },
    ]),
  );
  if (store.warrantyTerms) content.push(sectionBar("Điều khoản bảo hành"), { text: store.warrantyTerms, fontSize: 8.5, color: C.text });
  content.push(signatures([{ title: "Khách hàng", hint: "(Ký, ghi rõ họ tên)", name: w.customerName }, { title: "Đại diện cửa hàng", hint: "(Ký, đóng dấu)" }]));
  return baseDoc({ title: `Phiếu bảo hành ${w.code}`, storeName: store.name || "WatchFlow" }, content);
}

export async function buildWarrantyPdf(w: Warranty, store: StoreInfo["store"]) {
  const blob = await buildPdfBlob(warrantyDocDefinition(w, store));
  return { blob, filename: `Phieu_bao_hanh_${fileSlug(w.code)}.pdf`, title: `Phiếu bảo hành ${w.code}` };
}
