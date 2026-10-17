-- 0009_repairs.sql — Sửa chữa gọn (M6, CF-04/05 — chỉ chủ, không thợ/tiền công): service_types, repair_orders, repair_lines,
-- repair_line_costs (append-only, cost.view; đảo bằng bút toán âm — CQ-012), repair_status_history (append-only);
-- fn_create_repair, fn_set_repair_status, fn_approve_quote, fn_use_repair_part, fn_unuse_repair_part, fn_complete_repair,
-- fn_deliver_repair, fn_cancel_repair; nhánh repair cho doc_payment_state / v_doc_balances; bảo hành sau sửa.
-- BR-REP-01…16, BR-PART-03, BR-COST-03/04, BR-WAR-01/02/03, SC-07, SC-08, SC-09, CT-04, PT-04. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.service_types (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code              text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name              text NOT NULL,
  default_price_vnd bigint NOT NULL DEFAULT 0 CHECK (default_price_vnd >= 0),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.repair_orders (
  id                     uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code                   text NOT NULL UNIQUE,
  kind                   text NOT NULL CHECK (kind IN ('customer','internal')),
  charge_mode            text NOT NULL DEFAULT 'paid' CHECK (charge_mode IN ('paid','warranty_free')),
  customer_id            uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_watch_id      uuid REFERENCES public.customer_watches(id) ON DELETE RESTRICT,
  unit_id                uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  warranty_id            uuid REFERENCES public.warranties(id) ON DELETE RESTRICT,
  prev_unit_status       text,
  received_at            timestamptz NOT NULL DEFAULT now(),
  received_date          date NOT NULL DEFAULT app.today_vn(),
  received_by            uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  status                 text NOT NULL DEFAULT 'received' CHECK (status IN ('received','inspecting','repairing','waiting_parts','completed','delivered','cancelled')),
  intake_condition       text,
  customer_complaint     text,
  findings               text,
  expected_date          date,
  quote_approved_at      timestamptz,
  quote_approved_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  quote_approved_channel text,
  final_total_vnd        bigint NOT NULL DEFAULT 0 CHECK (final_total_vnd >= 0),
  revenue_vnd            bigint NOT NULL DEFAULT 0 CHECK (revenue_vnd >= 0),
  completed_at           timestamptz,
  delivered_at           timestamptz,
  delivered_date         date,
  delivered_by           uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  due_date               date,
  cancel_reason          text,
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT repair_internal_unit CHECK (kind <> 'internal' OR (unit_id IS NOT NULL AND charge_mode = 'paid')),
  CONSTRAINT repair_customer_required CHECK (kind <> 'customer' OR (customer_id IS NOT NULL AND (customer_watch_id IS NOT NULL OR unit_id IS NOT NULL))),
  CONSTRAINT repair_warranty_link CHECK (charge_mode <> 'warranty_free' OR warranty_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_repair_orders_status ON public.repair_orders (status);
CREATE INDEX IF NOT EXISTS ix_repair_orders_customer ON public.repair_orders (customer_id);
CREATE INDEX IF NOT EXISTS ix_repair_orders_customer_watch ON public.repair_orders (customer_watch_id);
CREATE INDEX IF NOT EXISTS ix_repair_orders_unit ON public.repair_orders (unit_id);
CREATE INDEX IF NOT EXISTS ix_repair_orders_warranty ON public.repair_orders (warranty_id);
CREATE INDEX IF NOT EXISTS ix_repair_orders_received_by ON public.repair_orders (received_by);
CREATE INDEX IF NOT EXISTS ix_repair_orders_quote_by ON public.repair_orders (quote_approved_by);
CREATE INDEX IF NOT EXISTS ix_repair_orders_delivered_by ON public.repair_orders (delivered_by);
CREATE INDEX IF NOT EXISTS ix_repair_orders_updated_by ON public.repair_orders (updated_by);
CREATE INDEX IF NOT EXISTS ix_repair_orders_delivered_date ON public.repair_orders (delivered_date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warranties_repair_fk') THEN
    ALTER TABLE public.warranties ADD CONSTRAINT warranties_repair_fk FOREIGN KEY (repair_order_id) REFERENCES public.repair_orders(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.repair_lines (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  order_id        uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  line_no         integer NOT NULL CHECK (line_no >= 1),
  line_type       text NOT NULL CHECK (line_type IN ('service','part','other')),
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE RESTRICT,
  part_id         uuid REFERENCES public.parts(id) ON DELETE RESTRICT,
  description     text,
  qty             integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price_vnd  bigint NOT NULL DEFAULT 0 CHECK (unit_price_vnd >= 0),
  line_total_vnd  bigint GENERATED ALWAYS AS (unit_price_vnd * qty) STORED,
  consumed_at     timestamptz,
  consumed_by     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_lines_no UNIQUE (order_id, line_no),
  CONSTRAINT repair_lines_shape CHECK ((line_type = 'part' AND part_id IS NOT NULL) OR (line_type <> 'part' AND part_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_repair_lines_order ON public.repair_lines (order_id);
CREATE INDEX IF NOT EXISTS ix_repair_lines_service ON public.repair_lines (service_type_id);
CREATE INDEX IF NOT EXISTS ix_repair_lines_part ON public.repair_lines (part_id);
CREATE INDEX IF NOT EXISTS ix_repair_lines_consumed_by ON public.repair_lines (consumed_by);

CREATE TABLE IF NOT EXISTS public.repair_line_costs (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  repair_line_id uuid NOT NULL REFERENCES public.repair_lines(id) ON DELETE RESTRICT,
  cost_vnd       bigint NOT NULL,
  kind           text NOT NULL DEFAULT 'use' CHECK (kind IN ('use','reversal','other')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_repair_line_costs_line ON public.repair_line_costs (repair_line_id);

CREATE TABLE IF NOT EXISTS public.repair_status_history (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  order_id    uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE RESTRICT,
  from_status text,
  to_status   text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reason      text
);
CREATE INDEX IF NOT EXISTS ix_repair_status_history_order ON public.repair_status_history (order_id, at);
CREATE INDEX IF NOT EXISTS ix_repair_status_history_actor ON public.repair_status_history (actor_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_types','repair_orders','repair_lines','repair_line_costs','repair_status_history'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['service_types','repair_orders','repair_lines'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['repair_line_costs','repair_status_history'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__immutable ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_immutable()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate()', t, t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_repair_orders__updated_at ON public.repair_orders;
CREATE TRIGGER trg_repair_orders__updated_at BEFORE UPDATE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_repair_orders__fn_only ON public.repair_orders;
CREATE TRIGGER trg_repair_orders__fn_only BEFORE DELETE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only();

-- Dòng: chỉ sửa khi phiếu chưa hoàn thành/giao/hủy; dòng linh kiện đã dùng không sửa/xóa trực tiếp (BR-REP-07)
CREATE OR REPLACE FUNCTION app.tg_repair_line_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_status text; v_oid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;
BEGIN
  IF coalesce(current_setting('app.in_fn', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT status INTO v_status FROM public.repair_orders WHERE id = v_oid;
  IF v_status IN ('completed','delivered','cancelled') THEN
    PERFORM app.raise_wf('WF-REP-LOCKED', 'Phiếu sửa đã hoàn thành/giao/hủy — dòng đã khóa.');
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.consumed_at IS NOT NULL THEN
    PERFORM app.raise_wf('WF-REP-LOCKED', 'Linh kiện đã xác nhận dùng — hãy "Bỏ dùng" (hoàn kho) trước khi sửa/xóa dòng.');
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_repair_lines__guard ON public.repair_lines;
CREATE TRIGGER trg_repair_lines__guard BEFORE INSERT OR UPDATE OR DELETE ON public.repair_lines FOR EACH ROW EXECUTE FUNCTION app.tg_repair_line_guard();

-- ===== GRANT + RLS (PT-04: chỉ repair.*) =====
GRANT SELECT ON public.service_types, public.repair_orders, public.repair_lines, public.repair_status_history, public.repair_line_costs TO wf_app;
GRANT INSERT (code, name, default_price_vnd), UPDATE (name, default_price_vnd, is_active) ON public.service_types TO wf_app;
GRANT UPDATE (intake_condition, customer_complaint, findings, expected_date) ON public.repair_orders TO wf_app;
GRANT INSERT (order_id, line_no, line_type, service_type_id, part_id, description, qty, unit_price_vnd),
      UPDATE (line_no, service_type_id, description, qty, unit_price_vnd), DELETE ON public.repair_lines TO wf_app;
DROP POLICY IF EXISTS service_types_select ON public.service_types;
CREATE POLICY service_types_select ON public.service_types FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['repair.view','repair.create']));
DROP POLICY IF EXISTS service_types_write ON public.service_types;
CREATE POLICY service_types_write ON public.service_types FOR ALL TO wf_app USING (app.has_permission('repair.price.edit')) WITH CHECK (app.has_permission('repair.price.edit'));
DROP POLICY IF EXISTS repair_orders_select ON public.repair_orders;
CREATE POLICY repair_orders_select ON public.repair_orders FOR SELECT TO wf_app USING (app.has_permission('repair.view'));
DROP POLICY IF EXISTS repair_orders_update ON public.repair_orders;
CREATE POLICY repair_orders_update ON public.repair_orders FOR UPDATE TO wf_app
  USING (app.has_permission('repair.update') AND status NOT IN ('delivered','cancelled')) WITH CHECK (true);
DROP POLICY IF EXISTS repair_lines_select ON public.repair_lines;
CREATE POLICY repair_lines_select ON public.repair_lines FOR SELECT TO wf_app USING (app.has_permission('repair.view'));
DROP POLICY IF EXISTS repair_lines_write ON public.repair_lines;
CREATE POLICY repair_lines_write ON public.repair_lines FOR ALL TO wf_app USING (app.has_permission('repair.update')) WITH CHECK (app.has_permission('repair.update'));
DROP POLICY IF EXISTS repair_status_history_select ON public.repair_status_history;
CREATE POLICY repair_status_history_select ON public.repair_status_history FOR SELECT TO wf_app USING (app.has_permission('repair.view'));
DROP POLICY IF EXISTS repair_line_costs_select ON public.repair_line_costs;
CREATE POLICY repair_line_costs_select ON public.repair_line_costs FOR SELECT TO wf_app USING (app.has_permission('cost.view'));

-- ===== Tiện ích trạng thái =====
CREATE OR REPLACE FUNCTION app.set_repair_status(p_order uuid, p_to text, p_reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_from text;
BEGIN
  SELECT status INTO v_from FROM public.repair_orders WHERE id = p_order;
  IF v_from IS DISTINCT FROM p_to THEN
    UPDATE public.repair_orders SET status = p_to WHERE id = p_order;
    INSERT INTO public.repair_status_history (order_id, from_status, to_status, actor_id, reason) VALUES (p_order, v_from, p_to, app.current_user_id(), p_reason);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app.lock_repair(p_order uuid) RETURNS public.repair_orders
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders;
BEGIN
  SELECT * INTO r FROM public.repair_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu sửa.'); END IF;
  RETURN r;
END $$;

-- ===== Trạng thái tiền: nhánh repair (thay hàm 0008b, giữ nguyên các nhánh khác) =====
CREATE OR REPLACE FUNCTION app.doc_payment_state(p_doc_type text, p_doc_id uuid, p_lock boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s record; r record; c record; o record; v_in bigint; v_out bigint; v_lines bigint;
BEGIN
  IF p_doc_type = 'sale' THEN
    IF p_lock THEN SELECT * INTO s FROM public.sales WHERE id = p_doc_id FOR UPDATE; ELSE SELECT * INTO s FROM public.sales WHERE id = p_doc_id; END IF;
    IF NOT FOUND THEN RETURN jsonb_build_object('exists', false); END IF;
    SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0) INTO v_in FROM public.payments WHERE doc_type = 'sale' AND doc_id = p_doc_id AND status = 'posted';
    RETURN jsonb_build_object('exists', true, 'open', s.status = 'confirmed' AND s.collaborator_id IS NULL, 'customer_id', s.customer_id,
      'payable', s.grand_total_vnd - s.trade_in_total_vnd - s.deposit_applied_vnd, 'paid_net', v_in, 'locked_payments', false);
  ELSIF p_doc_type = 'reservation' THEN
    IF p_lock THEN SELECT * INTO r FROM public.reservations WHERE id = p_doc_id FOR UPDATE; ELSE SELECT * INTO r FROM public.reservations WHERE id = p_doc_id; END IF;
    IF NOT FOUND THEN RETURN jsonb_build_object('exists', false); END IF;
    SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0), coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0)
      INTO v_in, v_out FROM public.payments WHERE doc_type = 'reservation' AND doc_id = p_doc_id AND status = 'posted';
    RETURN jsonb_build_object('exists', true, 'open', r.status IN ('active','expired'), 'customer_id', r.customer_id,
      'payable', r.price_snapshot_vnd, 'paid_net', v_in - v_out, 'refundable', v_in - v_out - r.applied_vnd - r.forfeited_vnd);
  ELSIF p_doc_type = 'settlement' THEN
    IF p_lock THEN SELECT * INTO c FROM public.collaborator_settlements WHERE id = p_doc_id FOR UPDATE; ELSE SELECT * INTO c FROM public.collaborator_settlements WHERE id = p_doc_id; END IF;
    IF NOT FOUND THEN RETURN jsonb_build_object('exists', false); END IF;
    SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0) INTO v_in FROM public.payments WHERE doc_type = 'settlement' AND doc_id = p_doc_id AND status = 'posted';
    RETURN jsonb_build_object('exists', true, 'open', c.status = 'confirmed', 'customer_id', NULL, 'payable', c.total_vnd, 'paid_net', v_in, 'locked_payments', true);
  ELSIF p_doc_type = 'repair' THEN
    IF p_lock THEN SELECT * INTO o FROM public.repair_orders WHERE id = p_doc_id FOR UPDATE; ELSE SELECT * INTO o FROM public.repair_orders WHERE id = p_doc_id; END IF;
    IF NOT FOUND THEN RETURN jsonb_build_object('exists', false); END IF;
    SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0), coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0)
      INTO v_in, v_out FROM public.payments WHERE doc_type = 'repair' AND doc_id = p_doc_id AND status = 'posted';
    SELECT coalesce(sum(line_total_vnd), 0) INTO v_lines FROM public.repair_lines WHERE order_id = p_doc_id;
    -- Trước khi giao: nhận trước (cọc) không giới hạn bởi tổng tạm tính (khách có thể đặt cọc trước khi có báo giá); khi giao: phải thu = tổng chốt
    RETURN jsonb_build_object('exists', true,
      'open', o.kind = 'customer' AND o.charge_mode = 'paid' AND o.status NOT IN ('cancelled'),
      'customer_id', o.customer_id,
      'payable', CASE WHEN o.status = 'delivered' THEN o.final_total_vnd ELSE greatest(v_lines, v_in - v_out) + 1000000000000 END,
      'paid_net', v_in - v_out, 'refundable', v_in - v_out, 'locked_payments', false);
  END IF;
  RETURN jsonb_build_object('exists', false);
END $$;

-- ===== Nhận máy (BR-REP-01/02, BR-REP-11, BR-WAR-02) =====
-- p: {kind, chargeMode, customerId, customerWatchId, brandText, modelText, serialNo, unitId, warrantyId, intakeCondition, complaint, expectedDate,
--     deposit:{method, amount}}
CREATE OR REPLACE FUNCTION app.fn_create_repair(p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_kind text := coalesce(p->>'kind', 'customer'); v_charge text := coalesce(p->>'chargeMode', 'paid'); v_id uuid; v_code text;
        v_cust uuid := nullif(p->>'customerId', '')::uuid; v_cw uuid := nullif(p->>'customerWatchId', '')::uuid; v_unit uuid := nullif(p->>'unitId', '')::uuid;
        v_war uuid := nullif(p->>'warrantyId', '')::uuid; w public.warranties; u public.watch_units; v_prev text; v_pay jsonb;
BEGIN
  PERFORM app.require_permission('repair.create');
  SET LOCAL lock_timeout = '5s';
  IF v_kind NOT IN ('customer','internal') OR v_charge NOT IN ('paid','warranty_free') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Loại phiếu sửa không hợp lệ.'); END IF;
  IF v_kind = 'internal' THEN
    IF v_unit IS NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Sửa nội bộ cần chọn chiếc của cửa hàng.'); END IF;
    u := app.lock_unit(v_unit);
    IF u.status NOT IN ('in_stock','inspecting') THEN PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', format('Chiếc %s không ở kho để sửa nội bộ.', u.asset_code)); END IF;
    v_prev := u.status; v_charge := 'paid'; v_cust := NULL; v_cw := NULL;
  ELSE
    IF v_charge = 'warranty_free' THEN
      SELECT * INTO w FROM public.warranties WHERE id = v_war;
      IF NOT FOUND OR w.status = 'voided' THEN PERFORM app.raise_wf('WF-WAR-NOT-FOUND', 'Không tìm thấy bảo hành còn hiệu lực.'); END IF;
      IF w.status = 'expired' OR w.end_date < app.today_vn() THEN PERFORM app.raise_wf('WF-WAR-EXPIRED', 'Bảo hành đã hết hạn — hãy nhận máy tính phí.'); END IF;
      v_cust := coalesce(v_cust, w.customer_id);
      v_unit := coalesce(v_unit, w.unit_id);
      v_cw := coalesce(v_cw, w.customer_watch_id);
    END IF;
    IF v_cust IS NULL OR NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_cust AND phone IS NOT NULL AND anonymized_at IS NULL) THEN
      PERFORM app.raise_wf('WF-VALIDATION', 'Nhận máy cần khách có tên và số điện thoại.');
    END IF;
    IF v_cw IS NULL AND v_unit IS NULL THEN
      IF coalesce(nullif(btrim(p->>'brandText'), ''), nullif(btrim(p->>'modelText'), ''), nullif(btrim(p->>'serialNo'), '')) IS NULL THEN
        PERFORM app.raise_wf('WF-VALIDATION', 'Nhập thương hiệu/loại/serial của máy khách.');
      END IF;
      INSERT INTO public.customer_watches (customer_id, brand_text, model_text, serial_no, created_by)
      VALUES (v_cust, nullif(btrim(p->>'brandText'), ''), nullif(btrim(p->>'modelText'), ''), nullif(btrim(p->>'serialNo'), ''), app.current_user_id()) RETURNING id INTO v_cw;
    END IF;
    IF coalesce(nullif(btrim(p->>'complaint'), ''), '') = '' THEN PERFORM app.raise_wf('WF-VALIDATION', 'Ghi lỗi khách mô tả.'); END IF;
  END IF;
  v_code := app.fn_next_number('SC');
  INSERT INTO public.repair_orders (code, kind, charge_mode, customer_id, customer_watch_id, unit_id, warranty_id, prev_unit_status, received_by,
                                    intake_condition, customer_complaint, expected_date)
  VALUES (v_code, v_kind, v_charge, v_cust, v_cw, v_unit, CASE WHEN v_charge = 'warranty_free' THEN v_war END, v_prev, app.current_user_id(),
          nullif(btrim(p->>'intakeCondition'), ''), nullif(btrim(p->>'complaint'), ''), nullif(p->>'expectedDate', '')::date)
  RETURNING id INTO v_id;
  INSERT INTO public.repair_status_history (order_id, from_status, to_status, actor_id) VALUES (v_id, NULL, 'received', app.current_user_id());
  IF v_kind = 'internal' THEN
    PERFORM app.set_unit_status(v_unit, 'in_repair', 'Sửa nội bộ ' || v_code, 'repair_orders', v_id);
  END IF;
  IF (p->'deposit'->>'amount')::bigint > 0 THEN
    IF v_kind <> 'customer' OR v_charge <> 'paid' THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chỉ phiếu sửa tính phí của khách mới nhận cọc.'); END IF;
    v_pay := app.fn_record_payment('repair', v_id, 'repair_receipt', coalesce(p->'deposit'->>'method', 'cash'), (p->'deposit'->>'amount')::bigint);
  END IF;
  PERFORM app.fn_emit_event('repair.received', jsonb_build_object('repairId', v_id, 'code', v_code));
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'status', 'received', 'deposit', v_pay);
END $$;

-- Đổi trạng thái tiến độ (BR-REP-03): received/inspecting/repairing/waiting_parts; completed → repairing cần lý do (mở khóa)
CREATE OR REPLACE FUNCTION app.fn_set_repair_status(p_order uuid, p_to text, p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  PERFORM app.require_permission('repair.update');
  IF p_to NOT IN ('inspecting','repairing','waiting_parts') THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Dùng nút Hoàn thành / Giao / Hủy cho các bước đó.'); END IF;
  r := app.lock_repair(p_order);
  IF r.status IN ('delivered','cancelled') THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Phiếu sửa đã giao hoặc đã hủy.'); END IF;
  IF r.status = 'completed' THEN
    IF p_to <> 'repairing' THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Phiếu đã hoàn thành chỉ có thể "làm lại".'); END IF;
    v_reason := app.require_reason(p_reason);
    UPDATE public.repair_orders SET completed_at = NULL, final_total_vnd = 0 WHERE id = p_order;
  END IF;
  IF p_to = 'repairing' AND r.kind = 'customer' AND r.charge_mode = 'paid' AND r.quote_approved_at IS NULL
     AND coalesce((app.setting('repair.require_quote_approval', 'false'))::boolean, false) THEN
    PERFORM app.raise_wf('WF-REP-QUOTE-NOT-APPROVED', 'Cần ghi nhận khách đồng ý báo giá trước khi sửa.');
  END IF;
  PERFORM app.set_repair_status(p_order, p_to, v_reason);
  RETURN jsonb_build_object('id', p_order, 'status', p_to);
END $$;

CREATE OR REPLACE FUNCTION app.fn_approve_quote(p_order uuid, p_channel text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders;
BEGIN
  PERFORM app.require_permission('repair.update');
  r := app.lock_repair(p_order);
  IF r.status IN ('completed','delivered','cancelled') THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Phiếu không còn ở bước báo giá.'); END IF;
  UPDATE public.repair_orders SET quote_approved_at = now(), quote_approved_by = app.current_user_id(), quote_approved_channel = coalesce(nullif(btrim(p_channel), ''), 'tại quầy')
  WHERE id = p_order;
  RETURN jsonb_build_object('id', p_order, 'quoteApproved', true);
END $$;

-- Xác nhận dùng linh kiện (BR-PART-03, CT-04): khóa dòng parts; không âm; chốt giá vốn bình quân
CREATE OR REPLACE FUNCTION app.use_repair_line(p_line uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l public.repair_lines; v_qty int; v_avg numeric(14,4); v_code text;
BEGIN
  SELECT * INTO l FROM public.repair_lines WHERE id = p_line;
  IF l.line_type <> 'part' OR l.consumed_at IS NOT NULL THEN RETURN; END IF;
  SELECT p.qty_on_hand, pc.avg_cost, p.code INTO v_qty, v_avg, v_code FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id FOR UPDATE OF p;
  IF v_qty < l.qty THEN PERFORM app.raise_wf('WF-REP-PART-INSUFFICIENT', format('Linh kiện %s chỉ còn %s, không đủ %s.', v_code, v_qty, l.qty)); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.parts SET qty_on_hand = qty_on_hand - l.qty WHERE id = l.part_id;
  INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, actor_id)
  VALUES (l.part_id, -l.qty, v_avg, 'repair_use', v_qty, v_avg, 'repair_orders', l.order_id, app.current_user_id());
  INSERT INTO public.repair_line_costs (repair_line_id, cost_vnd, kind) VALUES (l.id, app.round_vnd(l.qty * v_avg), 'use');
  UPDATE public.repair_lines SET consumed_at = now(), consumed_by = app.current_user_id() WHERE id = l.id;
END $$;

CREATE OR REPLACE FUNCTION app.fn_use_repair_part(p_line uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l public.repair_lines; r public.repair_orders;
BEGIN
  PERFORM app.require_permission('repair.update');
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO l FROM public.repair_lines WHERE id = p_line;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy dòng sửa.'); END IF;
  IF l.line_type <> 'part' THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chỉ dòng linh kiện mới "xác nhận dùng".'); END IF;
  PERFORM 1 FROM public.parts WHERE id = l.part_id FOR UPDATE;   -- thứ tự khóa: linh kiện → chứng từ
  r := app.lock_repair(l.order_id);
  IF r.status IN ('completed','delivered','cancelled') THEN PERFORM app.raise_wf('WF-REP-LOCKED', 'Phiếu sửa đã khóa.'); END IF;
  IF l.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('id', p_line, 'consumed', true); END IF;
  PERFORM app.use_repair_line(p_line);
  RETURN jsonb_build_object('id', p_line, 'consumed', true);
END $$;

-- Bỏ dùng linh kiện (hoàn kho theo giá vốn đã chốt; bút toán đảo âm)
CREATE OR REPLACE FUNCTION app.unuse_repair_line(p_line uuid, p_reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l public.repair_lines; v_qty int; v_avg numeric(14,4); v_cost bigint;
BEGIN
  SELECT * INTO l FROM public.repair_lines WHERE id = p_line;
  IF l.line_type <> 'part' OR l.consumed_at IS NULL THEN RETURN; END IF;
  SELECT coalesce(sum(cost_vnd), 0) INTO v_cost FROM public.repair_line_costs WHERE repair_line_id = l.id;
  SELECT p.qty_on_hand, pc.avg_cost INTO v_qty, v_avg FROM public.parts p JOIN public.part_costs pc ON pc.part_id = p.id WHERE p.id = l.part_id FOR UPDATE OF p;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.part_costs SET avg_cost = round((v_qty * v_avg + v_cost) / (v_qty + l.qty), 4), updated_at = now() WHERE part_id = l.part_id;
  UPDATE public.parts SET qty_on_hand = qty_on_hand + l.qty WHERE id = l.part_id;
  INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, ref_table, ref_id, reason, actor_id)
  VALUES (l.part_id, l.qty, round(v_cost::numeric / l.qty, 4), 'repair_return', v_qty, v_avg, 'repair_orders', l.order_id, p_reason, app.current_user_id());
  INSERT INTO public.repair_line_costs (repair_line_id, cost_vnd, kind) VALUES (l.id, -v_cost, 'reversal');
  UPDATE public.repair_lines SET consumed_at = NULL, consumed_by = NULL WHERE id = l.id;
END $$;

CREATE OR REPLACE FUNCTION app.fn_unuse_repair_part(p_line uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l public.repair_lines; r public.repair_orders;
BEGIN
  PERFORM app.require_permission('repair.update');
  SELECT * INTO l FROM public.repair_lines WHERE id = p_line;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy dòng sửa.'); END IF;
  PERFORM 1 FROM public.parts WHERE id = l.part_id FOR UPDATE;
  r := app.lock_repair(l.order_id);
  IF r.status IN ('completed','delivered','cancelled') THEN PERFORM app.raise_wf('WF-REP-LOCKED', 'Phiếu sửa đã khóa — hãy "làm lại" trước.'); END IF;
  PERFORM app.unuse_repair_line(p_line, coalesce(nullif(btrim(p_reason), ''), 'Bỏ dùng linh kiện'));
  RETURN jsonb_build_object('id', p_line, 'consumed', false);
END $$;

-- Hoàn thành (BR-REP-07, BR-REP-11, BR-COST-04): dùng nốt linh kiện chưa xác nhận, khóa dòng; nội bộ vốn hóa vào giá vốn chiếc
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
    PERFORM app.set_repair_status(p_order, 'delivered', 'Sửa nội bộ: hoàn thành & đưa lại kho');
    UPDATE public.repair_orders SET delivered_at = now(), delivered_date = app.today_vn(), delivered_by = app.current_user_id() WHERE id = p_order;
  ELSE
    PERFORM app.set_repair_status(p_order, 'completed', NULL);
  END IF;
  PERFORM app.fn_emit_event('repair.completed', jsonb_build_object('repairId', p_order));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', CASE WHEN r.kind = 'internal' THEN 'delivered' ELSE 'completed' END,
    'finalTotal', CASE WHEN r.kind = 'customer' AND r.charge_mode = 'paid' THEN v_total ELSE 0 END, 'capitalized', v_parts + v_other);
END $$;

-- Giao máy (BR-REP-07): doanh thu ghi nhận lúc giao; thu tiền/ghi nợ; bảo hành sau sửa (BR-WAR-01)
CREATE OR REPLACE FUNCTION app.fn_deliver_repair(p_order uuid, p_payments jsonb DEFAULT '[]', p_due_date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders; st jsonb; v_paid bigint; v_due bigint; p jsonb; v_days int; v_w uuid; v_new bigint := 0;
BEGIN
  PERFORM app.require_permission('repair.deliver');
  SET LOCAL lock_timeout = '5s';
  r := app.lock_repair(p_order);
  IF r.status <> 'completed' THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Chỉ giao máy đã hoàn thành.'); END IF;
  IF r.kind <> 'customer' THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Phiếu nội bộ không giao khách.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.repair_orders SET delivered_at = now(), delivered_date = app.today_vn(), delivered_by = app.current_user_id(),
    revenue_vnd = CASE WHEN charge_mode = 'paid' THEN final_total_vnd ELSE 0 END, due_date = p_due_date WHERE id = p_order;
  PERFORM app.set_repair_status(p_order, 'delivered', NULL);
  st := app.doc_payment_state('repair', p_order, false);
  v_paid := (st->>'paid_net')::bigint;
  IF v_paid > r.final_total_vnd THEN
    PERFORM app.raise_wf('WF-PAY-OVERPAY', 'Tiền đã nhận trước lớn hơn tổng tiền sửa — hãy hoàn bớt trước khi giao.');
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(p_payments, '[]')) LOOP
    IF (p->>'amount')::bigint > 0 THEN
      IF r.charge_mode <> 'paid' THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu bảo hành miễn phí không thu tiền.'); END IF;
      PERFORM app.fn_record_payment('repair', p_order, 'repair_receipt', p->>'method', (p->>'amount')::bigint);
      PERFORM set_config('app.in_fn', 'on', true);
      v_new := v_new + (p->>'amount')::bigint;
    END IF;
  END LOOP;
  v_due := r.final_total_vnd - v_paid - v_new;
  IF v_due > 0 AND NOT coalesce((app.setting('repair.allow_delivery_with_debt', 'true'))::boolean, true) THEN
    PERFORM app.raise_wf('WF-PAY-DOC-INVALID', 'Cần thu đủ tiền trước khi giao máy.');
  END IF;
  IF v_due > 0 AND p_due_date IS NULL THEN
    UPDATE public.repair_orders SET due_date = app.today_vn() + app.setting_int('sales.default_due_days', 7) WHERE id = p_order;
  END IF;
  IF r.charge_mode = 'paid' AND r.final_total_vnd > 0 THEN
    v_days := app.setting_int('warranty.repair_days', 90);
    IF v_days > 0 THEN
      INSERT INTO public.warranties (code, kind, unit_id, customer_watch_id, repair_order_id, customer_id, start_date, end_date, terms)
      VALUES (app.fn_next_number('BH'), 'repair', r.unit_id, r.customer_watch_id, p_order, r.customer_id, app.today_vn(), app.today_vn() + v_days,
              app.setting('store.warranty_terms', '""') #>> '{}') RETURNING id INTO v_w;
    END IF;
  END IF;
  PERFORM app.fn_emit_event('repair.delivered', jsonb_build_object('repairId', p_order, 'revenue', CASE WHEN r.charge_mode = 'paid' THEN r.final_total_vnd ELSE 0 END));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', 'delivered', 'total', r.final_total_vnd, 'paid', v_paid + v_new, 'due', v_due, 'warrantyId', v_w);
END $$;

-- Hủy phiếu (BR-REP-15): trước completed — hoàn linh kiện đã dùng, hoàn cọc, chiếc nội bộ về trạng thái cũ
CREATE OR REPLACE FUNCTION app.fn_cancel_repair(p_order uuid, p_reason text, p_refund_method text DEFAULT 'cash') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.repair_orders; v_reason text; l record; st jsonb; v_held bigint;
BEGIN
  PERFORM app.require_permission('repair.update');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO r FROM public.repair_orders WHERE id = p_order;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu sửa.'); END IF;
  IF r.kind = 'internal' THEN PERFORM app.lock_unit(r.unit_id); END IF;
  PERFORM 1 FROM public.parts WHERE id IN (SELECT part_id FROM public.repair_lines WHERE order_id = p_order AND part_id IS NOT NULL) ORDER BY id FOR UPDATE;
  r := app.lock_repair(p_order);
  IF r.status IN ('completed','delivered','cancelled') THEN PERFORM app.raise_wf('WF-REP-INVALID-STATUS', 'Chỉ hủy phiếu chưa hoàn thành.'); END IF;
  FOR l IN SELECT id FROM public.repair_lines WHERE order_id = p_order AND consumed_at IS NOT NULL ORDER BY line_no LOOP
    PERFORM app.unuse_repair_line(l.id, 'Hủy phiếu sửa: ' || v_reason);
  END LOOP;
  PERFORM set_config('app.in_fn', 'on', true);
  st := app.doc_payment_state('repair', p_order, false);
  v_held := (st->>'paid_net')::bigint;
  IF v_held > 0 THEN
    PERFORM app.fn_record_payment('repair', p_order, 'repair_deposit_refund', coalesce(p_refund_method, 'cash'), v_held, NULL, 'Hoàn cọc do hủy phiếu sửa');
    PERFORM set_config('app.in_fn', 'on', true);
  END IF;
  IF r.kind = 'internal' THEN
    PERFORM app.set_unit_status(r.unit_id, coalesce(r.prev_unit_status, 'in_stock'), 'Hủy sửa nội bộ ' || r.code, 'repair_orders', p_order);
  END IF;
  UPDATE public.repair_orders SET cancel_reason = v_reason WHERE id = p_order;
  PERFORM app.set_repair_status(p_order, 'cancelled', v_reason);
  PERFORM app.fn_emit_event('repair.cancelled', jsonb_build_object('repairId', p_order));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', 'cancelled', 'refunded', greatest(v_held, 0));
END $$;

-- ===== v_doc_balances: thêm phiếu sửa =====
CREATE OR REPLACE VIEW public.v_doc_balances WITH (security_invoker = true) AS
  SELECT 'sale'::text AS doc_type, s.id AS doc_id, s.customer_id, s.code, s.doc_date, s.due_date,
         (s.grand_total_vnd - s.trade_in_total_vnd - s.deposit_applied_vnd)::bigint AS payable,
         coalesce(p.paid, 0)::bigint AS paid_net,
         (s.grand_total_vnd - s.trade_in_total_vnd - s.deposit_applied_vnd - coalesce(p.paid, 0))::bigint AS due,
         0::bigint AS held
  FROM public.sales s
  LEFT JOIN LATERAL (SELECT sum(amount_vnd) FILTER (WHERE direction = 'in') - coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0) AS paid
                     FROM public.payments WHERE doc_type = 'sale' AND doc_id = s.id AND status = 'posted') p ON true
  WHERE s.status = 'confirmed' AND s.collaborator_id IS NULL
  UNION ALL
  SELECT 'reservation', r.id, r.customer_id, r.code, r.doc_date, r.hold_until, r.price_snapshot_vnd, coalesce(p.paid, 0), 0,
         (coalesce(p.paid, 0) - r.applied_vnd - r.forfeited_vnd)::bigint
  FROM public.reservations r
  LEFT JOIN LATERAL (SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0) - coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0) AS paid
                     FROM public.payments WHERE doc_type = 'reservation' AND doc_id = r.id AND status = 'posted') p ON true
  UNION ALL
  SELECT 'repair', o.id, o.customer_id, o.code, coalesce(o.delivered_date, o.received_date), o.due_date,
         CASE WHEN o.status = 'delivered' THEN o.final_total_vnd ELSE 0 END::bigint, coalesce(p.paid, 0)::bigint,
         CASE WHEN o.status = 'delivered' THEN o.final_total_vnd - coalesce(p.paid, 0) ELSE 0 END::bigint,
         CASE WHEN o.status = 'delivered' THEN 0 ELSE coalesce(p.paid, 0) END::bigint
  FROM public.repair_orders o
  LEFT JOIN LATERAL (SELECT coalesce(sum(amount_vnd) FILTER (WHERE direction = 'in'), 0) - coalesce(sum(amount_vnd) FILTER (WHERE direction = 'out'), 0) AS paid
                     FROM public.payments WHERE doc_type = 'repair' AND doc_id = o.id AND status = 'posted') p ON true
  WHERE o.kind = 'customer';
ALTER VIEW public.v_doc_balances OWNER TO wf_owner;

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.tg_repair_line_guard()','app.set_repair_status(uuid,text,text)','app.lock_repair(uuid)','app.doc_payment_state(text,uuid,boolean)',
    'app.fn_create_repair(jsonb)','app.fn_set_repair_status(uuid,text,text)','app.fn_approve_quote(uuid,text)','app.use_repair_line(uuid)',
    'app.fn_use_repair_part(uuid)','app.unuse_repair_line(uuid,text)','app.fn_unuse_repair_part(uuid,text)',
    'app.fn_complete_repair(uuid,text,text,text,text)','app.fn_deliver_repair(uuid,jsonb,date)','app.fn_cancel_repair(uuid,text,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.tg_repair_line_guard() TO wf_app, wf_definer, wf_worker;
GRANT EXECUTE ON FUNCTION app.doc_payment_state(text,uuid,boolean) TO wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_create_repair(jsonb), app.fn_set_repair_status(uuid,text,text), app.fn_approve_quote(uuid,text), app.fn_use_repair_part(uuid),
  app.fn_unuse_repair_part(uuid,text), app.fn_complete_repair(uuid,text,text,text,text), app.fn_deliver_repair(uuid,jsonb,date), app.fn_cancel_repair(uuid,text,text) TO wf_app;

-- ===== Dữ liệu tham chiếu =====
INSERT INTO public.service_types (code, name, default_price_vnd) VALUES
  ('thay_pin','Thay pin',100000), ('thay_kinh','Thay kính',0), ('bao_duong','Bảo dưỡng máy',300000), ('danh_bong','Đánh bóng',0),
  ('thay_day','Thay dây',0), ('lau_dau','Lau dầu',0), ('khac','Khác',0)
ON CONFLICT (code) DO NOTHING;

COMMIT;
