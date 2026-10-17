-- 0008_sales.sql — Bán hàng, giữ hàng/cọc, thu cũ đổi mới, bảo hành (M5a): reservations, sales, sale_lines, sale_line_costs (append-only,
-- cost.view), sale_trade_ins, warranties; fn_create_reservation, fn_cancel_reservation, fn_confirm_sale, fn_void_sale; doc_payment_state
-- (nhánh sale/reservation); view v_doc_balances. BR-SALE-01…16, BR-RSV-01…05, BR-TRD-01…04, BR-WAR-01/05, BR-COST-02, BR-PAY-*.
-- SC-02…07, SC-13, SC-15; CT-01/02/03/05/07. Không đổi trả (CF-02). Idempotent.
BEGIN;

-- Thời điểm hiện tại (DB test cho phép ghi đè qua app.test_now để thử cửa sổ hủy 24 giờ)
CREATE OR REPLACE FUNCTION app.now_ts() RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  IF current_setting('app.env', true) = 'test' THEN
    v := nullif(current_setting('app.test_now', true), '');
    IF v IS NOT NULL THEN RETURN v::timestamptz; END IF;
  END IF;
  RETURN now();
END $$;
ALTER FUNCTION app.now_ts() OWNER TO wf_owner;
REVOKE ALL ON FUNCTION app.now_ts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.now_ts() TO wf_app, wf_worker, wf_definer;

-- ===== Bảng =====
CREATE TABLE IF NOT EXISTS public.reservations (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code            text NOT NULL UNIQUE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  unit_id         uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  doc_date        date NOT NULL,
  hold_until      date NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','converted','cancelled','forfeited')),
  price_snapshot_vnd bigint NOT NULL CHECK (price_snapshot_vnd >= 0),
  min_deposit_vnd bigint NOT NULL DEFAULT 0 CHECK (min_deposit_vnd >= 0),
  applied_vnd     bigint NOT NULL DEFAULT 0 CHECK (applied_vnd >= 0),
  forfeited_vnd   bigint NOT NULL DEFAULT 0 CHECK (forfeited_vnd >= 0),
  sale_id         uuid,
  note            text,
  settled_at      timestamptz,
  settled_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  settle_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_unit_active ON public.reservations (unit_id) WHERE status IN ('active','expired');
CREATE INDEX IF NOT EXISTS ix_reservations_customer ON public.reservations (customer_id);
CREATE INDEX IF NOT EXISTS ix_reservations_unit ON public.reservations (unit_id);
CREATE INDEX IF NOT EXISTS ix_reservations_status ON public.reservations (status, hold_until);
CREATE INDEX IF NOT EXISTS ix_reservations_settled_by ON public.reservations (settled_by);
CREATE INDEX IF NOT EXISTS ix_reservations_created_by ON public.reservations (created_by);
CREATE INDEX IF NOT EXISTS ix_reservations_sale ON public.reservations (sale_id);

CREATE TABLE IF NOT EXISTS public.sales (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code               text UNIQUE,
  customer_id        uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  doc_date           date NOT NULL DEFAULT app.today_vn(),
  backdate_reason    text,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','voided')),
  collaborator_id    uuid REFERENCES public.users(id) ON DELETE RESTRICT,   -- đơn CTV (M5b)
  reservation_id     uuid REFERENCES public.reservations(id) ON DELETE RESTRICT,
  order_discount_vnd bigint NOT NULL DEFAULT 0 CHECK (order_discount_vnd >= 0),
  subtotal_list_vnd  bigint NOT NULL DEFAULT 0 CHECK (subtotal_list_vnd >= 0),
  discount_total_vnd bigint NOT NULL DEFAULT 0 CHECK (discount_total_vnd >= 0),
  grand_total_vnd    bigint NOT NULL DEFAULT 0 CHECK (grand_total_vnd >= 0),
  trade_in_total_vnd bigint NOT NULL DEFAULT 0 CHECK (trade_in_total_vnd >= 0),
  deposit_applied_vnd bigint NOT NULL DEFAULT 0 CHECK (deposit_applied_vnd >= 0),
  cash_tendered_vnd  bigint,
  due_date           date,
  note               text,
  confirmed_at       timestamptz,
  confirmed_by       uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at          timestamptz,
  voided_by          uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  void_reason        text,
  print_count        integer NOT NULL DEFAULT 0,
  version            integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT sales_confirmed_fields CHECK (status = 'draft' OR (code IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_sales_doc_date ON public.sales (doc_date);
CREATE INDEX IF NOT EXISTS ix_sales_customer ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS ix_sales_status ON public.sales (status);
CREATE INDEX IF NOT EXISTS ix_sales_created_by ON public.sales (created_by);
CREATE INDEX IF NOT EXISTS ix_sales_collaborator ON public.sales (collaborator_id);
CREATE INDEX IF NOT EXISTS ix_sales_reservation ON public.sales (reservation_id);
CREATE INDEX IF NOT EXISTS ix_sales_confirmed_by ON public.sales (confirmed_by);
CREATE INDEX IF NOT EXISTS ix_sales_voided_by ON public.sales (voided_by);
CREATE INDEX IF NOT EXISTS ix_sales_updated_by ON public.sales (updated_by);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_sale_fk') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_sale_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sale_lines (
  id                      uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  sale_id                 uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  line_no                 integer NOT NULL CHECK (line_no >= 1),
  line_type               text NOT NULL CHECK (line_type IN ('watch','part')),
  unit_id                 uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  part_id                 uuid REFERENCES public.parts(id) ON DELETE RESTRICT,
  qty                     integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  list_price_snapshot_vnd bigint NOT NULL DEFAULT 0 CHECK (list_price_snapshot_vnd >= 0),
  unit_price_vnd          bigint NOT NULL CHECK (unit_price_vnd >= 0),
  line_discount_vnd       bigint NOT NULL DEFAULT 0,
  alloc_discount_vnd      bigint NOT NULL DEFAULT 0 CHECK (alloc_discount_vnd >= 0),
  line_total_vnd          bigint NOT NULL DEFAULT 0 CHECK (line_total_vnd >= 0),
  shop_revenue_vnd        bigint NOT NULL DEFAULT 0 CHECK (shop_revenue_vnd >= 0),
  is_effective            boolean NOT NULL DEFAULT false,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_lines_no UNIQUE (sale_id, line_no),
  CONSTRAINT sale_lines_shape CHECK ((line_type = 'watch' AND unit_id IS NOT NULL AND part_id IS NULL AND qty = 1)
                                     OR (line_type = 'part' AND part_id IS NOT NULL AND unit_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sale_lines_effective_unit ON public.sale_lines (unit_id) WHERE is_effective AND unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sale_lines_sale ON public.sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS ix_sale_lines_unit ON public.sale_lines (unit_id);
CREATE INDEX IF NOT EXISTS ix_sale_lines_part ON public.sale_lines (part_id);

CREATE TABLE IF NOT EXISTS public.sale_line_costs (
  sale_line_id uuid PRIMARY KEY REFERENCES public.sale_lines(id) ON DELETE RESTRICT,
  cost_vnd     bigint NOT NULL CHECK (cost_vnd >= 0),
  cost_cycle   integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_trade_ins (
  id                  uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  sale_id             uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  purchase_receipt_id uuid UNIQUE REFERENCES public.purchase_receipts(id) ON DELETE RESTRICT,
  credit_vnd          bigint NOT NULL CHECK (credit_vnd > 0),
  -- nháp: thông tin máy cũ (loại, serial, tình trạng, hạng, vị trí, trạng thái ban đầu, chiếc cũ của cửa hàng nếu có)
  draft_line          jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sale_trade_ins_sale ON public.sale_trade_ins (sale_id);

CREATE TABLE IF NOT EXISTS public.warranties (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code               text NOT NULL UNIQUE,
  kind               text NOT NULL CHECK (kind IN ('sale','repair')),
  unit_id            uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  customer_watch_id  uuid REFERENCES public.customer_watches(id) ON DELETE RESTRICT,
  sale_line_id       uuid REFERENCES public.sale_lines(id) ON DELETE RESTRICT,
  repair_order_id    uuid,
  customer_id        uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  terms              text,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','voided')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranties_range CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS ix_warranties_end ON public.warranties (end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_warranties_unit ON public.warranties (unit_id);
CREATE INDEX IF NOT EXISTS ix_warranties_customer_watch ON public.warranties (customer_watch_id);
CREATE INDEX IF NOT EXISTS ix_warranties_sale_line ON public.warranties (sale_line_id);
CREATE INDEX IF NOT EXISTS ix_warranties_repair ON public.warranties (repair_order_id);
CREATE INDEX IF NOT EXISTS ix_warranties_customer ON public.warranties (customer_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservations','sales','sale_lines','sale_line_costs','sale_trade_ins','warranties'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['reservations','sales','sale_lines','sale_trade_ins','warranties'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
  END LOOP;
END $$;
GRANT UPDATE (status) ON public.warranties TO wf_worker;
DROP TRIGGER IF EXISTS trg_sale_line_costs__immutable ON public.sale_line_costs;
CREATE TRIGGER trg_sale_line_costs__immutable BEFORE UPDATE OR DELETE ON public.sale_line_costs FOR EACH ROW EXECUTE FUNCTION app.tg_immutable();
DROP TRIGGER IF EXISTS trg_sale_line_costs__no_truncate ON public.sale_line_costs;
CREATE TRIGGER trg_sale_line_costs__no_truncate BEFORE TRUNCATE ON public.sale_line_costs FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate();
DROP TRIGGER IF EXISTS trg_sales__updated_at ON public.sales;
CREATE TRIGGER trg_sales__updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_sales__guard ON public.sales;
CREATE TRIGGER trg_sales__guard BEFORE UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION app.tg_confirmed_doc_guard();

-- Dòng/thu cũ chỉ sửa khi phiếu còn nháp
CREATE OR REPLACE FUNCTION app.tg_sale_child_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_status text; v_sid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
BEGIN
  IF coalesce(current_setting('app.in_fn', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT status INTO v_status FROM public.sales WHERE id = v_sid;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu bán đã xác nhận/hủy, không sửa được.'); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sale_lines','sale_trade_ins'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_sale_child_guard()', t, t);
  END LOOP;
END $$;
-- Giữ hàng: không xóa; chỉ fn_* đổi
CREATE OR REPLACE FUNCTION app.tg_fn_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.in_fn', true), '') <> 'on' THEN
    PERFORM app.raise_wf('WF-IMMUTABLE', 'Dữ liệu này chỉ thay đổi qua nghiệp vụ (' || TG_TABLE_NAME || ').');
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
ALTER FUNCTION app.tg_fn_only() OWNER TO wf_owner;
REVOKE ALL ON FUNCTION app.tg_fn_only() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_fn_only() TO wf_app, wf_worker, wf_definer;
DROP TRIGGER IF EXISTS trg_reservations__fn_only ON public.reservations;
CREATE TRIGGER trg_reservations__fn_only BEFORE UPDATE OR DELETE ON public.reservations FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only();
DROP TRIGGER IF EXISTS trg_warranties__fn_only ON public.warranties;
CREATE TRIGGER trg_warranties__fn_only BEFORE DELETE ON public.warranties FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only();

-- ===== GRANT + RLS =====
GRANT SELECT ON public.sales, public.sale_lines, public.sale_trade_ins, public.reservations, public.warranties, public.sale_line_costs TO wf_app;
GRANT INSERT (customer_id, doc_date, backdate_reason, reservation_id, order_discount_vnd, due_date, note, created_by, collaborator_id),
      UPDATE (customer_id, doc_date, backdate_reason, reservation_id, order_discount_vnd, due_date, note), DELETE ON public.sales TO wf_app;
GRANT INSERT (sale_id, line_no, line_type, unit_id, part_id, qty, unit_price_vnd, note),
      UPDATE (line_no, unit_id, part_id, qty, unit_price_vnd, note), DELETE ON public.sale_lines TO wf_app;
GRANT INSERT (sale_id, credit_vnd, draft_line), UPDATE (credit_vnd, draft_line), DELETE ON public.sale_trade_ins TO wf_app;

CREATE OR REPLACE FUNCTION app.sale_visible(p_created_by uuid, p_collab uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT app.has_permission('sale.view') OR (app.has_permission('sale.view_own') AND (p_created_by = app.current_user_id() OR p_collab = app.current_user_id()))
$$;
ALTER FUNCTION app.sale_visible(uuid, uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.sale_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.sale_visible(uuid, uuid) TO wf_app, wf_definer;

DROP POLICY IF EXISTS sales_select ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT TO wf_app USING (app.sale_visible(created_by, collaborator_id));
DROP POLICY IF EXISTS sales_insert ON public.sales;
CREATE POLICY sales_insert ON public.sales FOR INSERT TO wf_app
  WITH CHECK (app.has_permission('sale.create_draft') AND created_by = app.current_user_id()
              AND (collaborator_id IS NULL OR collaborator_id = app.current_user_id()));
DROP POLICY IF EXISTS sales_update ON public.sales;
CREATE POLICY sales_update ON public.sales FOR UPDATE TO wf_app
  USING (status = 'draft' AND app.has_permission('sale.create_draft') AND (created_by = app.current_user_id() OR app.has_permission('sale.view')))
  WITH CHECK (status = 'draft');
DROP POLICY IF EXISTS sales_delete ON public.sales;
CREATE POLICY sales_delete ON public.sales FOR DELETE TO wf_app
  USING (status = 'draft' AND (created_by = app.current_user_id() OR app.has_permission('sale.confirm')));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sale_lines','sale_trade_ins'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %s_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %s_select ON public.%I FOR SELECT TO wf_app USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %s_write ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %s_write ON public.%I FOR ALL TO wf_app USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.status = ''draft'' AND (s.created_by = app.current_user_id() OR app.has_permission(''sale.view''))) AND app.has_permission(''sale.create_draft'')) WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.status = ''draft'' AND (s.created_by = app.current_user_id() OR app.has_permission(''sale.view''))) AND app.has_permission(''sale.create_draft''))', t, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS sale_line_costs_select ON public.sale_line_costs;
CREATE POLICY sale_line_costs_select ON public.sale_line_costs FOR SELECT TO wf_app USING (app.has_permission('cost.view'));
DROP POLICY IF EXISTS reservations_select ON public.reservations;
CREATE POLICY reservations_select ON public.reservations FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['reservation.manage','sale.view','debt.view']));
DROP POLICY IF EXISTS warranties_select ON public.warranties;
CREATE POLICY warranties_select ON public.warranties FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['warranty.view','repair.view']));
DROP POLICY IF EXISTS warranties_worker ON public.warranties;
CREATE POLICY warranties_worker ON public.warranties FOR ALL TO wf_worker USING (true) WITH CHECK (true);

-- ===== Trạng thái tiền của chứng từ (thay bản 0006): sale, reservation =====
CREATE OR REPLACE FUNCTION app.doc_payment_state(p_doc_type text, p_doc_id uuid, p_lock boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s record; r record; v_in bigint; v_out bigint;
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
  END IF;
  RETURN jsonb_build_object('exists', false);
END $$;

-- ===== Giữ hàng / cọc =====
CREATE OR REPLACE FUNCTION app.fn_create_reservation(p_unit uuid, p_customer uuid, p_hold_until date, p_method text, p_deposit bigint,
                                                     p_note text DEFAULT NULL, p_cash_tendered bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_price bigint; v_pct int; v_min bigint; v_hold date; v_max int; v_id uuid; v_code text; v_pay jsonb;
BEGIN
  PERFORM app.require_permission('reservation.manage');
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status <> 'in_stock' THEN
    PERFORM app.raise_wf(CASE WHEN u.status = 'reserved' THEN 'WF-RSV-UNIT-HELD' ELSE 'WF-SALE-UNIT-UNAVAILABLE' END,
      format('Chiếc %s không sẵn sàng để giữ (đang ở trạng thái khác).', u.asset_code));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer AND anonymized_at IS NULL) THEN
    PERFORM app.raise_wf('WF-SALE-CUSTOMER-REQUIRED', 'Giữ hàng cần chọn khách hàng.');
  END IF;
  v_price := app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to);
  v_pct := app.setting_int('reservation.min_deposit_pct', 10);
  v_min := ceil(v_price::numeric * v_pct / 100);
  IF p_deposit IS NULL OR p_deposit < v_min OR p_deposit <= 0 THEN
    PERFORM app.raise_wf('WF-RSV-DEPOSIT-TOO-LOW', format('Cọc tối thiểu %s%% giá bán (%s ₫).', v_pct, to_char(v_min, 'FM999G999G999G999')));
  END IF;
  IF p_deposit > v_price THEN PERFORM app.raise_wf('WF-VALIDATION', 'Tiền cọc không được lớn hơn giá bán.'); END IF;
  v_max := app.setting_int('reservation.max_hold_days', 30);
  v_hold := coalesce(p_hold_until, app.today_vn() + app.setting_int('reservation.hold_days', 7));
  IF v_hold < app.today_vn() OR v_hold > app.today_vn() + v_max THEN
    PERFORM app.raise_wf('WF-VALIDATION', format('Hạn giữ phải từ hôm nay đến tối đa %s ngày.', v_max));
  END IF;
  v_code := app.fn_next_number('GH');
  PERFORM set_config('app.in_fn', 'on', true);
  INSERT INTO public.reservations (code, customer_id, unit_id, doc_date, hold_until, price_snapshot_vnd, min_deposit_vnd, note, created_by)
  VALUES (v_code, p_customer, p_unit, app.today_vn(), v_hold, v_price, v_min, p_note, app.current_user_id()) RETURNING id INTO v_id;
  PERFORM app.set_unit_status(p_unit, 'reserved', 'Giữ hàng ' || v_code, 'reservations', v_id);
  v_pay := app.fn_record_payment('reservation', v_id, 'deposit_receipt', p_method, p_deposit, NULL, NULL, p_cash_tendered);
  PERFORM set_config('app.in_fn', 'on', true);
  PERFORM app.fn_emit_event('reservation.created', jsonb_build_object('reservationId', v_id, 'unitId', p_unit));
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'holdUntil', v_hold, 'deposit', p_deposit, 'payment', v_pay);
END $$;

-- Hủy giữ: hoàn cọc (thanh toán out) hoặc tịch thu (reservation.forfeit + lý do). BR-RSV-05.
CREATE OR REPLACE FUNCTION app.fn_cancel_reservation(p_reservation uuid, p_mode text, p_method text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r public.reservations; st jsonb; v_held bigint; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  PERFORM app.require_permission('reservation.manage');
  IF p_mode NOT IN ('refund','forfeit') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chọn hoàn cọc hoặc tịch thu cọc.'); END IF;
  IF p_mode = 'forfeit' THEN PERFORM app.require_permission('reservation.forfeit'); v_reason := app.require_reason(p_reason); END IF;
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO r FROM public.reservations WHERE id = p_reservation;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy giữ hàng.'); END IF;
  PERFORM app.lock_unit(r.unit_id);
  st := app.doc_payment_state('reservation', p_reservation, true);
  SELECT * INTO r FROM public.reservations WHERE id = p_reservation;
  IF r.status NOT IN ('active','expired') THEN PERFORM app.raise_wf('WF-RSV-NOT-ACTIVE', 'Giữ hàng đã đóng.'); END IF;
  v_held := (st->>'refundable')::bigint;
  PERFORM set_config('app.in_fn', 'on', true);
  IF p_mode = 'refund' THEN
    IF v_held > 0 THEN PERFORM app.fn_record_payment('reservation', p_reservation, 'deposit_refund', coalesce(p_method, 'cash'), v_held, NULL, v_reason); END IF;
    PERFORM set_config('app.in_fn', 'on', true);
    UPDATE public.reservations SET status = 'cancelled', settled_at = now(), settled_by = app.current_user_id(), settle_reason = v_reason WHERE id = p_reservation;
  ELSE
    UPDATE public.reservations SET status = 'forfeited', forfeited_vnd = forfeited_vnd + v_held, settled_at = now(), settled_by = app.current_user_id(), settle_reason = v_reason
    WHERE id = p_reservation;
    PERFORM app.fn_audit_event('reservation.forfeited', 'reservations', p_reservation::text, NULL, jsonb_build_object('forfeited', v_held), v_reason, 'high');
  END IF;
  PERFORM app.set_unit_status(r.unit_id, 'in_stock', CASE p_mode WHEN 'refund' THEN 'Hủy giữ, hoàn cọc' ELSE 'Hủy giữ, tịch thu cọc' END, 'reservations', p_reservation);
  PERFORM app.fn_emit_event('reservation.settled', jsonb_build_object('reservationId', p_reservation, 'mode', p_mode, 'amount', v_held));
  RETURN jsonb_build_object('id', p_reservation, 'status', CASE p_mode WHEN 'refund' THEN 'cancelled' ELSE 'forfeited' END, 'amount', v_held);
END $$;

-- ===== Xác nhận phiếu bán (BR-SALE-08; integrity §3) =====
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
    v_conf := app.fn_confirm_purchase(v_rcpt);
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

-- ===== Hủy phiếu bán (BR-SALE-10, BR-WAR-05, BR-PAY-05) =====
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
      PERFORM app.fn_void_purchase(t.purchase_receipt_id, 'Hủy theo phiếu bán: ' || v_reason);
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

-- ===== Phải thu / đã trả / còn nợ =====
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
                     FROM public.payments WHERE doc_type = 'reservation' AND doc_id = r.id AND status = 'posted') p ON true;
ALTER VIEW public.v_doc_balances OWNER TO wf_owner;
REVOKE ALL ON public.v_doc_balances FROM PUBLIC;
GRANT SELECT ON public.v_doc_balances TO wf_app, wf_worker, wf_backup;

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.tg_sale_child_guard()','app.doc_payment_state(text,uuid,boolean)',
    'app.fn_create_reservation(uuid,uuid,date,text,bigint,text,bigint)','app.fn_cancel_reservation(uuid,text,text,text)',
    'app.fn_confirm_sale(uuid,jsonb,bigint)','app.fn_void_sale(uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.tg_sale_child_guard() TO wf_app, wf_definer, wf_worker;
GRANT EXECUTE ON FUNCTION app.doc_payment_state(text,uuid,boolean) TO wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_create_reservation(uuid,uuid,date,text,bigint,text,bigint), app.fn_cancel_reservation(uuid,text,text,text),
  app.fn_confirm_sale(uuid,jsonb,bigint), app.fn_void_sale(uuid,text) TO wf_app;

COMMIT;
