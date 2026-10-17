import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { hitDb } from "@/server/ratelimit";
import { PurchaseListQuery, KIND_LABELS } from "@/lib/types/purchases";

// Xuất Excel danh sách phiếu nhập + dòng (FR-PUR-09). Cần purchase.view + report.export; giới hạn 5 lần/giờ.
export const GET = api({ perm: ["purchase.view"], query: PurchaseListQuery }, async ({ query, db, user, can }) => {
  if (!can("report.export")) return NextResponse.json({ code: "WF-AUTH-FORBIDDEN", detail: "Bạn không có quyền xuất file." }, { status: 403 });
  await hitDb("export", user.userId);
  const rows = await db((tx) => {
    const p: unknown[] = [];
    const c: string[] = ["r.status <> 'draft'"];
    if (query.from) { p.push(query.from); c.push(`r.doc_date >= $${p.length}`); }
    if (query.to) { p.push(query.to); c.push(`r.doc_date <= $${p.length}`); }
    if (query.status) { p.push(query.status); c.push(`r.status = $${p.length}`); }
    return tx.q<Record<string, unknown>>(
      `SELECT r.code, r.kind, r.doc_date, r.status, coalesce(r.source_name, r.seller_name) AS source, l.line_no,
              coalesce(m.name, p.name) AS item, coalesce(u.asset_code, p.code) AS ref, l.serial_no, l.qty, l.unit_price_vnd, l.line_total_vnd,
              l.allocated_cost_vnd, r.grand_total_vnd
       FROM public.purchase_receipts r JOIN public.purchase_lines l ON l.receipt_id = r.id
       LEFT JOIN public.watch_models m ON m.id = l.model_id LEFT JOIN public.parts p ON p.id = l.part_id LEFT JOIN public.watch_units u ON u.id = l.unit_id
       WHERE ${c.join(" AND ")} ORDER BY r.doc_date, r.code, l.line_no LIMIT 20000`, p);
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Phiếu nhập");
  ws.columns = [
    { header: "Mã phiếu", key: "code", width: 15 }, { header: "Loại", key: "kind", width: 16 }, { header: "Ngày", key: "doc_date", width: 12 },
    { header: "Trạng thái", key: "status", width: 12 }, { header: "Nguồn / người bán", key: "source", width: 24 }, { header: "Dòng", key: "line_no", width: 6 },
    { header: "Hàng", key: "item", width: 30 }, { header: "Mã chiếc / LK", key: "ref", width: 14 }, { header: "Serial", key: "serial_no", width: 16 },
    { header: "SL", key: "qty", width: 6 }, { header: "Đơn giá", key: "unit_price_vnd", width: 14 }, { header: "Thành tiền", key: "line_total_vnd", width: 14 },
    { header: "Chi phí phân bổ", key: "allocated_cost_vnd", width: 14 }, { header: "Tổng phiếu", key: "grand_total_vnd", width: 14 },
  ];
  for (const r of rows) ws.addRow({ ...r, kind: KIND_LABELS[r.kind as string] ?? r.kind, status: r.status === "voided" ? "Đã hủy" : "Đã xác nhận" });
  ws.getRow(1).font = { bold: true };
  for (const k of ["unit_price_vnd", "line_total_vnd", "allocated_cost_vnd", "grand_total_vnd"]) ws.getColumn(k).numFmt = "#,##0";
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="phieu-nhap.xlsx"` },
  });
});
