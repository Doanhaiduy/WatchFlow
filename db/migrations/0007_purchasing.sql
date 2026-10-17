-- 0007_purchasing.sql — Nhập hàng & giá vốn: purchase_receipts / purchase_lines / purchase_costs (nguồn hàng chữ, không NCC — CF-06);
-- fn_confirm_purchase (sinh chiếc + mã nội bộ, phân bổ chi phí, unit_cost_entries, kho linh kiện bình quân), fn_void_purchase (BR-PUR-07),
-- fn_adjust_unit_cost (BR-PUR-08). BR-PUR-01…11, BR-COST-01/05, BR-UNIT-01/02/10, SC-01, SC-11, SC-17, CT-09, CT-12. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id                   uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code                 text UNIQUE,                       -- cấp khi xác nhận (PN-YYYY-NNNN); nháp chưa có mã
  kind                 text NOT NULL CHECK (kind IN ('purchase','customer_buyback','trade_in','opening')),
  source_name          text,
  seller_customer_id   uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  seller_name          text,
  seller_phone         text,
  doc_date             date NOT NULL DEFAULT app.today_vn(),
  backdate_reason      text,
  received_by          uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','voided')),
  subtotal_vnd         bigint NOT NULL DEFAULT 0 CHECK (subtotal_vnd >= 0),
  extra_cost_total_vnd bigint NOT NULL DEFAULT 0 CHECK (extra_cost_total_vnd >= 0),
  grand_total_vnd      bigint NOT NULL DEFAULT 0 CHECK (grand_total_vnd >= 0),
  payment_note         text,
  note                 text,
  confirmed_at         timestamptz,
  confirmed_by         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at            timestamptz,
  voided_by            uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  void_reason          text,
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT purchase_confirmed_fields CHECK (status = 'draft' OR (code IS NOT NULL AND confirmed_at IS NOT NULL)),
  CONSTRAINT purchase_source_required CHECK (status = 'draft' OR kind <> 'purchase' OR nullif(btrim(source_name), '') IS NOT NULL),
  CONSTRAINT purchase_seller_required CHECK (status = 'draft' OR kind NOT IN ('customer_buyback','trade_in') OR seller_customer_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_doc_date ON public.purchase_receipts (doc_date);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_status ON public.purchase_receipts (status);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_seller ON public.purchase_receipts (seller_customer_id);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_received_by ON public.purchase_receipts (received_by);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_confirmed_by ON public.purchase_receipts (confirmed_by);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_voided_by ON public.purchase_receipts (voided_by);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_created_by ON public.purchase_receipts (created_by);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_updated_by ON public.purchase_receipts (updated_by);

CREATE TABLE IF NOT EXISTS public.purchase_lines (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  receipt_id      uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  line_no         integer NOT NULL CHECK (line_no >= 1),
  line_type       text NOT NULL CHECK (line_type IN ('watch','part')),
  model_id        uuid REFERENCES public.watch_models(id) ON DELETE RESTRICT,
  serial_no       text,
  has_serial      boolean NOT NULL DEFAULT true,
  condition       text CHECK (condition IN ('new','used','refurbished')),
  condition_grade text CHECK (condition_grade ~ '^([ABC]|\d{1,3}%)$'),
  condition_note  text,
  initial_status  text NOT NULL DEFAULT 'in_stock' CHECK (initial_status IN ('in_stock','inspecting')),
  location_id     uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  list_price_vnd  bigint CHECK (list_price_vnd >= 0),
  rebuy_unit_id   uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,   -- BR-PUR-10: mua lại đúng chiếc đã bán
  part_id         uuid REFERENCES public.parts(id) ON DELETE RESTRICT,
  qty             integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price_vnd  bigint NOT NULL DEFAULT 0 CHECK (unit_price_vnd >= 0),
  line_total_vnd  bigint GENERATED ALWAYS AS (unit_price_vnd * qty) STORED,
  allocated_cost_vnd bigint NOT NULL DEFAULT 0 CHECK (allocated_cost_vnd >= 0),   -- điền khi xác nhận
  unit_id         uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,     -- điền khi xác nhận
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_lines_shape CHECK (
    (line_type = 'watch' AND model_id IS NOT NULL AND part_id IS NULL AND qty = 1 AND condition IS NOT NULL AND (has_serial OR serial_no IS NULL))
    OR (line_type = 'part' AND part_id IS NOT NULL AND model_id IS NULL AND rebuy_unit_id IS NULL)),
  CONSTRAINT purchase_lines_no UNIQUE (receipt_id, line_no)
);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_receipt ON public.purchase_lines (receipt_id);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_model ON public.purchase_lines (model_id);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_location ON public.purchase_lines (location_id);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_rebuy ON public.purchase_lines (rebuy_unit_id);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_part ON public.purchase_lines (part_id);
CREATE INDEX IF NOT EXISTS ix_purchase_lines_unit ON public.purchase_lines (unit_id);

CREATE TABLE IF NOT EXISTS public.purchase_costs (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  receipt_id      uuid NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('shipping','inspection','repair','customs','other')),
  description     text,
  amount_vnd      bigint NOT NULL CHECK (amount_vnd > 0),
  allocate_method text NOT NULL DEFAULT 'by_value' CHECK (allocate_method IN ('by_value','equal')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_purchase_costs_receipt ON public.purchase_costs (receipt_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_receipts','purchase_lines','purchase_costs'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_purchase_receipts__updated_at ON public.purchase_receipts;
CREATE TRIGGER trg_purchase_receipts__updated_at BEFORE UPDATE ON public.purchase_receipts FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_purchase_receipts__guard ON public.purchase_receipts;
CREATE TRIGGER trg_purchase_receipts__guard BEFORE UPDATE OR DELETE ON public.purchase_receipts FOR EACH ROW EXECUTE FUNCTION app.tg_confirmed_doc_guard();

-- Dòng/chi phí chỉ sửa khi phiếu còn nháp (trừ trong fn_*)
CREATE OR REPLACE FUNCTION app.tg_purchase_child_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_status text; v_rid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.receipt_id ELSE NEW.receipt_id END;
BEGIN
  IF coalesce(current_setting('app.in_fn', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT status INTO v_status FROM public.purchase_receipts WHERE id = v_rid;
  IF v_status IS DISTINCT FROM 'draft' AND v_status IS NOT NULL THEN
    PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu nhập đã xác nhận/hủy, không sửa dòng được.');
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
-- Tổng tiền phiếu (nháp) tính lại khi dòng/chi phí đổi
CREATE OR REPLACE FUNCTION app.tg_purchase_recalc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_rid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.receipt_id ELSE NEW.receipt_id END; s bigint; c bigint;
BEGIN
  SELECT coalesce(sum(line_total_vnd), 0) INTO s FROM public.purchase_lines WHERE receipt_id = v_rid;
  SELECT coalesce(sum(amount_vnd), 0) INTO c FROM public.purchase_costs WHERE receipt_id = v_rid;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.purchase_receipts SET subtotal_vnd = s, extra_cost_total_vnd = c, grand_total_vnd = s + c
  WHERE id = v_rid AND status = 'draft' AND (subtotal_vnd, extra_cost_total_vnd) IS DISTINCT FROM (s, c);
  PERFORM set_config('app.in_fn', '', true);
  RETURN NULL;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_lines','purchase_costs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_purchase_child_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__recalc ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__recalc AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_purchase_recalc()', t, t);
  END LOOP;
END $$;

-- ===== GRANT + RLS (nháp ghi trực tiếp theo quyền; xác nhận/hủy qua fn_*) =====
GRANT SELECT ON public.purchase_receipts, public.purchase_lines, public.purchase_costs TO wf_app;
GRANT INSERT (kind, source_name, seller_customer_id, seller_name, seller_phone, doc_date, backdate_reason, received_by, payment_note, note, created_by)
  ON public.purchase_receipts TO wf_app;
GRANT UPDATE (kind, source_name, seller_customer_id, seller_name, seller_phone, doc_date, backdate_reason, received_by, payment_note, note)
  ON public.purchase_receipts TO wf_app;
GRANT DELETE ON public.purchase_receipts TO wf_app;
GRANT INSERT (receipt_id, line_no, line_type, model_id, serial_no, has_serial, condition, condition_grade, condition_note, initial_status, location_id,
              list_price_vnd, rebuy_unit_id, part_id, qty, unit_price_vnd, note),
      UPDATE (line_no, model_id, serial_no, has_serial, condition, condition_grade, condition_note, initial_status, location_id,
              list_price_vnd, rebuy_unit_id, part_id, qty, unit_price_vnd, note),
      DELETE ON public.purchase_lines TO wf_app;
GRANT INSERT (receipt_id, kind, description, amount_vnd, allocate_method), UPDATE (kind, description, amount_vnd, allocate_method), DELETE
  ON public.purchase_costs TO wf_app;

DROP POLICY IF EXISTS purchase_receipts_select ON public.purchase_receipts;
CREATE POLICY purchase_receipts_select ON public.purchase_receipts FOR SELECT TO wf_app USING (app.has_permission('purchase.view'));
DROP POLICY IF EXISTS purchase_receipts_insert ON public.purchase_receipts;
CREATE POLICY purchase_receipts_insert ON public.purchase_receipts FOR INSERT TO wf_app
  WITH CHECK (app.has_permission('purchase.create') AND created_by = app.current_user_id() AND kind <> 'trade_in');
DROP POLICY IF EXISTS purchase_receipts_update ON public.purchase_receipts;
CREATE POLICY purchase_receipts_update ON public.purchase_receipts FOR UPDATE TO wf_app
  USING (app.has_permission('purchase.create') AND status = 'draft') WITH CHECK (status = 'draft' AND kind <> 'trade_in');
DROP POLICY IF EXISTS purchase_receipts_delete ON public.purchase_receipts;
CREATE POLICY purchase_receipts_delete ON public.purchase_receipts FOR DELETE TO wf_app
  USING (app.has_permission('purchase.create') AND status = 'draft');
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_lines','purchase_costs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %s_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %s_select ON public.%I FOR SELECT TO wf_app USING (app.has_permission(''purchase.view''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %s_write ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %s_write ON public.%I FOR ALL TO wf_app USING (app.has_permission(''purchase.create'') AND EXISTS (SELECT 1 FROM public.purchase_receipts r WHERE r.id = receipt_id AND r.status = ''draft'')) WITH CHECK (app.has_permission(''purchase.create'') AND EXISTS (SELECT 1 FROM public.purchase_receipts r WHERE r.id = receipt_id AND r.status = ''draft''))', t, t);
  END LOOP;
END $$;

-- ===== Xác nhận phiếu nhập (BR-PUR-04) =====
CREATE OR REPLACE FUNCTION app.fn_confirm_purchase(p_receipt uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  r public.purchase_receipts; l record; c record; u public.watch_units;
  v_ids uuid[]; v_w bigint[]; v_alloc bigint[]; v_line_alloc bigint[]; i int; n int;
  v_unit uuid; v_code text; v_brand uuid; v_avg numeric(14,4); v_qty int; v_lot numeric(14,4); v_units jsonb := '[]'; v_rebuy boolean;
  v_req_seller boolean; v_req_photo boolean; v_cust record;
BEGIN
  PERFORM app.require_permission('purchase.confirm');
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
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_receipt, 'code', v_code, 'status', 'confirmed', 'units', v_units);
END $$;

-- ===== Hủy phiếu nhập (BR-PUR-07) =====
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
                 AND NOT (m.ref_table = 'purchase_receipts' AND m.ref_id = p_receipt)) THEN
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

-- ===== Điều chỉnh giá vốn (BR-PUR-08, BR-COST-05) =====
CREATE OR REPLACE FUNCTION app.fn_adjust_unit_cost(p_unit uuid, p_amount bigint, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_reason text; v_total bigint;
BEGIN
  PERFORM app.require_permission('cost.adjust');
  v_reason := app.require_reason(p_reason);
  IF p_amount IS NULL OR p_amount = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Số tiền điều chỉnh phải khác 0.'); END IF;
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status NOT IN ('in_stock','reserved','with_collaborator','in_repair','inspecting') THEN
    PERFORM app.raise_wf('WF-COST-NOT-ADJUSTABLE', 'Chỉ điều chỉnh giá vốn chiếc còn trong kho; chiếc đã bán/hủy/thanh lý không điều chỉnh được.');
  END IF;
  SELECT coalesce(sum(amount_vnd), 0) INTO v_total FROM public.unit_cost_entries WHERE unit_id = p_unit AND cycle = u.cost_cycle;
  IF v_total + p_amount < 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Giá vốn sau điều chỉnh không được âm.'); END IF;
  INSERT INTO public.unit_cost_entries (unit_id, cycle, kind, amount_vnd, reason, created_by)
  VALUES (p_unit, u.cost_cycle, 'adjustment', p_amount, v_reason, app.current_user_id());
  PERFORM app.fn_audit_event('unit.cost_adjusted', 'watch_units', p_unit::text, jsonb_build_object('cost', v_total), jsonb_build_object('cost', v_total + p_amount), v_reason, 'high');
  RETURN jsonb_build_object('id', p_unit, 'cost', v_total + p_amount);
END $$;

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.tg_purchase_child_guard()','app.tg_purchase_recalc()','app.fn_confirm_purchase(uuid)','app.fn_void_purchase(uuid,text)',
    'app.fn_adjust_unit_cost(uuid,bigint,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.tg_purchase_child_guard(), app.tg_purchase_recalc() TO wf_app, wf_definer, wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_confirm_purchase(uuid), app.fn_void_purchase(uuid,text), app.fn_adjust_unit_cost(uuid,bigint,text) TO wf_app;
GRANT EXECUTE ON FUNCTION app.fn_confirm_purchase(uuid), app.fn_void_purchase(uuid,text) TO wf_definer;

COMMIT;
