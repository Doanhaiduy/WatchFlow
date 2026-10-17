-- 0007b_void_purchase_null_fix.sql — Sửa fn_void_purchase: movement không có ref_table (điều chỉnh/kiểm kê) làm điều kiện NOT(...) = NULL
-- ⇒ bỏ sót phụ thuộc, cho hủy lô linh kiện đã xuất (SC-17 e). Dùng coalesce. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_void_purchase(p_receipt uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.purchase_receipts; v_reason text; l record; u public.watch_units; e record; mv record; v_dep text;
BEGIN
  PERFORM app.require_permission('purchase.void');
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
COMMIT;
