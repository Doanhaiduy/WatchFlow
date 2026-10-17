-- 0009a_internal_repair_status.sql — Phiếu sửa nội bộ kết thúc ở completed (không "giao", không doanh thu) — khớp I12 và state-machines §4.
-- CQ-012. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_complete_repair(p_order uuid, p_unit_status text DEFAULT 'in_stock', p_condition text DEFAULT NULL,
                                                  p_grade text DEFAULT NULL, p_findings text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders; l record; v_total bigint; v_parts bigint := 0; v_other bigint := 0; u public.watch_units; n int;
BEGIN
  PERFORM app.require_permission('repair.update');
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO r FROM public.repair_orders WHERE id = p_order;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu sửa.'); END IF;
  IF r.unit_id IS NOT NULL AND r.kind = 'internal' THEN u := app.lock_unit(r.unit_id); END IF;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.repair_lines WHERE order_id = p_order AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  r := app.lock_repair(p_order);
  IF r.status NOT IN ('received','inspecting','repairing','waiting_parts') THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Phiếu không ở trạng thái hoàn thành được.'); END IF;
  SELECT count(*) INTO n FROM public.repair_lines WHERE order_id = p_order;
  IF n = 0 AND r.charge_mode = 'paid' AND r.kind = 'customer' THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu chưa có dòng dịch vụ/linh kiện nào.'); END IF;
  FOR l IN SELECT id FROM public.repair_lines WHERE order_id = p_order AND line_type = 'part' AND consumed_at IS NULL ORDER BY line_no LOOP
    PERFORM app.use_repair_line(l.id);
  END LOOP;
  PERFORM set_config('app.in_fn', 'on', true);
  SELECT coalesce(sum(line_total_vnd), 0) INTO v_total FROM public.repair_lines WHERE order_id = p_order;
  IF p_findings IS NOT NULL THEN UPDATE public.repair_orders SET findings = p_findings WHERE id = p_order; END IF;
  UPDATE public.repair_orders SET completed_at = now(), final_total_vnd = CASE WHEN r.kind = 'customer' AND r.charge_mode = 'paid' THEN v_total ELSE 0 END WHERE id = p_order;
  IF r.kind = 'internal' THEN
    SELECT coalesce(sum(c.cost_vnd), 0) INTO v_parts FROM public.repair_line_costs c JOIN public.repair_lines rl ON rl.id = c.repair_line_id WHERE rl.order_id = p_order;
    SELECT coalesce(sum(line_total_vnd), 0) INTO v_other FROM public.repair_lines WHERE order_id = p_order AND line_type IN ('other','service');
    -- Chi phí khác của sửa nội bộ = số tiền dòng (gia công ngoài…); ghi chốt vào repair_line_costs kind 'other'
    INSERT INTO public.repair_line_costs (repair_line_id, cost_vnd, kind)
    SELECT id, line_total_vnd, 'other' FROM public.repair_lines WHERE order_id = p_order AND line_type IN ('other','service') AND line_total_vnd > 0;
    IF v_parts > 0 THEN
      INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, ref_table, ref_id, reason, created_by)
      VALUES (r.unit_id, u.cost_cycle, 'repair_part', v_parts, 'repair_orders', p_order, 'Linh kiện sửa nội bộ ' || r.code, app.current_user_id());
    END IF;
    IF v_other > 0 THEN
      INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, ref_table, ref_id, reason, created_by)
      VALUES (r.unit_id, u.cost_cycle, 'repair_other', v_other, 'repair_orders', p_order, 'Chi phí khác sửa nội bộ ' || r.code, app.current_user_id());
    END IF;
    IF p_condition IS NOT NULL THEN
      UPDATE public.watch_units SET condition = p_condition, condition_grade = coalesce(p_grade, condition_grade) WHERE id = r.unit_id;
    END IF;
    IF coalesce(p_unit_status, 'in_stock') NOT IN ('in_stock','inspecting') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Trạng thái sau sửa không hợp lệ.'); END IF;
    PERFORM app.set_unit_status(r.unit_id, coalesce(p_unit_status, 'in_stock'), 'Hoàn thành sửa nội bộ ' || r.code, 'repair_orders', p_order);
  END IF;
  -- Nội bộ cũng dừng ở completed (không giao khách, không doanh thu — I12)
  PERFORM app.set_repair_status(p_order, 'completed', CASE WHEN r.kind = 'internal' THEN 'Sửa nội bộ: hoàn thành & đưa lại kho' END);
  PERFORM app.fn_emit_event('repair.completed', jsonb_build_object('repairId', p_order));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', 'completed',
    'finalTotal', CASE WHEN r.kind = 'customer' AND r.charge_mode = 'paid' THEN v_total ELSE 0 END, 'capitalized', v_parts + v_other);
END $$;
ALTER FUNCTION app.fn_complete_repair(uuid,text,text,text,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_complete_repair(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_complete_repair(uuid,text,text,text,text) TO wf_app;
COMMIT;
