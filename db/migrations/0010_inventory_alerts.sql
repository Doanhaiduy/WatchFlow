-- 0010_inventory_alerts.sql — Kiểm kê (stocktakes, stocktake_lines; fn_start/count/reconcile/cancel), bộ kiểm bất biến
-- app.fn_consistency_check() (I1–I12, integrity §7), cảnh báo hằng ngày app.fn_daily_alerts() (giữ hàng quá hạn, bảo hành sắp hết/hết hạn,
-- khách hẹn trả đến hạn, máy chưa lấy, linh kiện thấp, tồn lâu, chiếc ở CTV quá hạn) → notifications. BR-INV-01…04, BR-PART-04,
-- BR-RSV-02, BR-WAR-04, BR-REP-12, BR-COL-11, SC-14, CT-13. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.stocktakes (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code          text NOT NULL UNIQUE,
  scope         text NOT NULL CHECK (scope IN ('all_units','location','parts','all')),
  location_id   uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reconciled','cancelled')),
  started_by    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  started_at    timestamptz NOT NULL DEFAULT now(),
  reconciled_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reconciled_at timestamptz,
  doc_date      date NOT NULL DEFAULT app.today_vn(),
  note          text,
  CONSTRAINT stocktakes_location CHECK (scope <> 'location' OR location_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_stocktakes_status ON public.stocktakes (status);
CREATE INDEX IF NOT EXISTS ix_stocktakes_location ON public.stocktakes (location_id);
CREATE INDEX IF NOT EXISTS ix_stocktakes_started_by ON public.stocktakes (started_by);
CREATE INDEX IF NOT EXISTS ix_stocktakes_reconciled_by ON public.stocktakes (reconciled_by);

CREATE TABLE IF NOT EXISTS public.stocktake_lines (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  stocktake_id uuid NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('unit','part')),
  unit_id      uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  part_id      uuid REFERENCES public.parts(id) ON DELETE RESTRICT,
  expected_qty integer NOT NULL DEFAULT 0,
  counted_qty  integer CHECK (counted_qty >= 0),
  diff_qty     integer,
  reason_code  text CHECK (reason_code IN ('lost','damaged','input_error','count_error','found','other')),
  note         text,
  applied      boolean NOT NULL DEFAULT false,
  loss_vnd     bigint NOT NULL DEFAULT 0,
  counted_at   timestamptz,
  counted_by   uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT stocktake_lines_shape CHECK ((subject_type = 'unit' AND unit_id IS NOT NULL AND part_id IS NULL) OR (subject_type = 'part' AND part_id IS NOT NULL AND unit_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stocktake_lines_unit ON public.stocktake_lines (stocktake_id, unit_id) WHERE unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stocktake_lines_part ON public.stocktake_lines (stocktake_id, part_id) WHERE part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_stocktake_lines_stocktake ON public.stocktake_lines (stocktake_id);
CREATE INDEX IF NOT EXISTS ix_stocktake_lines_unit ON public.stocktake_lines (unit_id);
CREATE INDEX IF NOT EXISTS ix_stocktake_lines_part ON public.stocktake_lines (part_id);
CREATE INDEX IF NOT EXISTS ix_stocktake_lines_counted_by ON public.stocktake_lines (counted_by);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stocktakes','stocktake_lines'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup, wf_app', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__fn_only ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__fn_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only()', t, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS stocktakes_select ON public.stocktakes;
CREATE POLICY stocktakes_select ON public.stocktakes FOR SELECT TO wf_app USING (app.has_permission('stocktake.manage'));
DROP POLICY IF EXISTS stocktake_lines_select ON public.stocktake_lines;
CREATE POLICY stocktake_lines_select ON public.stocktake_lines FOR SELECT TO wf_app USING (app.has_permission('stocktake.manage'));

-- ===== Kiểm kê =====
CREATE OR REPLACE FUNCTION app.fn_start_stocktake(p_scope text, p_location uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid; v_code text; n_u int; n_p int;
BEGIN
  PERFORM app.require_permission('stocktake.manage');
  IF p_scope NOT IN ('all_units','location','parts','all') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phạm vi kiểm kê không hợp lệ.'); END IF;
  v_code := app.fn_next_number('KK');
  PERFORM set_config('app.in_fn', 'on', true);
  INSERT INTO public.stocktakes (code, scope, location_id, started_by, note) VALUES (v_code, p_scope, CASE WHEN p_scope = 'location' THEN p_location END, app.current_user_id(), p_note)
  RETURNING id INTO v_id;
  -- Chiếc ở kho cửa hàng (không gồm with_collaborator — BR-INV-01)
  IF p_scope IN ('all_units','location','all') THEN
    INSERT INTO public.stocktake_lines (stocktake_id, subject_type, unit_id, expected_qty)
    SELECT v_id, 'unit', u.id, 1 FROM public.watch_units u
    WHERE u.status IN ('in_stock','reserved','inspecting','in_repair') AND (p_scope <> 'location' OR u.location_id = p_location);
  END IF;
  IF p_scope IN ('parts','all') THEN
    INSERT INTO public.stocktake_lines (stocktake_id, subject_type, part_id, expected_qty)
    SELECT v_id, 'part', p.id, p.qty_on_hand FROM public.parts p WHERE p.is_active;
  END IF;
  SELECT count(*) FILTER (WHERE subject_type = 'unit'), count(*) FILTER (WHERE subject_type = 'part') INTO n_u, n_p FROM public.stocktake_lines WHERE stocktake_id = v_id;
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'units', n_u, 'parts', n_p);
END $$;

-- Ghi đếm: chiếc (quét mã/serial ⇒ counted 1; "không thấy" ⇒ 0) hoặc linh kiện (số đếm). Chiếc ngoài danh sách quét được ⇒ thêm dòng "found".
CREATE OR REPLACE FUNCTION app.fn_stocktake_count(p_stocktake uuid, p_unit uuid, p_part uuid, p_counted int, p_reason text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s public.stocktakes; v_line uuid;
BEGIN
  PERFORM app.require_permission('stocktake.manage');
  SELECT * INTO s FROM public.stocktakes WHERE id = p_stocktake FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy đợt kiểm kê.'); END IF;
  IF s.status <> 'open' THEN PERFORM app.raise_wf('WF-INV-STOCKTAKE-CLOSED', 'Đợt kiểm kê đã chốt hoặc đã hủy.'); END IF;
  IF p_counted IS NULL OR p_counted < 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Số đếm không hợp lệ.'); END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('lost','damaged','input_error','count_error','found','other') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Lý do không hợp lệ.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  IF p_unit IS NOT NULL THEN
    IF p_counted > 1 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Mỗi chiếc đếm 0 hoặc 1.'); END IF;
    SELECT id INTO v_line FROM public.stocktake_lines WHERE stocktake_id = p_stocktake AND unit_id = p_unit;
    IF v_line IS NULL THEN
      IF (SELECT status FROM public.watch_units WHERE id = p_unit) = 'with_collaborator' THEN
        PERFORM app.raise_wf('WF-VALIDATION', 'Chiếc đang ở cộng tác viên — không kiểm ở kho.');
      END IF;
      INSERT INTO public.stocktake_lines (stocktake_id, subject_type, unit_id, expected_qty) VALUES (p_stocktake, 'unit', p_unit, 0) RETURNING id INTO v_line;
    END IF;
  ELSIF p_part IS NOT NULL THEN
    SELECT id INTO v_line FROM public.stocktake_lines WHERE stocktake_id = p_stocktake AND part_id = p_part;
    IF v_line IS NULL THEN
      INSERT INTO public.stocktake_lines (stocktake_id, subject_type, part_id, expected_qty) SELECT p_stocktake, 'part', id, qty_on_hand FROM public.parts WHERE id = p_part RETURNING id INTO v_line;
    END IF;
  ELSE
    PERFORM app.raise_wf('WF-VALIDATION', 'Chọn chiếc hoặc linh kiện.');
  END IF;
  UPDATE public.stocktake_lines SET counted_qty = p_counted, reason_code = coalesce(p_reason, reason_code), note = coalesce(p_note, note),
    counted_at = now(), counted_by = app.current_user_id() WHERE id = v_line;
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('lineId', v_line, 'counted', p_counted);
END $$;

-- Đối chiếu & chốt (BR-INV-01/02): số hệ thống lấy tại lúc chốt; mọi chênh lệch cần lý do; chiếc mất ⇒ written_off (cần stock.writeoff — CQ-013);
-- linh kiện lệch ⇒ movement stocktake × bình quân. Chiếc chưa đếm coi như "không thấy".
CREATE OR REPLACE FUNCTION app.fn_reconcile_stocktake(p_stocktake uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s public.stocktakes; l record; u public.watch_units; v_cost bigint; v_qty int; v_avg numeric(14,4); v_diff int; v_loss bigint := 0; v_lost int := 0; v_adj int := 0;
BEGIN
  PERFORM app.require_permission('stocktake.manage');
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.stocktake_lines WHERE stocktake_id = p_stocktake AND unit_id IS NOT NULL) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.stocktake_lines WHERE stocktake_id = p_stocktake AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  SELECT * INTO s FROM public.stocktakes WHERE id = p_stocktake FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy đợt kiểm kê.'); END IF;
  IF s.status <> 'open' THEN PERFORM app.raise_wf('WF-INV-STOCKTAKE-CLOSED', 'Đợt kiểm kê đã chốt hoặc đã hủy.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  FOR l IN SELECT * FROM public.stocktake_lines WHERE stocktake_id = p_stocktake ORDER BY subject_type, id LOOP
    IF l.subject_type = 'unit' THEN
      SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
      v_diff := coalesce(l.counted_qty, 0) - CASE WHEN u.status IN ('in_stock','reserved','inspecting','in_repair') THEN 1 ELSE 0 END;
      IF v_diff <> 0 AND l.reason_code IS NULL THEN
        PERFORM app.raise_wf('WF-REASON-REQUIRED', format('Chiếc %s lệch kiểm kê — chọn lý do.', u.asset_code));
      END IF;
      IF v_diff < 0 THEN
        IF NOT app.has_permission('stock.writeoff') THEN PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chốt chiếc bị mất cần quyền thanh lý/ghi mất (chủ cửa hàng).'); END IF;
        IF u.status = 'reserved' THEN PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', format('Chiếc %s đang giữ cho khách — xử lý giữ hàng trước.', u.asset_code)); END IF;
        SELECT coalesce(sum(amount_vnd), 0) INTO v_cost FROM public.unit_cost_entries WHERE unit_id = u.id AND cycle = u.cost_cycle;
        PERFORM app.set_unit_status(u.id, 'written_off', 'Kiểm kê ' || s.code || ': ' || l.reason_code, 'stocktakes', p_stocktake);
        v_loss := v_loss + v_cost; v_lost := v_lost + 1;
        UPDATE public.stocktake_lines SET diff_qty = v_diff, applied = true, loss_vnd = v_cost WHERE id = l.id;
      ELSIF v_diff > 0 THEN
        IF u.status = 'written_off' THEN
          PERFORM app.set_unit_status(u.id, 'in_stock', 'Kiểm kê ' || s.code || ': tìm thấy', 'stocktakes', p_stocktake,
            coalesce(s.location_id, (SELECT id FROM public.storage_locations WHERE is_active ORDER BY created_at LIMIT 1)));
        END IF;
        UPDATE public.stocktake_lines SET diff_qty = v_diff, applied = u.status = 'written_off' WHERE id = l.id;
      ELSE
        UPDATE public.stocktake_lines SET diff_qty = 0 WHERE id = l.id;
      END IF;
    ELSE
      SELECT p.qty_on_hand, pc.avg_cost INTO v_qty, v_avg FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id;
      IF l.counted_qty IS NULL THEN
        UPDATE public.stocktake_lines SET diff_qty = 0, note = coalesce(note, 'Chưa đếm — giữ nguyên') WHERE id = l.id;
        CONTINUE;
      END IF;
      v_diff := l.counted_qty - v_qty;
      IF v_diff <> 0 THEN
        IF l.reason_code IS NULL THEN PERFORM app.raise_wf('WF-REASON-REQUIRED', 'Linh kiện lệch kiểm kê — chọn lý do.'); END IF;
        UPDATE public.parts SET qty_on_hand = l.counted_qty WHERE id = l.part_id;
        INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, reason, actor_id)
        VALUES (l.part_id, v_diff, v_avg, 'stocktake', v_qty, v_avg, 'stocktakes', p_stocktake, l.reason_code || coalesce(': ' || l.note, ''), app.current_user_id());
        IF v_diff < 0 THEN v_loss := v_loss + app.round_vnd(-v_diff * v_avg); END IF;
        v_adj := v_adj + 1;
      END IF;
      UPDATE public.stocktake_lines SET diff_qty = v_diff, applied = v_diff <> 0, loss_vnd = CASE WHEN v_diff < 0 THEN app.round_vnd(-v_diff * v_avg) ELSE 0 END WHERE id = l.id;
    END IF;
  END LOOP;
  UPDATE public.stocktakes SET status = 'reconciled', reconciled_by = app.current_user_id(), reconciled_at = now() WHERE id = p_stocktake;
  PERFORM app.fn_audit_event('stocktake.reconciled', 'stocktakes', p_stocktake::text, NULL, jsonb_build_object('loss', v_loss, 'lostUnits', v_lost, 'partAdjust', v_adj), NULL, 'high');
  PERFORM app.fn_emit_event('stocktake.reconciled', jsonb_build_object('stocktakeId', p_stocktake, 'loss', v_loss));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_stocktake, 'status', 'reconciled', 'loss', v_loss, 'lostUnits', v_lost, 'partAdjust', v_adj);
END $$;

CREATE OR REPLACE FUNCTION app.fn_cancel_stocktake(p_stocktake uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s public.stocktakes;
BEGIN
  PERFORM app.require_permission('stocktake.manage');
  SELECT * INTO s FROM public.stocktakes WHERE id = p_stocktake FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy đợt kiểm kê.'); END IF;
  IF s.status <> 'open' THEN PERFORM app.raise_wf('WF-INV-STOCKTAKE-CLOSED', 'Đợt kiểm kê đã chốt hoặc đã hủy.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.stocktakes SET status = 'cancelled', note = concat_ws(' · ', note, 'Hủy: ' || app.require_reason(p_reason)) WHERE id = p_stocktake;
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_stocktake, 'status', 'cancelled');
END $$;

-- ===== Bộ kiểm bất biến I1–I12 (integrity §7) — trả danh sách vi phạm =====
CREATE OR REPLACE FUNCTION app.fn_consistency_check() RETURNS TABLE (check_code text, entity_id text, detail text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  -- I1: thanh toán posted gắn đúng một chứng từ tồn tại
  SELECT 'I1', p.id::text, 'Thanh toán ' || p.code || ' trỏ tới chứng từ không tồn tại'
  FROM public.payments p WHERE p.status = 'posted' AND NOT (
       (p.doc_type = 'sale' AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = p.doc_id AND s.status = 'confirmed'))
    OR (p.doc_type = 'reservation' AND EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = p.doc_id))
    OR (p.doc_type = 'repair' AND EXISTS (SELECT 1 FROM public.repair_orders o WHERE o.id = p.doc_id))
    OR (p.doc_type = 'settlement' AND EXISTS (SELECT 1 FROM public.collaborator_settlements c WHERE c.id = p.doc_id AND c.status = 'confirmed')))
  UNION ALL
  -- I2: Σ thu ≤ phải thu; cọc đã đóng: applied + refunded + forfeited = đã thu
  SELECT 'I2', b.doc_id::text, b.doc_type || ' ' || b.code || ' thu vượt / cọc âm' FROM public.v_doc_balances b WHERE b.due < 0 OR b.held < 0
  UNION ALL
  SELECT 'I2', r.id::text, 'Giữ hàng ' || r.code || ' đã đóng nhưng cọc còn lệch'
  FROM public.reservations r JOIN public.v_doc_balances b ON b.doc_type = 'reservation' AND b.doc_id = r.id WHERE r.status NOT IN ('active','expired') AND b.held <> 0
  UNION ALL
  -- I3: trạng thái chiếc = to_status của lịch sử cuối
  SELECT 'I3', u.id::text, 'Chiếc ' || u.asset_code || ' lệch lịch sử trạng thái'
  FROM public.watch_units u WHERE u.status IS DISTINCT FROM (SELECT h.to_status FROM public.unit_status_history h WHERE h.unit_id = u.id ORDER BY h.at DESC, h.id DESC LIMIT 1)
  UNION ALL
  -- I4: sold ⇔ đúng 1 dòng bán hiệu lực
  SELECT 'I4', u.id::text, 'Chiếc ' || u.asset_code || ' có ' || (SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) || ' dòng bán hiệu lực'
  FROM public.watch_units u WHERE (u.status = 'sold') <> ((SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) = 1)
    AND NOT (u.status <> 'sold' AND (SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) = 0)
  UNION ALL
  -- I5: reserved ⇔ 1 giữ hàng hiệu lực
  SELECT 'I5', u.id::text, 'Chiếc ' || u.asset_code || ' lệch giữ hàng'
  FROM public.watch_units u WHERE (u.status = 'reserved') <> EXISTS (SELECT 1 FROM public.reservations r WHERE r.unit_id = u.id AND r.status IN ('active','expired'))
  UNION ALL
  -- I6: with_collaborator ⇔ 1 dòng phiếu giao active cùng CTV
  SELECT 'I6', u.id::text, 'Chiếc ' || u.asset_code || ' lệch phiếu giao CTV'
  FROM public.watch_units u WHERE (u.status = 'with_collaborator') <> EXISTS (SELECT 1 FROM public.collaborator_assignment_lines l
    JOIN public.collaborator_assignments a ON a.id = l.assignment_id WHERE l.unit_id = u.id AND l.status = 'active' AND a.collaborator_id = u.held_by_collaborator_id)
  UNION ALL
  -- I7: tồn linh kiện = Σ movements
  SELECT 'I7', p.id::text, 'Linh kiện ' || p.code || ' tồn ' || p.qty_on_hand || ' ≠ Σ xuất nhập'
  FROM public.parts p WHERE p.qty_on_hand <> coalesce((SELECT sum(m.qty_delta) FROM public.part_stock_movements m WHERE m.part_id = p.id), 0)
  UNION ALL
  -- I8: dòng bán hiệu lực có giá vốn chốt
  SELECT 'I8', sl.id::text, 'Dòng bán thiếu giá vốn chốt'
  FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE s.status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM public.sale_line_costs c WHERE c.sale_line_id = sl.id)
  UNION ALL
  -- I9: dòng phiếu nhập đồng hồ confirmed có unit_id; phiếu voided không còn chiếc in_stock
  SELECT 'I9', l.id::text, 'Dòng phiếu nhập ' || r.code || ' thiếu chiếc'
  FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id = l.receipt_id WHERE r.status = 'confirmed' AND l.line_type = 'watch' AND l.unit_id IS NULL
  UNION ALL
  SELECT 'I9', u.id::text, 'Chiếc ' || u.asset_code || ' còn trong kho dù phiếu nhập đã hủy'
  FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id = l.receipt_id JOIN public.watch_units u ON u.id = l.unit_id
  WHERE r.status = 'voided' AND l.rebuy_unit_id IS NULL AND u.status = 'in_stock'
  UNION ALL
  -- I10: quyết toán = Σ giá thu = thanh toán
  SELECT 'I10', cs.id::text, 'Quyết toán ' || cs.code || ' lệch tổng'
  FROM public.collaborator_settlements cs WHERE cs.status = 'confirmed' AND (cs.total_vnd <> (SELECT coalesce(sum(base_price_vnd), 0) FROM public.sale_lines WHERE settlement_id = cs.id)
    OR cs.total_vnd <> (SELECT coalesce(sum(amount_vnd), 0) FROM public.payments p WHERE p.doc_type = 'settlement' AND p.doc_id = cs.id AND p.status = 'posted'))
  UNION ALL
  -- I11: doanh thu dòng: cửa hàng bán = line_total; CTV bán = giá thu
  SELECT 'I11', sl.id::text, 'Doanh thu dòng bán lệch quy tắc'
  FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id
  WHERE s.status = 'confirmed' AND sl.shop_revenue_vnd <> CASE WHEN s.collaborator_id IS NULL THEN sl.line_total_vnd ELSE coalesce(sl.base_price_vnd, -1) END
  UNION ALL
  -- I12: phiếu sửa giao: doanh thu = Σ dòng (tính phí) / 0 (bảo hành, nội bộ)
  SELECT 'I12', o.id::text, 'Phiếu sửa ' || o.code || ' lệch doanh thu'
  FROM public.repair_orders o WHERE o.status = 'delivered' AND o.revenue_vnd <> CASE WHEN o.kind = 'customer' AND o.charge_mode = 'paid'
    THEN (SELECT coalesce(sum(line_total_vnd), 0) FROM public.repair_lines WHERE order_id = o.id) ELSE 0 END
$$;

-- ===== Cảnh báo hằng ngày (job daily) =====
CREATE OR REPLACE FUNCTION app.fn_daily_alerts() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE d date := app.today_vn(); n_exp int; n_wexp int; c record; out jsonb := '{}'; v int;
BEGIN
  PERFORM set_config('app.in_fn', 'on', true);
  -- Giữ hàng quá hạn ⇒ expired (chiếc vẫn reserved — BR-RSV-02)
  UPDATE public.reservations SET status = 'expired' WHERE status = 'active' AND hold_until < d;
  GET DIAGNOSTICS n_exp = ROW_COUNT;
  FOR c IN SELECT r.id, r.code, u.asset_code FROM public.reservations r JOIN public.watch_units u ON u.id = r.unit_id WHERE r.status = 'expired' LOOP
    PERFORM app.fn_notify_permission('reservation.manage', 'reservation.overdue', 'Giữ hàng quá hạn: ' || c.code, 'Chiếc ' || c.asset_code || ' đã quá hạn giữ — hoàn hoặc tịch thu cọc.', '/giu-hang', 'rsv:' || c.id);
  END LOOP;
  -- Bảo hành hết hạn / sắp hết hạn (BR-WAR-04)
  UPDATE public.warranties SET status = 'expired' WHERE status = 'active' AND end_date < d;
  GET DIAGNOSTICS n_wexp = ROW_COUNT;
  v := 0;
  FOR c IN SELECT w.id, w.code, w.end_date FROM public.warranties w WHERE w.status = 'active' AND w.end_date <= d + app.setting_int('warranty.expiry_alert_days', 14) LOOP
    PERFORM app.fn_notify_permission('warranty.view', 'warranty.expiring', 'Bảo hành sắp hết hạn: ' || c.code, 'Hết hạn ngày ' || to_char(c.end_date, 'DD/MM/YYYY') || '.', '/bao-hanh', 'war:' || c.id);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('reservationsExpired', n_exp, 'warrantiesExpired', n_wexp, 'warrantiesExpiring', v);
  -- Khách hẹn trả đến hạn (phiếu bán / sửa còn nợ)
  v := 0;
  FOR c IN SELECT b.doc_type, b.doc_id, b.code, b.due, b.due_date FROM public.v_doc_balances b WHERE b.due > 0 AND b.due_date IS NOT NULL AND b.due_date <= d LOOP
    PERFORM app.fn_notify_permission('debt.view', 'debt.due', 'Khách đến hạn trả: ' || c.code, 'Còn nợ ' || to_char(c.due, 'FM999G999G999G999') || ' ₫ (hẹn ' || to_char(c.due_date, 'DD/MM') || ').',
      CASE c.doc_type WHEN 'sale' THEN '/ban-hang/' || c.doc_id ELSE '/sua-chua/' || c.doc_id END, 'due:' || c.doc_id || ':' || d);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('debtsDue', v);
  -- Máy sửa hoàn thành chưa lấy (BR-REP-12)
  v := 0;
  FOR c IN SELECT o.id, o.code FROM public.repair_orders o WHERE o.status = 'completed' AND o.kind = 'customer' AND o.completed_at::date <= d - app.setting_int('repair.pickup_alert_days', 14) LOOP
    PERFORM app.fn_notify_permission('repair.view', 'repair.pickup', 'Máy chưa lấy: ' || c.code, 'Máy đã hoàn thành nhưng khách chưa đến lấy.', '/sua-chua/' || c.id, 'pick:' || c.id);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('repairsNotPicked', v);
  -- Linh kiện thấp (BR-PART-04)
  v := 0;
  FOR c IN SELECT p.id, p.code, p.name, p.qty_on_hand FROM public.parts p WHERE p.is_active AND p.qty_on_hand <= p.reorder_level LOOP
    PERFORM app.fn_notify_permission('part.manage', 'part.low_stock', 'Linh kiện sắp hết: ' || c.code, c.name || ' còn ' || c.qty_on_hand || '.', '/linh-kien/' || c.id, 'low:' || c.id || ':' || d);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('partsLow', v);
  -- Tồn lâu (BR-INV-04)
  SELECT count(*) INTO v FROM public.watch_units u WHERE u.status = 'in_stock' AND d - u.stock_since > app.setting_int('inventory.aging_days', 90);
  IF v > 0 THEN
    PERFORM app.fn_notify_permission('report.inventory', 'inventory.aging', v || ' chiếc tồn lâu', 'Có ' || v || ' chiếc tồn quá ' || app.setting_int('inventory.aging_days', 90) || ' ngày.', '/dong-ho?aging=1', 'aging:' || d);
  END IF;
  out := out || jsonb_build_object('agingUnits', v);
  -- Chiếc ở CTV quá hạn (BR-COL-11)
  v := 0;
  FOR c IN SELECT u.id, u.asset_code, app.user_display_name(u.held_by_collaborator_id) AS who, a.doc_date FROM public.watch_units u
           JOIN public.collaborator_assignment_lines l ON l.unit_id = u.id AND l.status = 'active' JOIN public.collaborator_assignments a ON a.id = l.assignment_id
           WHERE u.status = 'with_collaborator' AND d - a.doc_date > app.setting_int('collab.hold_alert_days', 30) LOOP
    PERFORM app.fn_notify_permission('collab.manage', 'collab.overdue', 'Chiếc ở CTV quá hạn: ' || c.asset_code, coalesce(c.who, 'CTV') || ' giữ từ ' || to_char(c.doc_date, 'DD/MM/YYYY') || '.', '/cong-tac-vien', 'col:' || c.id || ':' || d);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('collabOverdue', v);
  PERFORM set_config('app.in_fn', '', true);
  RETURN out;
END $$;

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.fn_start_stocktake(text,uuid,text)','app.fn_stocktake_count(uuid,uuid,uuid,int,text,text)','app.fn_reconcile_stocktake(uuid)',
    'app.fn_cancel_stocktake(uuid,text)','app.fn_consistency_check()','app.fn_daily_alerts()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.fn_start_stocktake(text,uuid,text), app.fn_stocktake_count(uuid,uuid,uuid,int,text,text), app.fn_reconcile_stocktake(uuid),
  app.fn_cancel_stocktake(uuid,text) TO wf_app;
GRANT EXECUTE ON FUNCTION app.fn_consistency_check() TO wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_daily_alerts() TO wf_worker;

COMMIT;
