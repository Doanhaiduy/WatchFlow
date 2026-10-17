import "server-only";
// Phiếu bán: lưu nháp (đầu + dòng + máy thu cũ), đọc chi tiết, xem trước tổng (giảm giá tổng phân bổ — cùng thuật toán SQL).
// Giá vốn/lãi CHỈ khi người gọi có cost.view / profit.view (BR-SALE-16, BR-COST-06).
import type { z } from "zod";
import type { Tx } from "./db";
import { ApiError } from "./errors";
import { allocate } from "@/lib/money";
import type { SaleBody } from "@/lib/types/sales";

type Body = z.infer<typeof SaleBody>;

export async function saveSaleDraft(tx: Tx, id: string | null, b: Body, version?: number | null): Promise<string> {
  let sid = id;
  if (!sid) {
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.sales (customer_id, doc_date, backdate_reason, reservation_id, order_discount_vnd, due_date, note, created_by)
       VALUES ($1, coalesce($2::date, app.today_vn()), $3,$4,$5,$6,$7, app.current_user_id()) RETURNING id`,
      [b.customerId ?? null, b.docDate ?? null, b.backdateReason ?? null, b.reservationId ?? null, b.orderDiscount, b.dueDate ?? null, b.note ?? null],
    );
    sid = r!.id;
  } else {
    const r = await tx.one(
      `UPDATE public.sales SET customer_id=$2, doc_date=coalesce($3::date, doc_date), backdate_reason=$4, reservation_id=$5, order_discount_vnd=$6,
              due_date=$7, note=$8 WHERE id=$1 AND status='draft' AND ($9::int IS NULL OR version=$9) RETURNING id`,
      [sid, b.customerId ?? null, b.docDate ?? null, b.backdateReason ?? null, b.reservationId ?? null, b.orderDiscount, b.dueDate ?? null, b.note ?? null, version ?? null],
    );
    if (!r) throw new ApiError(412, "WF-CONFLICT-VERSION", "Phiếu bán đã xác nhận hoặc vừa được người khác sửa. Hãy tải lại.");
    await tx.q("DELETE FROM public.sale_lines WHERE sale_id=$1", [sid]);
    await tx.q("DELETE FROM public.sale_trade_ins WHERE sale_id=$1", [sid]);
  }
  let no = 0;
  for (const l of b.lines) {
    no++;
    if (l.lineType === "watch") {
      await tx.q("INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, unit_price_vnd, note) VALUES ($1,$2,'watch',$3,1,$4,$5)",
        [sid, no, l.unitId, l.unitPrice, l.note ?? null]);
    } else {
      await tx.q("INSERT INTO public.sale_lines (sale_id, line_no, line_type, part_id, qty, unit_price_vnd, note) VALUES ($1,$2,'part',$3,$4,$5,$6)",
        [sid, no, l.partId, l.qty, l.unitPrice, l.note ?? null]);
    }
  }
  for (const t of b.tradeIns) {
    const { credit, ...draft } = t;
    await tx.q("INSERT INTO public.sale_trade_ins (sale_id, credit_vnd, draft_line) VALUES ($1,$2,$3)", [sid, credit, JSON.stringify(draft)]);
  }
  return sid!;
}

export async function getSale(tx: Tx, idOrCode: string, perms: { cost: boolean; profit: boolean; collab?: boolean; userId?: string }) {
  const s = await tx.one<Record<string, unknown>>(
    `SELECT s.id, s.code, s.status, s.customer_id AS "customerId", c.code AS "customerCode", c.full_name AS "customerName", c.phone AS "customerPhone",
            s.doc_date AS "docDate", s.reservation_id AS "reservationId", s.order_discount_vnd AS "orderDiscount", s.subtotal_list_vnd AS "subtotalList",
            s.discount_total_vnd AS "discountTotal", s.grand_total_vnd AS "grandTotal", s.trade_in_total_vnd AS "tradeInTotal",
            s.deposit_applied_vnd AS "depositApplied", s.cash_tendered_vnd AS "cashTendered", s.due_date AS "dueDate", s.note,
            s.confirmed_at AS "confirmedAt", s.voided_at AS "voidedAt", s.void_reason AS "voidReason", s.collaborator_id AS "collaboratorId", s.print_count AS "printCount",
            s.version, s.created_at AS "createdAt", app.user_display_name(s.created_by) AS "createdByName", app.user_display_name(s.confirmed_by) AS "confirmedByName"
     FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id WHERE s.id::text = $1 OR s.code = upper($1)`, [idOrCode]);
  if (!s) return null;
  const lines = await tx.q<Record<string, unknown>>(
    `SELECT sl.id, sl.line_no AS "lineNo", sl.line_type AS "lineType", sl.unit_id AS "unitId", u.asset_code AS "assetCode", u.serial_no AS "serialNo",
            u.condition, m.name AS "modelName", b.name AS "brandName", u.status AS "unitStatus",
            app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS "currentPrice",
            sl.part_id AS "partId", p.code AS "partCode", p.name AS "partName", p.sale_price_vnd AS "partPrice", sl.qty,
            sl.list_price_snapshot_vnd AS "listPrice", sl.unit_price_vnd AS "unitPrice", sl.line_discount_vnd AS "lineDiscount",
            sl.alloc_discount_vnd AS "allocDiscount", sl.line_total_vnd AS "lineTotal", sl.is_effective AS "isEffective", sl.note
            ${perms.cost ? `, (SELECT cost_vnd FROM public.sale_line_costs x WHERE x.sale_line_id = sl.id) AS "lockedCost",
               CASE WHEN sl.unit_id IS NOT NULL THEN (SELECT cost_vnd FROM public.v_unit_costs vc WHERE vc.unit_id = sl.unit_id)
                    ELSE (SELECT app.round_vnd(sl.qty * pc.avg_cost) FROM public.part_costs pc WHERE pc.part_id = sl.part_id) END AS "currentCost"` : ""}
     FROM public.sale_lines sl LEFT JOIN public.watch_units u ON u.id = sl.unit_id LEFT JOIN public.watch_models m ON m.id = u.model_id
     LEFT JOIN public.brands b ON b.id = u.brand_id LEFT JOIN public.parts p ON p.id = sl.part_id
     WHERE sl.sale_id = $1 ORDER BY sl.line_no`, [s.id]);
  const tradeIns = await tx.q(
    `SELECT ti.id, ti.credit_vnd AS credit, ti.draft_line AS "draftLine", ti.purchase_receipt_id AS "purchaseReceiptId",
            (SELECT u.asset_code FROM public.purchase_lines pl JOIN public.watch_units u ON u.id = pl.unit_id WHERE pl.receipt_id = ti.purchase_receipt_id LIMIT 1) AS "assetCode"
     FROM public.sale_trade_ins ti WHERE ti.sale_id = $1 ORDER BY ti.created_at`, [s.id]);
  const payments = await tx.q(
    `SELECT id, code, method, amount_vnd AS amount, doc_date AS "docDate", status, cash_tendered_vnd AS "cashTendered", void_reason AS "voidReason",
            created_at AS "createdAt", app.user_display_name(created_by) AS "createdByName"
     FROM public.payments WHERE doc_type = 'sale' AND doc_id = $1 ORDER BY created_at`, [s.id]);
  const warranties = await tx.q(
    `SELECT w.id, w.code, w.unit_id AS "unitId", w.start_date AS "startDate", w.end_date AS "endDate", w.status
     FROM public.warranties w WHERE w.sale_line_id IN (SELECT id FROM public.sale_lines WHERE sale_id = $1) ORDER BY w.code`, [s.id]);
  const bal = await tx.one(`SELECT payable, paid_net AS "paidNet", due FROM public.v_doc_balances WHERE doc_type='sale' AND doc_id=$1`, [s.id]);

  // Xem trước cho nháp: giá hiệu lực + phân bổ giảm giá tổng (máy chủ tính; client chỉ hiển thị)
  if (s.status === "draft" && lines.length) {
    for (const l of lines) l.listPrice = l.lineType === "watch" ? l.currentPrice : l.partPrice;
    const w = lines.map((l) => (l.unitPrice as number) * (l.qty as number));
    const disc = Math.min(s.orderDiscount as number, w.reduce((a, b) => a + b, 0));
    const al = allocate(disc, w);
    lines.forEach((l, i) => { l.allocDiscount = al[i]; l.lineTotal = w[i]! - al[i]!; });
    s.subtotalList = lines.reduce((a, l) => a + (l.listPrice as number) * (l.qty as number), 0);
    s.grandTotal = lines.reduce((a, l) => a + (l.lineTotal as number), 0);
    s.discountTotal = (s.subtotalList as number) - (s.grandTotal as number);
    s.tradeInTotal = tradeIns.reduce((a, t) => a + (t.credit as number), 0);
    // Cọc giữ hàng sẽ trừ khi xác nhận (BR-RSV-04): xem trước = min(cọc đang giữ, tổng − thu cũ)
    if (s.reservationId) {
      const h = await tx.one<{ held: number }>("SELECT held FROM public.v_doc_balances WHERE doc_type = 'reservation' AND doc_id = $1", [s.reservationId]);
      s.depositApplied = Math.max(0, Math.min(h?.held ?? 0, (s.grandTotal as number) - (s.tradeInTotal as number)));
    }
    s.payablePreview = (s.grandTotal as number) - (s.tradeInTotal as number) - ((s.depositApplied as number) ?? 0);
  }
  // Đơn CTV: giá thu, doanh thu cửa hàng (= giá thu), phần CTV hưởng — chỉ cost.view/collab.view hoặc chính CTV (hàm DB kiểm)
  let shopRevenue = s.grandTotal as number;
  if (s.collaboratorId && (perms.cost || perms.collab || s.collaboratorId === perms.userId)) {
    const cl = await tx.q<{ sale_line_id: string; base_price_vnd: number | null; shop_revenue_vnd: number; settlement_id: string | null }>(
      "SELECT * FROM app.fn_sale_line_collab($1)", [s.id]);
    const m = new Map(cl.map((c) => [c.sale_line_id, c]));
    shopRevenue = 0;
    for (const l of lines) {
      const c = m.get(l.id as string);
      l.basePrice = c?.base_price_vnd ?? null;
      l.collabEarn = c?.base_price_vnd != null ? (l.lineTotal as number) - c.base_price_vnd : null;
      l.settled = !!c?.settlement_id;
      shopRevenue += c?.base_price_vnd ?? 0;
    }
    s.shopRevenue = shopRevenue;
  }
  const subList = s.subtotalList as number;
  const discountPct = subList > 0 ? Math.round((((subList - (s.grandTotal as number)) * 10000) / subList)) / 100 : 0;
  let profit: number | undefined;
  if (perms.cost) {
    let cost = 0;
    for (const l of lines) cost += ((s.status === "draft" ? l.currentCost : l.lockedCost) as number) ?? 0;
    for (const l of lines) { l.cost = s.status === "draft" ? l.currentCost : l.lockedCost; delete l.currentCost; delete l.lockedCost; }
    if (perms.profit) profit = (s.collaboratorId ? shopRevenue : (s.grandTotal as number)) - cost;
  }
  for (const l of lines) { delete l.partPrice; }
  return { ...s, discountPct, lines, tradeIns, payments, warranties, balance: bal ?? null, ...(profit !== undefined ? { grossProfit: profit } : {}) };
}
