-- 0011_reports.sql — Báo cáo & tổng quan (M8, reports-and-dashboard): một định nghĩa — một hàm. Mọi hàm SECURITY DEFINER kiểm quyền
-- trong thân (thiếu quyền ⇒ WF-AUTH-FORBIDDEN, không trả 0); chứng từ voided/draft bị loại; ngày theo giờ VN.
-- rpt_dashboard (khóa theo quyền), rpt_revenue (R1), rpt_profit (R2), rpt_profit_lines (R2 chi tiết), rpt_moves (R3), rpt_stock_value (R4),
-- rpt_aging (R5), rpt_open_balances (R6), rpt_repair (R7), rpt_collections (R8), rpt_shrinkage (R10), rpt_warranty_expiring (R11).
-- R9 = rpt_collaborator (0008b); R12 = /audit. BR-SEC-02, BR-COST-06, BR-PAY-07, SC-10, SC-13. Idempotent.
BEGIN;

-- Nhóm theo kỳ
CREATE OR REPLACE FUNCTION app.rpt_bucket(d date, p_group text) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_group WHEN 'month' THEN date_trunc('month', d)::date WHEN 'quarter' THEN date_trunc('quarter', d)::date
                      WHEN 'year' THEN date_trunc('year', d)::date ELSE d END
$$;

-- Số liệu gốc theo khoảng ngày (dùng chung dashboard + R1/R2/R7/R8 — §2)
CREATE OR REPLACE FUNCTION app.rpt_base(p_from date, p_to date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  WITH sl AS (
    SELECT sl.*, s.doc_date, s.collaborator_id FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id
    WHERE s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to),
  rp AS (
    SELECT o.* FROM public.repair_orders o WHERE o.status = 'delivered' AND o.kind = 'customer' AND o.delivered_date BETWEEN p_from AND p_to),
  pay AS (
    SELECT * FROM public.payments WHERE status = 'posted' AND doc_date BETWEEN p_from AND p_to)
  SELECT jsonb_build_object(
    'salesRevenue', (SELECT coalesce(sum(shop_revenue_vnd), 0) FROM sl),
    'shopSalesRevenue', (SELECT coalesce(sum(shop_revenue_vnd) FILTER (WHERE collaborator_id IS NULL), 0) FROM sl),
    'collabSalesRevenue', (SELECT coalesce(sum(shop_revenue_vnd) FILTER (WHERE collaborator_id IS NOT NULL), 0) FROM sl),
    'repairRevenue', (SELECT coalesce(sum(revenue_vnd), 0) FROM rp),
    'invoiceCount', (SELECT count(DISTINCT sale_id) FROM sl),
    'unitsSold', (SELECT count(*) FROM sl WHERE line_type = 'watch'),
    'cogs', (SELECT coalesce(sum(c.cost_vnd), 0) FROM sl JOIN public.sale_line_costs c ON c.sale_line_id = sl.id),
    'repairPartsCost', (SELECT coalesce(sum(c.cost_vnd), 0) FROM rp JOIN public.repair_lines l ON l.order_id = rp.id JOIN public.repair_line_costs c ON c.repair_line_id = l.id WHERE rp.charge_mode = 'paid'),
    'warrantyCost', (SELECT coalesce(sum(c.cost_vnd), 0) FROM rp JOIN public.repair_lines l ON l.order_id = rp.id JOIN public.repair_line_costs c ON c.repair_line_id = l.id WHERE rp.charge_mode = 'warranty_free'),
    'collectionsIn', (SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0) FROM pay),
    'collectionsOut', (SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0) FROM pay),
    'cash', (SELECT coalesce(sum(CASE WHEN direction = 'in' THEN amount_vnd ELSE -amount_vnd END) FILTER (WHERE method = 'cash'), 0) FROM pay),
    'bankTransfer', (SELECT coalesce(sum(CASE WHEN direction = 'in' THEN amount_vnd ELSE -amount_vnd END) FILTER (WHERE method = 'bank_transfer'), 0) FROM pay),
    'otherIncome', (SELECT coalesce(sum(forfeited_vnd), 0) FROM public.reservations r WHERE r.status = 'forfeited'
                    AND (r.settled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_from AND p_to))
$$;

-- ===== Dashboard: chỉ trả khóa người dùng được phép (FR-DASH-11) =====
CREATE OR REPLACE FUNCTION app.rpt_dashboard(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE b jsonb := app.rpt_base(p_from, p_to); out jsonb := jsonb_build_object('from', p_from, 'to', p_to); v jsonb;
BEGIN
  IF app.current_user_id() IS NULL THEN PERFORM app.raise_wf('WF-AUTH-UNAUTHENTICATED', 'Cần đăng nhập.'); END IF;
  IF app.has_permission('report.sales') THEN
    out := out || jsonb_build_object('revenue', (b->>'salesRevenue')::bigint + (b->>'repairRevenue')::bigint, 'salesRevenue', b->'salesRevenue',
      'repairRevenue', b->'repairRevenue', 'invoiceCount', b->'invoiceCount', 'unitsSold', b->'unitsSold',
      'collections', (b->>'collectionsIn')::bigint - (b->>'collectionsOut')::bigint, 'cash', b->'cash', 'bankTransfer', b->'bankTransfer');
  END IF;
  IF app.has_permission('profit.view') THEN
    out := out || jsonb_build_object('cogs', b->'cogs', 'grossProfit',
      (b->>'salesRevenue')::bigint - (b->>'cogs')::bigint + (b->>'repairRevenue')::bigint - (b->>'repairPartsCost')::bigint - (b->>'warrantyCost')::bigint,
      'otherIncome', b->'otherIncome');
  END IF;
  IF app.has_any_permission(ARRAY['report.inventory','catalog.view']) THEN
    SELECT jsonb_build_object('unitsInStock', count(*) FILTER (WHERE status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting')),
      'unitsSellable', count(*) FILTER (WHERE status = 'in_stock'), 'unitsWithCollab', count(*) FILTER (WHERE status = 'with_collaborator'),
      'unitsInspecting', count(*) FILTER (WHERE status = 'inspecting'), 'unitsInRepair', count(*) FILTER (WHERE status = 'in_repair'),
      'agingUnits', count(*) FILTER (WHERE status = 'in_stock' AND app.today_vn() - stock_since > app.setting_int('inventory.aging_days', 90)))
    INTO v FROM public.watch_units;
    out := out || v;
    out := out || jsonb_build_object('partsLow', (SELECT count(*) FROM public.parts WHERE is_active AND qty_on_hand <= reorder_level));
  END IF;
  IF app.has_permission('cost.view') THEN
    SELECT jsonb_build_object('stockValueUnits', coalesce(sum(c.cost_vnd), 0), 'stockValueAtCollab', coalesce(sum(c.cost_vnd) FILTER (WHERE u.status = 'with_collaborator'), 0))
    INTO v FROM public.watch_units u JOIN public.v_unit_costs c ON c.unit_id = u.id
    WHERE u.status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting');
    out := out || v || jsonb_build_object('stockValueParts', (SELECT coalesce(app.round_vnd(sum(p.qty_on_hand * pc.avg_cost)), 0) FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id));
  END IF;
  IF app.has_permission('debt.view') THEN
    out := out || (SELECT jsonb_build_object('customerDue', coalesce(sum(greatest(due, 0)), 0), 'depositsHeld', coalesce(sum(held) FILTER (WHERE doc_type = 'reservation'), 0),
      'repairPrepaid', coalesce(sum(held) FILTER (WHERE doc_type = 'repair'), 0), 'dueTodayCount', count(*) FILTER (WHERE due > 0 AND due_date <= app.today_vn()))
      FROM public.v_doc_balances);
  END IF;
  IF app.has_permission('collab.view') THEN
    out := out || jsonb_build_object('collabUnsettled', (SELECT coalesce(sum(sl.base_price_vnd), 0) FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id
      WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND sl.settlement_id IS NULL),
      'collabPendingOrders', (SELECT count(*) FROM public.sales WHERE collaborator_id IS NOT NULL AND status = 'draft'));
  END IF;
  IF app.has_any_permission(ARRAY['reservation.manage','sale.view']) THEN
    out := out || jsonb_build_object('reservationsOverdue', (SELECT count(*) FROM public.reservations WHERE status = 'expired' OR (status = 'active' AND hold_until < app.today_vn())),
      'reservationsActive', (SELECT count(*) FROM public.reservations WHERE status IN ('active','expired')));
  END IF;
  IF app.has_permission('repair.view') THEN
    out := out || jsonb_build_object('repairsOpen', (SELECT count(*) FROM public.repair_orders WHERE status IN ('received','inspecting','repairing','waiting_parts')),
      'repairsReady', (SELECT count(*) FROM public.repair_orders WHERE status = 'completed' AND kind = 'customer'));
  END IF;
  IF app.has_any_permission(ARRAY['warranty.view']) THEN
    out := out || jsonb_build_object('warrantiesExpiring', (SELECT count(*) FROM public.warranties WHERE status = 'active'
      AND end_date BETWEEN app.today_vn() AND app.today_vn() + app.setting_int('warranty.expiry_alert_days', 14)));
  END IF;
  IF app.has_permission('stocktake.manage') THEN
    out := out || jsonb_build_object('stocktakesOpen', (SELECT count(*) FROM public.stocktakes WHERE status = 'open'));
  END IF;
  RETURN out;
END $$;

-- R1 Doanh thu theo kỳ
CREATE OR REPLACE FUNCTION app.rpt_revenue(p_from date, p_to date, p_group text DEFAULT 'day') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('report.sales');
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'period'), '[]') FROM (
    SELECT jsonb_build_object('period', k, 'salesRevenue', sum(sr), 'repairRevenue', sum(rr), 'revenue', sum(sr) + sum(rr), 'invoiceCount', sum(ic),
      'avgPerInvoice', CASE WHEN sum(ic) > 0 THEN round(sum(sr) / sum(ic)) ELSE 0 END) x
    FROM (
      SELECT app.rpt_bucket(s.doc_date, p_group) k, sum(sl.shop_revenue_vnd) sr, 0::numeric rr, count(DISTINCT s.id) ic
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id WHERE s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to GROUP BY 1
      UNION ALL
      SELECT app.rpt_bucket(o.delivered_date, p_group), 0, sum(o.revenue_vnd), 0 FROM public.repair_orders o
      WHERE o.status = 'delivered' AND o.kind = 'customer' AND o.delivered_date BETWEEN p_from AND p_to GROUP BY 1) t GROUP BY k) q);
END $$;

-- R2 Lợi nhuận gộp theo kỳ
CREATE OR REPLACE FUNCTION app.rpt_profit(p_from date, p_to date, p_group text DEFAULT 'day') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('profit.view');
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'period'), '[]') FROM (
    SELECT jsonb_build_object('period', k, 'revenue', sum(rev), 'cogs', sum(cost), 'grossProfit', sum(rev) - sum(cost),
      'marginPct', CASE WHEN sum(rev) > 0 THEN round((sum(rev) - sum(cost)) * 100.0 / sum(rev), 2) ELSE 0 END) x
    FROM (
      SELECT app.rpt_bucket(s.doc_date, p_group) k, sl.shop_revenue_vnd rev, coalesce(c.cost_vnd, 0) cost
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id LEFT JOIN public.sale_line_costs c ON c.sale_line_id = sl.id
      WHERE s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to
      UNION ALL
      SELECT app.rpt_bucket(o.delivered_date, p_group), o.revenue_vnd,
             (SELECT coalesce(sum(c.cost_vnd), 0) FROM public.repair_lines l JOIN public.repair_line_costs c ON c.repair_line_id = l.id WHERE l.order_id = o.id)
      FROM public.repair_orders o WHERE o.status = 'delivered' AND o.kind = 'customer' AND o.delivered_date BETWEEN p_from AND p_to) t GROUP BY k) q);
END $$;

-- R2 chi tiết: từng dòng bán (phiếu, chiếc, thương hiệu, doanh thu, giá vốn, lãi)
CREATE OR REPLACE FUNCTION app.rpt_profit_lines(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('profit.view');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('docDate', s.doc_date, 'saleCode', s.code, 'item', coalesce(u.asset_code || ' · ' || m.name, p.code || ' · ' || p.name),
      'brand', b.name, 'channel', CASE WHEN s.collaborator_id IS NULL THEN 'Cửa hàng' ELSE 'CTV' END, 'revenue', sl.shop_revenue_vnd, 'cost', coalesce(c.cost_vnd, 0),
      'grossProfit', sl.shop_revenue_vnd - coalesce(c.cost_vnd, 0)) ORDER BY s.doc_date, s.code, sl.line_no), '[]')
    FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id LEFT JOIN public.sale_line_costs c ON c.sale_line_id = sl.id
    LEFT JOIN public.watch_units u ON u.id = sl.unit_id LEFT JOIN public.watch_models m ON m.id = u.model_id LEFT JOIN public.brands b ON b.id = u.brand_id
    LEFT JOIN public.parts p ON p.id = sl.part_id WHERE s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to);
END $$;

-- R3 Nhập & xuất hàng (giá trị chỉ khi cost.view)
CREATE OR REPLACE FUNCTION app.rpt_moves(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_cost boolean := app.has_permission('cost.view');
BEGIN
  PERFORM app.require_permission('report.inventory');
  RETURN jsonb_build_object(
    'inbound', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'source', src, 'receipts', n, 'units', units, 'partQty', pq, 'value', CASE WHEN v_cost THEN val END)), '[]') FROM (
      SELECT r.kind, coalesce(r.source_name, r.seller_name, '—') src, count(DISTINCT r.id) n,
             count(l.id) FILTER (WHERE l.line_type = 'watch') units, coalesce(sum(l.qty) FILTER (WHERE l.line_type = 'part'), 0) pq,
             sum(l.line_total_vnd + l.allocated_cost_vnd) val
      FROM public.purchase_receipts r JOIN public.purchase_lines l ON l.receipt_id = r.id
      WHERE r.status = 'confirmed' AND r.doc_date BETWEEN p_from AND p_to GROUP BY 1, 2) q),
    'outbound', jsonb_build_object(
      'unitsSold', (SELECT count(*) FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id WHERE s.status = 'confirmed' AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to),
      'partsSold', (SELECT coalesce(sum(sl.qty), 0) FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id WHERE s.status = 'confirmed' AND sl.line_type = 'part' AND s.doc_date BETWEEN p_from AND p_to),
      'assignedToCollab', (SELECT count(*) FROM public.collaborator_assignments a JOIN public.collaborator_assignment_lines l ON l.assignment_id = a.id WHERE a.status <> 'draft' AND a.status <> 'voided' AND a.doc_date BETWEEN p_from AND p_to),
      'returnedFromCollab', (SELECT count(*) FROM public.collaborator_assignment_lines l WHERE l.status = 'returned' AND (l.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_from AND p_to),
      'partsUsedInRepair', (SELECT coalesce(-sum(qty_delta), 0) FROM public.part_stock_movements WHERE kind IN ('repair_use','repair_return') AND (at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_from AND p_to),
      'writtenOff', (SELECT count(*) FROM public.unit_status_history WHERE to_status = 'written_off' AND (at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_from AND p_to)));
END $$;

-- R4 Tồn kho theo giá vốn (cost.view)
CREATE OR REPLACE FUNCTION app.rpt_stock_value() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('cost.view');
  RETURN jsonb_build_object(
    'units', (SELECT coalesce(jsonb_agg(jsonb_build_object('assetCode', u.asset_code, 'model', m.name, 'brand', b.name, 'serialNo', u.serial_no, 'status', u.status,
        'location', coalesce(l.name, CASE WHEN u.status = 'with_collaborator' THEN 'Ở CTV: ' || app.user_display_name(u.held_by_collaborator_id) END),
        'condition', u.condition, 'cost', coalesce(c.cost_vnd, 0), 'price', app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to),
        'expectedProfit', app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) - coalesce(c.cost_vnd, 0)) ORDER BY b.name, u.asset_code), '[]')
      FROM public.watch_units u JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
      LEFT JOIN public.storage_locations l ON l.id = u.location_id LEFT JOIN public.v_unit_costs c ON c.unit_id = u.id
      WHERE u.status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting')),
    'parts', (SELECT coalesce(jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'qty', p.qty_on_hand, 'avgCost', round(pc.avg_cost, 4),
        'value', app.round_vnd(p.qty_on_hand * pc.avg_cost)) ORDER BY p.code), '[]')
      FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.qty_on_hand > 0));
END $$;

-- R5 Hàng tồn lâu
CREATE OR REPLACE FUNCTION app.rpt_aging(p_days int DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_days int := coalesce(p_days, app.setting_int('inventory.aging_days', 90)); v_cost boolean := app.has_permission('cost.view');
BEGIN
  PERFORM app.require_permission('report.inventory');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('assetCode', u.asset_code, 'model', m.name, 'stockSince', u.stock_since, 'days', app.today_vn() - u.stock_since,
      'location', l.name, 'cost', CASE WHEN v_cost THEN c.cost_vnd END) ORDER BY u.stock_since), '[]')
    FROM public.watch_units u JOIN public.watch_models m ON m.id = u.model_id LEFT JOIN public.storage_locations l ON l.id = u.location_id
    LEFT JOIN public.v_unit_costs c ON c.unit_id = u.id WHERE u.status = 'in_stock' AND app.today_vn() - u.stock_since > v_days);
END $$;

-- R6 Phiếu còn nợ + cọc/tiền nhận trước đang giữ
CREATE OR REPLACE FUNCTION app.rpt_open_balances() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('debt.view');
  RETURN jsonb_build_object(
    'due', (SELECT coalesce(jsonb_agg(jsonb_build_object('docType', b.doc_type, 'docId', b.doc_id, 'code', b.code, 'docDate', b.doc_date, 'dueDate', b.due_date,
        'customer', c.full_name, 'phone', c.phone, 'payable', b.payable, 'paid', b.paid_net, 'due', b.due, 'overdue', b.due_date < app.today_vn()) ORDER BY b.due_date NULLS LAST), '[]')
      FROM public.v_doc_balances b LEFT JOIN public.customers c ON c.id = b.customer_id WHERE b.due > 0),
    'held', (SELECT coalesce(jsonb_agg(jsonb_build_object('docType', b.doc_type, 'docId', b.doc_id, 'code', b.code, 'customer', c.full_name, 'held', b.held)), '[]')
      FROM public.v_doc_balances b LEFT JOIN public.customers c ON c.id = b.customer_id WHERE b.held > 0));
END $$;

-- R7 Doanh thu sửa chữa
CREATE OR REPLACE FUNCTION app.rpt_repair(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_profit boolean := app.has_permission('profit.view');
BEGIN
  PERFORM app.require_permission('report.sales');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('code', o.code, 'deliveredDate', o.delivered_date, 'chargeMode', o.charge_mode,
      'customer', c.full_name, 'serviceRevenue', CASE WHEN o.charge_mode = 'paid' THEN (SELECT coalesce(sum(line_total_vnd), 0) FROM public.repair_lines WHERE order_id = o.id AND line_type <> 'part') ELSE 0 END,
      'partsRevenue', CASE WHEN o.charge_mode = 'paid' THEN (SELECT coalesce(sum(line_total_vnd), 0) FROM public.repair_lines WHERE order_id = o.id AND line_type = 'part') ELSE 0 END,
      'revenue', o.revenue_vnd,
      'partsCost', CASE WHEN v_profit AND o.charge_mode = 'paid' THEN pc.cost END, 'warrantyCost', CASE WHEN v_profit AND o.charge_mode = 'warranty_free' THEN pc.cost END,
      'grossProfit', CASE WHEN v_profit THEN o.revenue_vnd - pc.cost END) ORDER BY o.delivered_date, o.code), '[]')
    FROM public.repair_orders o LEFT JOIN public.customers c ON c.id = o.customer_id
    CROSS JOIN LATERAL (SELECT coalesce(sum(x.cost_vnd), 0) cost FROM public.repair_lines l JOIN public.repair_line_costs x ON x.repair_line_id = l.id WHERE l.order_id = o.id) pc
    WHERE o.status = 'delivered' AND o.kind = 'customer' AND o.delivered_date BETWEEN p_from AND p_to);
END $$;

-- R8 Tiền thu (thực thu theo cách & mục đích; thu nhập khác = cọc tịch thu)
CREATE OR REPLACE FUNCTION app.rpt_collections(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE b jsonb := app.rpt_base(p_from, p_to);
BEGIN
  PERFORM app.require_permission('report.sales');
  RETURN jsonb_build_object(
    'rows', (SELECT coalesce(jsonb_agg(jsonb_build_object('purpose', purpose, 'direction', direction, 'method', method, 'count', n, 'amount', s) ORDER BY purpose, method), '[]')
      FROM (SELECT purpose, direction, method, count(*) n, sum(amount_vnd) s FROM public.payments WHERE status = 'posted' AND doc_date BETWEEN p_from AND p_to GROUP BY 1, 2, 3) q),
    'byDay', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'net', s) ORDER BY d), '[]')
      FROM (SELECT doc_date d, sum(CASE WHEN direction = 'in' THEN amount_vnd ELSE -amount_vnd END) s FROM public.payments WHERE status = 'posted' AND doc_date BETWEEN p_from AND p_to GROUP BY 1) q),
    'totalIn', b->'collectionsIn', 'totalOut', b->'collectionsOut', 'net', (b->>'collectionsIn')::bigint - (b->>'collectionsOut')::bigint,
    'cash', b->'cash', 'bankTransfer', b->'bankTransfer', 'otherIncome', b->'otherIncome');
END $$;

-- R10 Hao hụt kiểm kê
CREATE OR REPLACE FUNCTION app.rpt_shrinkage(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_cost boolean := app.has_permission('cost.view');
BEGIN
  PERFORM app.require_permission('report.inventory');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('stocktake', s.code, 'date', (s.reconciled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
      'item', coalesce(u.asset_code, p.code), 'name', coalesce(m.name, p.name), 'diff', x.diff_qty, 'reason', x.reason_code, 'note', x.note,
      'loss', CASE WHEN v_cost THEN x.loss_vnd END) ORDER BY s.reconciled_at, s.code), '[]')
    FROM public.stocktakes s JOIN public.stocktake_lines x ON x.stocktake_id = s.id
    LEFT JOIN public.watch_units u ON u.id = x.unit_id LEFT JOIN public.watch_models m ON m.id = u.model_id LEFT JOIN public.parts p ON p.id = x.part_id
    WHERE s.status = 'reconciled' AND coalesce(x.diff_qty, 0) <> 0 AND (s.reconciled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_from AND p_to);
END $$;

-- R11 Bảo hành sắp hết hạn
CREATE OR REPLACE FUNCTION app.rpt_warranty_expiring(p_days int DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_days int := coalesce(p_days, app.setting_int('warranty.expiry_alert_days', 14));
BEGIN
  PERFORM app.require_permission('report.sales');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('code', w.code, 'kind', w.kind, 'endDate', w.end_date, 'daysLeft', w.end_date - app.today_vn(),
      'customer', c.full_name, 'phone', c.phone, 'item', coalesce(u.asset_code, concat_ws(' ', cw.brand_text, cw.model_text))) ORDER BY w.end_date), '[]')
    FROM public.warranties w LEFT JOIN public.customers c ON c.id = w.customer_id LEFT JOIN public.watch_units u ON u.id = w.unit_id
    LEFT JOIN public.customer_watches cw ON cw.id = w.customer_watch_id
    WHERE w.status = 'active' AND w.end_date BETWEEN app.today_vn() AND app.today_vn() + v_days);
END $$;

-- ===== Sở hữu / EXECUTE =====
ALTER FUNCTION app.rpt_bucket(date, text) OWNER TO wf_owner;
REVOKE ALL ON FUNCTION app.rpt_bucket(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.rpt_bucket(date, text) TO wf_app, wf_worker, wf_definer;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.rpt_base(date,date)','app.rpt_dashboard(date,date)','app.rpt_revenue(date,date,text)','app.rpt_profit(date,date,text)',
    'app.rpt_profit_lines(date,date)','app.rpt_moves(date,date)','app.rpt_stock_value()','app.rpt_aging(int)','app.rpt_open_balances()',
    'app.rpt_repair(date,date)','app.rpt_collections(date,date)','app.rpt_shrinkage(date,date)','app.rpt_warranty_expiring(int)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF f <> 'app.rpt_base(date,date)' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_app, wf_worker', f); END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.rpt_base(date,date) TO wf_definer;

COMMIT;
