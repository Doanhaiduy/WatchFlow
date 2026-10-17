-- 0008a_trade_in_internal.sql — Thu cũ đổi mới do nhân viên bán hàng xác nhận: fn_confirm_sale tạo phiếu nhập trade_in và gọi
-- fn_confirm_purchase / (khi hủy) fn_void_purchase trong CÙNG transaction. Quyền đã kiểm ở sale.confirm/sale.void; hàm nhập bỏ qua
-- kiểm quyền purchase.* CHỈ khi cờ app.internal_trade_in = đúng id phiếu VÀ phiếu là trade_in (wf_app không tạo được phiếu trade_in — RLS).
-- Đồng thời fn_confirm_purchase không xóa cờ app.in_fn của hàm gọi. BR-TRD-01/04. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_confirm_purchase(p_receipt uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  r public.purchase_receipts; l record; c record; u public.watch_units;
  v_ids uuid[]; v_w bigint[]; v_alloc bigint[]; v_line_alloc bigint[]; i int; n int;
  v_unit uuid; v_code text; v_brand uuid; v_avg numeric(14,4); v_qty int; v_lot numeric(14,4); v_units jsonb := '[]'; v_rebuy boolean;
  v_req_seller boolean; v_req_photo boolean; v_cust record;
BEGIN
  -- Phiếu trade_in do fn_confirm_sale tạo trong cùng transaction: quyền đã kiểm ở sale.confirm (cờ gắn đúng id phiếu)
  IF coalesce(current_setting('app.internal_trade_in', true), '') <> p_receipt::text
     OR (SELECT kind FROM public.purchase_receipts WHERE id = p_receipt) IS DISTINCT FROM 'trade_in' THEN
    PERFORM app.require_permission('purchase.confirm');
  END IF;
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '15s';
  -- Thứ tự khóa: chiếc (id tăng) → linh kiện (id tăng) → chứng từ (integrity §2)
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT rebuy_unit_id FROM public.purchase_lines WHERE receipt_id = p_receipt AND rebuy_unit_id IS NOT NULL) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.purchase_lines WHERE receipt_id = p_receipt AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  SELECT * INTO r FROM public.purchase_receipts WHERE id = p_receipt FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu nhập.'); END IF;
  IF r.status <> 'draft' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu nhập đã được xác nhận hoặc đã hủy.'); END IF;
  PERFORM app.check_doc_date(r.doc_date, r.backdate_reason);
  IF r.kind = 'purchase' AND nullif(btrim(coalesce(r.source_name, '')), '') IS NULL THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu mua vào cần ghi nguồn hàng.');
  END IF;
  IF r.kind IN ('customer_buyback','trade_in') THEN
    IF r.seller_customer_id IS NULL THEN PERFORM app.raise_wf('WF-PUR-SELLER-ID-REQUIRED', 'Thu mua từ khách cần chọn khách (người bán).'); END IF;
    v_req_seller := coalesce((app.setting('purchase.require_seller_id', 'true'))::boolean, true);
    v_req_photo := coalesce((app.setting('unit.require_photo_on_buyback', 'true'))::boolean, true);
    SELECT full_name, phone, id_number_enc INTO v_cust FROM public.customers WHERE id = r.seller_customer_id;
    IF v_req_seller THEN
      IF v_cust.id_number_enc IS NULL OR v_cust.phone IS NULL THEN
        PERFORM app.raise_wf('WF-PUR-SELLER-ID-REQUIRED', 'Thu mua cần họ tên, SĐT và số CCCD của người bán.');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.files f WHERE f.kind = 'id_document' AND NOT f.is_deleted
                     AND ((f.entity_table = 'purchase_receipts' AND f.entity_id = p_receipt) OR (f.entity_table = 'customers' AND f.entity_id = r.seller_customer_id))) THEN
        PERFORM app.raise_wf('WF-PUR-SELLER-ID-REQUIRED', 'Thu mua cần ít nhất một ảnh giấy tờ của người bán.');
      END IF;
    END IF;
    IF v_req_photo AND NOT EXISTS (SELECT 1 FROM public.files f WHERE f.entity_table = 'purchase_receipts' AND f.entity_id = p_receipt
                                   AND f.kind IN ('condition','product','evidence') AND NOT f.is_deleted) THEN
      PERFORM app.raise_wf('WF-UNIT-PHOTO-REQUIRED', 'Thu mua cần ít nhất một ảnh của máy.');
    END IF;
    UPDATE public.purchase_receipts SET seller_name = v_cust.full_name, seller_phone = v_cust.phone WHERE id = p_receipt;
  END IF;
  SELECT count(*) INTO n FROM public.purchase_lines WHERE receipt_id = p_receipt;
  IF n = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu nhập chưa có dòng nào.'); END IF;

  -- Phân bổ từng chi phí độc lập rồi cộng (costing §3)
  SELECT array_agg(id ORDER BY line_no), array_agg(line_total_vnd ORDER BY line_no) INTO v_ids, v_w FROM public.purchase_lines WHERE receipt_id = p_receipt;
  v_line_alloc := array_fill(0::bigint, ARRAY[n]);
  FOR c IN SELECT * FROM public.purchase_costs WHERE receipt_id = p_receipt ORDER BY created_at, id LOOP
    v_alloc := app.allocate_vnd(c.amount_vnd, v_w, c.allocate_method);
    FOR i IN 1..n LOOP v_line_alloc[i] := v_line_alloc[i] + v_alloc[i]; END LOOP;
  END LOOP;

  PERFORM set_config('app.in_fn', 'on', true);
  v_code := app.fn_next_number('PN');
  FOR i IN 1..n LOOP
    SELECT * INTO l FROM public.purchase_lines WHERE id = v_ids[i];
    UPDATE public.purchase_lines SET allocated_cost_vnd = v_line_alloc[i] WHERE id = l.id;
    IF l.line_type = 'watch' THEN
      IF l.condition <> 'new' AND l.initial_status = 'in_stock' THEN
        IF l.condition_grade IS NULL THEN
          PERFORM app.raise_wf('WF-UNIT-GRADE-REQUIRED', format('Dòng %s: hàng cũ/đã sửa cần hạng tình trạng (hoặc chọn "Chờ kiểm tra").', l.line_no));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.files f WHERE f.entity_table = 'purchase_receipts' AND f.entity_id = p_receipt AND f.kind IN ('condition','product') AND NOT f.is_deleted) THEN
          PERFORM app.raise_wf('WF-UNIT-PHOTO-REQUIRED', format('Dòng %s: hàng cũ/đã sửa cần ảnh tình trạng trước khi bán (hoặc chọn "Chờ kiểm tra").', l.line_no));
        END IF;
      END IF;
      IF l.location_id IS NULL THEN PERFORM app.raise_wf('WF-VALIDATION', format('Dòng %s: chọn vị trí lưu kho.', l.line_no)); END IF;
      SELECT brand_id INTO v_brand FROM public.watch_models WHERE id = l.model_id;
      v_rebuy := l.rebuy_unit_id IS NOT NULL;
      IF v_rebuy THEN
        SELECT * INTO u FROM public.watch_units WHERE id = l.rebuy_unit_id;
        IF u.status <> 'sold' THEN
          PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', format('Dòng %s: chiếc %s không ở trạng thái đã bán nên không nhập lại được.', l.line_no, u.asset_code));
        END IF;
        UPDATE public.watch_units SET cost_cycle = cost_cycle + 1, condition = l.condition, condition_grade = l.condition_grade,
          condition_note = coalesce(l.condition_note, condition_note), list_price_vnd = coalesce(l.list_price_vnd, list_price_vnd),
          promo_price_vnd = NULL, promo_from = NULL, promo_to = NULL
        WHERE id = u.id;
        PERFORM app.set_unit_status(u.id, l.initial_status, 'Nhập lại (chu kỳ mới)', 'purchase_receipts', p_receipt, l.location_id);
        v_unit := u.id;
      ELSE
        IF l.has_serial AND app.norm_serial(l.serial_no) IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.watch_units w WHERE w.brand_id = v_brand AND w.serial_norm = app.norm_serial(l.serial_no) AND w.status <> 'cancelled') THEN
          PERFORM app.raise_wf('WF-UNIT-SERIAL-DUPLICATE', format('Dòng %s: serial %s đã có trong kho (cùng thương hiệu). Nếu là chiếc cửa hàng từng bán, hãy chọn "Nhập lại chiếc cũ".', l.line_no, l.serial_no));
        END IF;
        IF l.has_serial AND app.norm_serial(l.serial_no) IS NULL THEN
          PERFORM app.raise_wf('WF-VALIDATION', format('Dòng %s: nhập serial hoặc chọn "Không có serial".', l.line_no));
        END IF;
        PERFORM set_config('app.status_reason', CASE r.kind WHEN 'opening' THEN 'Tồn đầu kỳ' WHEN 'trade_in' THEN 'Thu cũ đổi mới' WHEN 'customer_buyback' THEN 'Thu mua từ khách' ELSE 'Nhập hàng' END, true);
        PERFORM set_config('app.status_ref_table', 'purchase_receipts', true);
        PERFORM set_config('app.status_ref_id', p_receipt::text, true);
        BEGIN
          INSERT INTO public.watch_units (asset_code, model_id, brand_id, serial_no, has_serial, condition, condition_grade, condition_note, status,
                                          location_id, list_price_vnd, created_by)
          VALUES (app.fn_next_number('DH', false, 6), l.model_id, v_brand, CASE WHEN l.has_serial THEN nullif(btrim(l.serial_no), '') END, l.has_serial,
                  l.condition, l.condition_grade, l.condition_note, l.initial_status, l.location_id, coalesce(l.list_price_vnd, 0), app.current_user_id())
          RETURNING id INTO v_unit;
        EXCEPTION WHEN unique_violation THEN
          PERFORM app.raise_wf('WF-UNIT-SERIAL-DUPLICATE', format('Dòng %s: serial %s vừa được nhập ở phiếu khác.', l.line_no, l.serial_no));
        END;
      END IF;
      SELECT * INTO u FROM public.watch_units WHERE id = v_unit;
      INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, ref_table, ref_id, reason, created_by)
      VALUES (v_unit, u.cost_cycle, 'purchase', l.unit_price_vnd, 'purchase_receipts', p_receipt, NULL, app.current_user_id());
      IF v_line_alloc[i] > 0 THEN
        INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, ref_table, ref_id, reason, created_by)
        VALUES (v_unit, u.cost_cycle, 'purchase_cost', v_line_alloc[i], 'purchase_receipts', p_receipt, 'Phân bổ chi phí nhập', app.current_user_id());
      END IF;
      UPDATE public.purchase_lines SET unit_id = v_unit WHERE id = l.id;
      v_units := v_units || jsonb_build_object('lineNo', l.line_no, 'unitId', v_unit, 'assetCode', u.asset_code, 'rebuy', v_rebuy);
    ELSE
      -- Linh kiện: bình quân gia quyền di động (costing §4)
      SELECT p.qty_on_hand, pc.avg_cost INTO v_qty, v_avg FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id;
      v_lot := round((l.line_total_vnd + v_line_alloc[i])::numeric / l.qty, 4);
      UPDATE public.part_costs SET avg_cost = CASE WHEN v_qty = 0 THEN v_lot ELSE round((v_qty * v_avg + l.qty * v_lot) / (v_qty + l.qty), 4) END,
        updated_at = now() WHERE part_id = l.part_id;
      UPDATE public.parts SET qty_on_hand = qty_on_hand + l.qty WHERE id = l.part_id;
      INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, reason, actor_id)
      VALUES (l.part_id, l.qty, v_lot, CASE WHEN r.kind = 'opening' THEN 'opening' ELSE 'purchase' END, v_qty, v_avg, 'purchase_receipts', p_receipt, NULL, app.current_user_id());
    END IF;
  END LOOP;

  UPDATE public.purchase_receipts SET status = 'confirmed', code = v_code, confirmed_at = now(), confirmed_by = app.current_user_id(),
    received_by = coalesce(received_by, created_by, app.current_user_id()),
    subtotal_vnd = (SELECT coalesce(sum(line_total_vnd), 0) FROM public.purchase_lines WHERE receipt_id = p_receipt),
    extra_cost_total_vnd = (SELECT coalesce(sum(amount_vnd), 0) FROM public.purchase_costs WHERE receipt_id = p_receipt),
    grand_total_vnd = (SELECT coalesce(sum(line_total_vnd), 0) FROM public.purchase_lines WHERE receipt_id = p_receipt)
                    + (SELECT coalesce(sum(amount_vnd), 0) FROM public.purchase_costs WHERE receipt_id = p_receipt)
  WHERE id = p_receipt;
  PERFORM app.fn_audit_event('purchase.confirmed', 'purchase_receipts', p_receipt::text, NULL, jsonb_build_object('code', v_code, 'units', v_units), NULL, 'info');
  PERFORM app.fn_emit_event('purchase.confirmed', jsonb_build_object('receiptId', p_receipt, 'code', v_code));
  PERFORM set_config('app.in_fn', CASE WHEN current_setting('app.internal_trade_in', true) = p_receipt::text THEN 'on' ELSE '' END, true);
  RETURN jsonb_build_object('id', p_receipt, 'code', v_code, 'status', 'confirmed', 'units', v_units);
END $$;
ALTER FUNCTION app.fn_confirm_purchase(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_confirm_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_confirm_purchase(uuid) TO wf_app, wf_definer;

CREATE OR REPLACE FUNCTION app.fn_void_purchase(p_receipt uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.purchase_receipts; v_reason text; l record; u public.watch_units; e record; mv record; v_dep text;
BEGIN
  IF coalesce(current_setting('app.internal_trade_in', true), '') <> p_receipt::text
     OR (SELECT kind FROM public.purchase_receipts WHERE id = p_receipt) IS DISTINCT FROM 'trade_in' THEN
    PERFORM app.require_permission('purchase.void');
  END IF;
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.purchase_lines WHERE receipt_id = p_receipt AND unit_id IS NOT NULL) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.purchase_lines WHERE receipt_id = p_receipt AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  SELECT * INTO r FROM public.purchase_receipts WHERE id = p_receipt FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu nhập.'); END IF;
  IF r.status <> 'confirmed' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Chỉ hủy được phiếu nhập đã xác nhận (nháp thì xóa).'); END IF;
  IF r.kind = 'trade_in' AND coalesce(current_setting('app.void_trade_in', true), '') <> 'on' THEN
    PERFORM app.raise_wf('WF-PUR-HAS-DEPENDENTS', 'Phiếu thu cũ đổi mới chỉ hủy cùng phiếu bán.');
  END IF;
  -- Kiểm phụ thuộc
  FOR l IN SELECT * FROM public.purchase_lines WHERE receipt_id = p_receipt ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
      IF l.rebuy_unit_id IS NOT NULL THEN
        v_dep := format('chiếc %s là chiếc nhập lại (chu kỳ mới) — điều chỉnh giá vốn thay vì hủy', u.asset_code);
      ELSIF u.status NOT IN ('in_stock','inspecting') OR EXISTS (
          SELECT 1 FROM public.unit_status_history h WHERE h.unit_id = u.id AND h.to_status NOT IN ('in_stock','inspecting')) THEN
        v_dep := format('chiếc %s đã phát sinh giao dịch (giữ/bán/giao CTV/sửa/thanh lý)', u.asset_code);
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.part_stock_movements m WHERE m.part_id = l.part_id AND m.at > r.confirmed_at
                 AND NOT coalesce(m.ref_table = 'purchase_receipts' AND m.ref_id = p_receipt, false)) THEN
        v_dep := format('linh kiện dòng %s đã có xuất/nhập sau phiếu này', l.line_no);
      END IF;
    END IF;
    IF v_dep IS NOT NULL THEN PERFORM app.raise_wf('WF-PUR-HAS-DEPENDENTS', 'Không thể hủy phiếu nhập: ' || v_dep || '.'); END IF;
  END LOOP;
  PERFORM set_config('app.in_fn', 'on', true);
  FOR l IN SELECT * FROM public.purchase_lines WHERE receipt_id = p_receipt ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      PERFORM app.set_unit_status(l.unit_id, 'cancelled', v_reason, 'purchase_receipts', p_receipt);
      FOR e IN SELECT * FROM public.unit_cost_entries WHERE unit_id = l.unit_id AND ref_table = 'purchase_receipts' AND ref_id = p_receipt AND amount_vnd > 0 LOOP
        INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, ref_table, ref_id, reason, created_by)
        VALUES (e.unit_id, e.cycle, e.kind, -e.amount_vnd, 'purchase_receipts', p_receipt, 'Đảo do hủy phiếu nhập: ' || v_reason, app.current_user_id());
      END LOOP;
    ELSE
      SELECT * INTO mv FROM public.part_stock_movements WHERE part_id = l.part_id AND ref_table = 'purchase_receipts' AND ref_id = p_receipt AND qty_delta > 0 ORDER BY at LIMIT 1;
      IF (SELECT qty_on_hand FROM public.parts WHERE id = l.part_id) < l.qty THEN
        PERFORM app.raise_wf('WF-PUR-HAS-DEPENDENTS', format('Không thể hủy: tồn linh kiện dòng %s không đủ để đảo.', l.line_no));
      END IF;
      UPDATE public.parts SET qty_on_hand = qty_on_hand - l.qty WHERE id = l.part_id;
      UPDATE public.part_costs SET avg_cost = mv.prev_avg, updated_at = now() WHERE part_id = l.part_id;
      INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, reason, actor_id)
      SELECT l.part_id, -l.qty, mv.unit_cost, 'purchase_void', p.qty_on_hand + l.qty, pc.avg_cost, 'purchase_receipts', p_receipt, v_reason, app.current_user_id()
      FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id;
    END IF;
  END LOOP;
  UPDATE public.purchase_receipts SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = v_reason WHERE id = p_receipt;
  PERFORM app.fn_audit_event('purchase.voided', 'purchase_receipts', p_receipt::text, jsonb_build_object('status', 'confirmed'), jsonb_build_object('status', 'voided'), v_reason, 'high');
  PERFORM app.fn_emit_event('purchase.voided', jsonb_build_object('receiptId', p_receipt));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_receipt, 'status', 'voided');
END $$;
ALTER FUNCTION app.fn_void_purchase(uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_void_purchase(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_void_purchase(uuid,text) TO wf_app, wf_definer;

CREATE OR REPLACE FUNCTION app.fn_confirm_sale(p_sale uuid, p_payments jsonb DEFAULT '[]', p_cash_tendered bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  s public.sales; l record; u public.watch_units; rsv public.reservations; t record; c record;
  n int; v_ids uuid[]; v_w bigint[]; v_alloc bigint[]; i int;
  v_sub_list bigint := 0; v_gross bigint := 0; v_grand bigint := 0; v_pct numeric; v_cost bigint; v_avg numeric(14,4); v_qty int;
  v_trade bigint := 0; v_applied bigint := 0; v_payable bigint; v_paid bigint := 0; v_pay jsonb; v_code text; v_months int; v_end date;
  v_rcpt uuid; v_conf jsonb; p jsonb; v_cash_line bigint := 0; v_cust record; v_walkin_debt boolean; v_due bigint; v_res jsonb := '[]';
BEGIN
  PERFORM app.require_permission('sale.confirm');
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '15s';
  -- 1. Khóa theo thứ tự: chiếc → linh kiện → giữ hàng → phiếu
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.sale_lines WHERE sale_id = p_sale AND unit_id IS NOT NULL
                                                 UNION SELECT (draft_line->>'rebuyUnitId')::uuid FROM public.sale_trade_ins WHERE sale_id = p_sale AND draft_line ? 'rebuyUnitId')
    ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.sale_lines WHERE sale_id = p_sale AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.reservations WHERE id = (SELECT reservation_id FROM public.sales WHERE id = p_sale) FOR UPDATE;
  SELECT * INTO s FROM public.sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu bán.'); END IF;
  IF s.status <> 'draft' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu bán đã được xác nhận hoặc đã hủy.'); END IF;
  IF s.collaborator_id IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Đơn của cộng tác viên xác nhận ở mục Cộng tác viên.'); END IF;
  PERFORM app.check_doc_date(s.doc_date, s.backdate_reason);
  SELECT count(*) INTO n FROM public.sale_lines WHERE sale_id = p_sale;
  IF n = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu bán chưa có hàng.'); END IF;
  IF s.reservation_id IS NOT NULL THEN SELECT * INTO rsv FROM public.reservations WHERE id = s.reservation_id; END IF;

  -- 2. Kiểm hàng & giá niêm yết hiệu lực
  FOR l IN SELECT * FROM public.sale_lines WHERE sale_id = p_sale ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
      IF NOT (u.status = 'in_stock' OR (u.status = 'reserved' AND rsv.id IS NOT NULL AND rsv.unit_id = u.id AND rsv.status IN ('active','expired'))) THEN
        PERFORM app.raise_wf('WF-SALE-UNIT-UNAVAILABLE', format('Chiếc %s không còn sẵn sàng bán (đã bán, đang giữ cho khách khác hoặc đang ở CTV). Hãy bỏ chiếc này khỏi phiếu.', u.asset_code));
      END IF;
      UPDATE public.sale_lines SET list_price_snapshot_vnd = app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to, s.doc_date) WHERE id = l.id;
    ELSE
      SELECT qty_on_hand INTO v_qty FROM public.parts WHERE id = l.part_id;
      IF v_qty < l.qty THEN PERFORM app.raise_wf('WF-SALE-STOCK-INSUFFICIENT', format('Linh kiện dòng %s chỉ còn %s.', l.line_no, v_qty)); END IF;
      UPDATE public.sale_lines SET list_price_snapshot_vnd = (SELECT sale_price_vnd FROM public.parts WHERE id = l.part_id) WHERE id = l.id;
    END IF;
  END LOOP;
  IF rsv.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sale_lines WHERE sale_id = p_sale AND unit_id = rsv.unit_id) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu chuyển từ giữ hàng phải có chiếc đang giữ.');
  END IF;

  -- 3. Giảm giá tổng phân bổ theo giá trị dòng (BR-SALE-13) → line_total
  SELECT array_agg(id ORDER BY line_no), array_agg(unit_price_vnd * qty ORDER BY line_no) INTO v_ids, v_w FROM public.sale_lines WHERE sale_id = p_sale;
  SELECT sum(unit_price_vnd * qty) INTO v_gross FROM public.sale_lines WHERE sale_id = p_sale;
  IF s.order_discount_vnd > v_gross THEN PERFORM app.raise_wf('WF-VALIDATION', 'Giảm giá tổng lớn hơn tiền hàng.'); END IF;
  v_alloc := app.allocate_vnd(s.order_discount_vnd, v_w, 'by_value');
  PERFORM set_config('app.in_fn', 'on', true);
  FOR i IN 1..n LOOP
    UPDATE public.sale_lines SET alloc_discount_vnd = v_alloc[i],
      line_discount_vnd = (list_price_snapshot_vnd - unit_price_vnd) * qty,
      line_total_vnd = unit_price_vnd * qty - v_alloc[i], shop_revenue_vnd = unit_price_vnd * qty - v_alloc[i]
    WHERE id = v_ids[i];
  END LOOP;
  SELECT sum(list_price_snapshot_vnd * qty), sum(line_total_vnd) INTO v_sub_list, v_grand FROM public.sale_lines WHERE sale_id = p_sale;

  -- 4. Hạn mức giảm giá theo vai trò (BR-SALE-03): mức cao nhất trong các vai trò của người xác nhận
  SELECT coalesce(max(r.max_discount_pct), 0) INTO v_pct FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id AND r.is_active WHERE ur.user_id = app.current_user_id();
  IF v_sub_list > 0 AND (v_sub_list - v_grand) * 100 > v_pct * v_sub_list THEN
    PERFORM app.raise_wf('WF-SALE-DISCOUNT-LIMIT', format('Giảm %s%% vượt hạn mức %s%% của bạn. Hãy nhờ người có hạn mức cao hơn xác nhận.',
      to_char(round((v_sub_list - v_grand) * 100.0 / v_sub_list, 2), 'FM990D00'), to_char(v_pct, 'FM990D##')));
  END IF;

  -- 5. Chốt giá vốn + bán dưới giá vốn (BR-SALE-04, BR-COST-02)
  FOR l IN SELECT * FROM public.sale_lines WHERE sale_id = p_sale ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
      SELECT coalesce(sum(amount_vnd), 0) INTO v_cost FROM public.unit_cost_entries WHERE unit_id = u.id AND cycle = u.cost_cycle;
      INSERT INTO public.sale_line_costs (sale_line_id, cost_vnd, cost_cycle) VALUES (l.id, v_cost, u.cost_cycle);
    ELSE
      SELECT avg_cost INTO v_avg FROM public.part_costs WHERE part_id = l.part_id;
      v_cost := app.round_vnd(l.qty * v_avg);
      INSERT INTO public.sale_line_costs (sale_line_id, cost_vnd, cost_cycle) VALUES (l.id, v_cost, NULL);
    END IF;
    IF l.line_total_vnd < v_cost AND NOT app.has_permission('sale.below_cost') THEN
      PERFORM app.raise_wf('WF-SALE-BELOW-COST', 'Giá bán dòng ' || l.line_no || ' vượt quyền của bạn. Liên hệ quản lý để xác nhận.');
    END IF;
  END LOOP;

  -- 6. Thu cũ đổi mới (BR-TRD-01…04): sinh phiếu nhập trade_in, xác nhận trong cùng transaction
  FOR t IN SELECT * FROM public.sale_trade_ins WHERE sale_id = p_sale ORDER BY created_at, id LOOP
    v_trade := v_trade + t.credit_vnd;
  END LOOP;
  IF v_trade > v_grand THEN PERFORM app.raise_wf('WF-SALE-TRADEIN-EXCEEDS', 'Giá thu máy cũ không được lớn hơn tổng tiền phiếu bán.'); END IF;
  IF v_trade > 0 AND s.customer_id IS NULL THEN PERFORM app.raise_wf('WF-SALE-CUSTOMER-REQUIRED', 'Thu cũ đổi mới cần chọn khách hàng (người bán máy cũ).'); END IF;
  FOR t IN SELECT * FROM public.sale_trade_ins WHERE sale_id = p_sale ORDER BY created_at, id LOOP
    INSERT INTO public.purchase_receipts (kind, seller_customer_id, doc_date, note, received_by, created_by)
    VALUES ('trade_in', s.customer_id, s.doc_date, 'Thu cũ đổi mới (phiếu bán)', app.current_user_id(), app.current_user_id()) RETURNING id INTO v_rcpt;
    INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, model_id, serial_no, has_serial, condition, condition_grade, condition_note,
                                       initial_status, location_id, list_price_vnd, rebuy_unit_id, qty, unit_price_vnd)
    VALUES (v_rcpt, 1, 'watch', (t.draft_line->>'modelId')::uuid, nullif(t.draft_line->>'serialNo', ''), coalesce((t.draft_line->>'hasSerial')::boolean, true),
            coalesce(t.draft_line->>'condition', 'used'), nullif(t.draft_line->>'conditionGrade', ''), nullif(t.draft_line->>'conditionNote', ''),
            coalesce(t.draft_line->>'initialStatus', 'inspecting'), (t.draft_line->>'locationId')::uuid, nullif(t.draft_line->>'listPrice', '')::bigint,
            nullif(t.draft_line->>'rebuyUnitId', '')::uuid, 1, t.credit_vnd);
    -- Ảnh/giấy tờ đã tải lên phiếu bán (thực thể sales) chuyển sang phiếu nhập
    UPDATE public.files SET entity_table = 'purchase_receipts', entity_id = v_rcpt
    WHERE entity_table = 'sales' AND entity_id = p_sale AND kind IN ('id_document','condition','evidence','product');
    -- Mua lại đúng chiếc đã bán (BR-PUR-10): dòng bán cũ hết "hiệu lực"
    IF t.draft_line ? 'rebuyUnitId' THEN
      UPDATE public.sale_lines SET is_effective = false WHERE unit_id = (t.draft_line->>'rebuyUnitId')::uuid AND is_effective;
    END IF;
    PERFORM set_config('app.internal_trade_in', v_rcpt::text, true);
    v_conf := app.fn_confirm_purchase(v_rcpt);
    PERFORM set_config('app.internal_trade_in', '', true);
    PERFORM set_config('app.in_fn', 'on', true);
    UPDATE public.sale_trade_ins SET purchase_receipt_id = v_rcpt WHERE id = t.id;
    v_res := v_res || jsonb_build_object('tradeIn', v_conf);
  END LOOP;

  -- 7. Cọc giữ hàng trừ vào phiếu (BR-RSV-04)
  IF rsv.id IS NOT NULL THEN
    v_applied := (app.doc_payment_state('reservation', rsv.id, false)->>'refundable')::bigint;
    IF v_applied > v_grand - v_trade THEN
      PERFORM app.raise_wf('WF-RSV-SETTLE-MISMATCH', 'Tiền cọc lớn hơn số phải trả của phiếu. Hãy hoàn bớt cọc hoặc thêm hàng.');
    END IF;
    IF s.customer_id IS DISTINCT FROM rsv.customer_id THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu bán phải cùng khách với giữ hàng.'); END IF;
    UPDATE public.reservations SET applied_vnd = applied_vnd + v_applied, status = 'converted', sale_id = p_sale, settled_at = now(), settled_by = app.current_user_id()
    WHERE id = rsv.id;
  END IF;

  -- 8. Trạng thái chiếc / kho linh kiện / is_effective
  FOR l IN SELECT * FROM public.sale_lines WHERE sale_id = p_sale ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      PERFORM app.set_unit_status(l.unit_id, 'sold', 'Bán hàng', 'sales', p_sale);
      UPDATE public.sale_lines SET is_effective = true WHERE id = l.id;
    ELSE
      SELECT p.qty_on_hand, pc.avg_cost INTO v_qty, v_avg FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id;
      UPDATE public.parts SET qty_on_hand = qty_on_hand - l.qty WHERE id = l.part_id;
      INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, actor_id)
      VALUES (l.part_id, -l.qty, v_avg, 'sale', v_qty, v_avg, 'sales', p_sale, app.current_user_id());
    END IF;
  END LOOP;

  -- 9. Phiếu → confirmed (trước khi ghi thanh toán: thanh toán chỉ nhận phiếu đã xác nhận)
  v_code := app.fn_next_number('HD');
  UPDATE public.sales SET status = 'confirmed', code = v_code, confirmed_at = now(), confirmed_by = app.current_user_id(),
    subtotal_list_vnd = v_sub_list, discount_total_vnd = v_sub_list - v_grand, grand_total_vnd = v_grand,
    trade_in_total_vnd = v_trade, deposit_applied_vnd = v_applied, cash_tendered_vnd = p_cash_tendered
  WHERE id = p_sale;
  v_payable := v_grand - v_trade - v_applied;

  -- 10. Thanh toán (BR-SALE-06): nhiều dòng, tổng ≤ phải thu; tiền khách đưa chỉ gắn dòng tiền mặt
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(p_payments, '[]')) LOOP
    IF (p->>'amount')::bigint > 0 THEN
      v_pay := app.fn_record_payment('sale', p_sale, 'sale_receipt', p->>'method', (p->>'amount')::bigint, s.doc_date, NULL,
                                     CASE WHEN p->>'method' = 'cash' AND v_cash_line = 0 THEN p_cash_tendered END, s.backdate_reason);
      PERFORM set_config('app.in_fn', 'on', true);
      IF p->>'method' = 'cash' THEN v_cash_line := v_cash_line + 1; END IF;
      v_paid := v_paid + (p->>'amount')::bigint;
    END IF;
  END LOOP;
  v_due := v_payable - v_paid;

  -- 11. Còn nợ ⇒ bắt buộc khách có SĐT (BR-SALE-07)
  IF v_due > 0 THEN
    v_walkin_debt := coalesce((app.setting('sales.allow_walkin_debt', 'false'))::boolean, false);
    SELECT id, phone INTO v_cust FROM public.customers WHERE id = s.customer_id;
    IF NOT v_walkin_debt AND (v_cust.id IS NULL OR v_cust.phone IS NULL) THEN
      PERFORM app.raise_wf('WF-SALE-CUSTOMER-REQUIRED', 'Bán nợ cần chọn khách hàng có số điện thoại.');
    END IF;
    IF s.due_date IS NULL THEN
      UPDATE public.sales SET due_date = s.doc_date + app.setting_int('sales.default_due_days', 7) WHERE id = p_sale;
    END IF;
  END IF;

  -- 12. Bảo hành tự tạo cho mỗi dòng đồng hồ (BR-WAR-01)
  FOR l IN SELECT sl.*, w.condition FROM public.sale_lines sl JOIN public.watch_units w ON w.id = sl.unit_id WHERE sl.sale_id = p_sale AND sl.line_type = 'watch' LOOP
    v_months := app.setting_int('warranty.shop_months.' || l.condition, CASE WHEN l.condition = 'new' THEN 12 ELSE 3 END);
    IF v_months > 0 THEN
      v_end := (s.doc_date + make_interval(months => v_months))::date;
      INSERT INTO public.warranties (code, kind, unit_id, sale_line_id, customer_id, start_date, end_date, terms)
      VALUES (app.fn_next_number('BH'), 'sale', l.unit_id, l.id, s.customer_id, s.doc_date, v_end, app.setting('store.warranty_terms', '""') #>> '{}');
    END IF;
  END LOOP;

  PERFORM app.fn_audit_event('sale.confirmed', 'sales', p_sale::text, NULL, jsonb_build_object('code', v_code, 'grandTotal', v_grand, 'paid', v_paid), NULL, 'info');
  PERFORM app.fn_emit_event('sale.confirmed', jsonb_build_object('saleId', p_sale, 'code', v_code, 'grandTotal', v_grand));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_sale, 'code', v_code, 'status', 'confirmed', 'grandTotal', v_grand, 'tradeIn', v_trade, 'depositApplied', v_applied,
    'payable', v_payable, 'paid', v_paid, 'due', v_due, 'change', CASE WHEN p_cash_tendered IS NOT NULL THEN greatest(p_cash_tendered -
      coalesce((SELECT sum((x->>'amount')::bigint) FROM jsonb_array_elements(coalesce(p_payments, '[]')) x WHERE x->>'method' = 'cash'), 0), 0) ELSE 0 END,
    'extra', v_res);
END $$;
ALTER FUNCTION app.fn_confirm_sale(uuid,jsonb,bigint) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_confirm_sale(uuid,jsonb,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_confirm_sale(uuid,jsonb,bigint) TO wf_app;

CREATE OR REPLACE FUNCTION app.fn_void_sale(p_sale uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s public.sales; v_reason text; l record; v_hours int; v_qty int; v_avg numeric(14,4); v_cost bigint; t record;
BEGIN
  PERFORM app.require_permission('sale.void');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.sale_lines WHERE sale_id = p_sale AND unit_id IS NOT NULL
      UNION SELECT pl.unit_id FROM public.sale_trade_ins ti JOIN public.purchase_lines pl ON pl.receipt_id = ti.purchase_receipt_id WHERE ti.sale_id = p_sale)
    ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.sale_lines WHERE sale_id = p_sale AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  SELECT * INTO s FROM public.sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu bán.'); END IF;
  IF s.status <> 'confirmed' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Chỉ hủy được phiếu đã xác nhận (nháp thì xóa).'); END IF;
  v_hours := app.setting_int('sales.void_window_hours', 24);
  IF app.now_ts() > s.confirmed_at + make_interval(hours => v_hours) THEN
    PERFORM app.raise_wf('WF-SALE-VOID-EXPIRED', format('Đã quá %s giờ kể từ lúc xác nhận, không thể hủy phiếu.', v_hours));
  END IF;
  IF s.deposit_applied_vnd > 0 THEN
    PERFORM app.raise_wf('WF-SALE-VOID-NOT-ALLOWED', 'Phiếu đã trừ tiền cọc giữ hàng, không hủy được.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  -- Thu cũ đổi mới: hủy phiếu nhập trade_in (chỉ khi máy thu về chưa phát sinh giao dịch)
  FOR t IN SELECT * FROM public.sale_trade_ins WHERE sale_id = p_sale AND purchase_receipt_id IS NOT NULL LOOP
    PERFORM set_config('app.void_trade_in', 'on', true);
    BEGIN
      PERFORM set_config('app.internal_trade_in', t.purchase_receipt_id::text, true);
      PERFORM app.fn_void_purchase(t.purchase_receipt_id, 'Hủy theo phiếu bán: ' || v_reason);
      PERFORM set_config('app.internal_trade_in', '', true);
    EXCEPTION WHEN raise_exception THEN
      PERFORM app.raise_wf('WF-SALE-VOID-NOT-ALLOWED', 'Máy thu cũ của phiếu đã phát sinh giao dịch khác, không hủy được phiếu bán.');
    END;
    PERFORM set_config('app.void_trade_in', '', true);
    PERFORM set_config('app.in_fn', 'on', true);
  END LOOP;
  FOR l IN SELECT sl.*, c.cost_vnd FROM public.sale_lines sl LEFT JOIN public.sale_line_costs c ON c.sale_line_id = sl.id WHERE sl.sale_id = p_sale ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      IF NOT l.is_effective THEN
        PERFORM app.raise_wf('WF-SALE-VOID-NOT-ALLOWED', 'Chiếc trong phiếu đã được cửa hàng mua lại, không hủy được phiếu.');
      END IF;
      UPDATE public.sale_lines SET is_effective = false WHERE id = l.id;
      PERFORM app.set_unit_status(l.unit_id, 'in_stock', 'Hủy phiếu bán: ' || v_reason, 'sales', p_sale);
    ELSE
      -- Trả linh kiện về kho theo giá vốn đã chốt (bình quân tính lại)
      SELECT p.qty_on_hand, pc.avg_cost INTO v_qty, v_avg FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id;
      v_cost := coalesce(l.cost_vnd, 0);
      UPDATE public.part_costs SET avg_cost = round((v_qty * v_avg + v_cost) / (v_qty + l.qty), 4), updated_at = now() WHERE part_id = l.part_id;
      UPDATE public.parts SET qty_on_hand = qty_on_hand + l.qty WHERE id = l.part_id;
      INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, reason, actor_id)
      VALUES (l.part_id, l.qty, round(v_cost::numeric / l.qty, 4), 'sale_void', v_qty, v_avg, 'sales', p_sale, v_reason, app.current_user_id());
    END IF;
  END LOOP;
  UPDATE public.payments SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = 'Hủy phiếu bán: ' || v_reason
  WHERE doc_type = 'sale' AND doc_id = p_sale AND status = 'posted';
  UPDATE public.warranties SET status = 'voided' WHERE sale_line_id IN (SELECT id FROM public.sale_lines WHERE sale_id = p_sale) AND status <> 'voided';
  UPDATE public.sales SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = v_reason WHERE id = p_sale;
  PERFORM app.fn_audit_event('sale.voided', 'sales', p_sale::text, jsonb_build_object('status', 'confirmed'), jsonb_build_object('status', 'voided'), v_reason, 'high');
  PERFORM app.fn_emit_event('sale.voided', jsonb_build_object('saleId', p_sale));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_sale, 'status', 'voided');
END $$;
ALTER FUNCTION app.fn_void_sale(uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_void_sale(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_void_sale(uuid,text) TO wf_app;
COMMIT;
