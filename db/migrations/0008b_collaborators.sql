-- 0008b_collaborators.sql — Cộng tác viên (M5b, CF-03/08): collaborator_profiles, collaborator_assignments(+lines), collaborator_settlements;
-- cột CTV trên sale_lines (base_price_vnd, assignment_line_id, settlement_id); fn_confirm_assignment, fn_void_assignment,
-- fn_return_from_collaborator, fn_settle_collaborator, fn_void_settlement; mở rộng fn_confirm_sale / fn_void_sale cho đơn CTV;
-- v_units_collab; rpt_collaborator. BR-COL-01…11, BR-COST-07, BR-SEC-08, SC-12, SC-16, CT-06/08/10, PT-02/03. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.collaborator_profiles (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  phone      text,
  area       text,
  note       text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collaborator_assignments (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code            text UNIQUE,
  collaborator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  doc_date        date NOT NULL DEFAULT app.today_vn(),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','closed','voided')),
  note            text,
  confirmed_at    timestamptz,
  confirmed_by    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at       timestamptz,
  voided_by       uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  void_reason     text,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT collab_assign_confirmed CHECK (status = 'draft' OR (code IS NOT NULL AND confirmed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_collab_assign_collaborator ON public.collaborator_assignments (collaborator_id);
CREATE INDEX IF NOT EXISTS ix_collab_assign_status ON public.collaborator_assignments (status);
CREATE INDEX IF NOT EXISTS ix_collab_assign_confirmed_by ON public.collaborator_assignments (confirmed_by);
CREATE INDEX IF NOT EXISTS ix_collab_assign_voided_by ON public.collaborator_assignments (voided_by);
CREATE INDEX IF NOT EXISTS ix_collab_assign_created_by ON public.collaborator_assignments (created_by);
CREATE INDEX IF NOT EXISTS ix_collab_assign_updated_by ON public.collaborator_assignments (updated_by);

CREATE TABLE IF NOT EXISTS public.collaborator_assignment_lines (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  assignment_id  uuid NOT NULL REFERENCES public.collaborator_assignments(id) ON DELETE CASCADE,
  line_no        integer NOT NULL CHECK (line_no >= 1),
  unit_id        uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  base_price_vnd bigint NOT NULL CHECK (base_price_vnd >= 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','sold','returned','written_off')),
  closed_at      timestamptz,
  return_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_lines_no UNIQUE (assignment_id, line_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_collab_lines_active_unit ON public.collaborator_assignment_lines (unit_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_collab_lines_assignment ON public.collaborator_assignment_lines (assignment_id);
CREATE INDEX IF NOT EXISTS ix_collab_lines_unit ON public.collaborator_assignment_lines (unit_id);

CREATE TABLE IF NOT EXISTS public.collaborator_settlements (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code            text NOT NULL UNIQUE,
  collaborator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  doc_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','voided')),
  total_vnd       bigint NOT NULL CHECK (total_vnd > 0),
  method          text NOT NULL CHECK (method IN ('cash','bank_transfer')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at       timestamptz,
  voided_by       uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  void_reason     text
);
CREATE INDEX IF NOT EXISTS ix_collab_settle_collaborator ON public.collaborator_settlements (collaborator_id, doc_date);
CREATE INDEX IF NOT EXISTS ix_collab_settle_created_by ON public.collaborator_settlements (created_by);
CREATE INDEX IF NOT EXISTS ix_collab_settle_voided_by ON public.collaborator_settlements (voided_by);

-- Cột CTV trên dòng bán (BR-COL-03/04/06)
ALTER TABLE public.sale_lines ADD COLUMN IF NOT EXISTS base_price_vnd bigint CHECK (base_price_vnd >= 0);
ALTER TABLE public.sale_lines ADD COLUMN IF NOT EXISTS assignment_line_id uuid REFERENCES public.collaborator_assignment_lines(id) ON DELETE RESTRICT;
ALTER TABLE public.sale_lines ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES public.collaborator_settlements(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_sale_lines_assignment_line ON public.sale_lines (assignment_line_id);
CREATE INDEX IF NOT EXISTS ix_sale_lines_settlement ON public.sale_lines (settlement_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collaborator_profiles','collaborator_assignments','collaborator_assignment_lines','collaborator_settlements'] LOOP
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
DROP TRIGGER IF EXISTS trg_collab_assign__updated_at ON public.collaborator_assignments;
CREATE TRIGGER trg_collab_assign__updated_at BEFORE UPDATE ON public.collaborator_assignments FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_collab_assign__guard ON public.collaborator_assignments;
CREATE TRIGGER trg_collab_assign__guard BEFORE UPDATE OR DELETE ON public.collaborator_assignments FOR EACH ROW EXECUTE FUNCTION app.tg_confirmed_doc_guard();
DROP TRIGGER IF EXISTS trg_collab_settle__fn_only ON public.collaborator_settlements;
CREATE TRIGGER trg_collab_settle__fn_only BEFORE UPDATE OR DELETE ON public.collaborator_settlements FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only();

-- B10: giá thu giao CTV không đổi sau xác nhận; dòng chỉ thêm/xóa khi phiếu nháp
CREATE OR REPLACE FUNCTION app.tg_assignment_price_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_status text; v_aid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.assignment_id ELSE NEW.assignment_id END;
BEGIN
  SELECT status INTO v_status FROM public.collaborator_assignments WHERE id = v_aid;
  IF TG_OP = 'UPDATE' AND NEW.base_price_vnd IS DISTINCT FROM OLD.base_price_vnd AND v_status IS DISTINCT FROM 'draft' THEN
    PERFORM app.raise_wf('WF-IMMUTABLE', 'Giá thu giao CTV không đổi sau khi xác nhận. Muốn đổi hãy thu hồi rồi giao lại.');
  END IF;
  IF coalesce(current_setting('app.in_fn', true), '') <> 'on' AND v_status IS NOT NULL AND v_status <> 'draft' THEN
    PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu giao đã xác nhận, không sửa dòng được.');
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_collab_lines__guard ON public.collaborator_assignment_lines;
CREATE TRIGGER trg_collab_lines__guard BEFORE INSERT OR UPDATE OR DELETE ON public.collaborator_assignment_lines FOR EACH ROW EXECUTE FUNCTION app.tg_assignment_price_guard();

-- Ghi mất chiếc đang ở CTV ⇒ đóng dòng phiếu giao (written_off)
CREATE OR REPLACE FUNCTION app.tg_unit_collab_close() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF OLD.status = 'with_collaborator' AND NEW.status = 'written_off' THEN
    UPDATE public.collaborator_assignment_lines SET status = 'written_off', closed_at = now() WHERE unit_id = NEW.id AND status = 'active';
    PERFORM app.close_assignments_for_unit(NEW.id);
  END IF;
  RETURN NULL;
END $$;

-- Phiếu giao tự "closed" khi không còn dòng active (state-machines §2)
CREATE OR REPLACE FUNCTION app.close_assignments_for_unit(p_unit uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_prev text := coalesce(current_setting('app.in_fn', true), '');
BEGIN
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_assignments a SET status = 'closed'
  WHERE a.status = 'confirmed' AND a.id IN (SELECT assignment_id FROM public.collaborator_assignment_lines WHERE unit_id = p_unit)
    AND NOT EXISTS (SELECT 1 FROM public.collaborator_assignment_lines l WHERE l.assignment_id = a.id AND l.status = 'active');
  PERFORM set_config('app.in_fn', v_prev, true);
END $$;
DROP TRIGGER IF EXISTS trg_watch_units__collab_close ON public.watch_units;
CREATE TRIGGER trg_watch_units__collab_close AFTER UPDATE OF status ON public.watch_units FOR EACH ROW EXECUTE FUNCTION app.tg_unit_collab_close();

-- ===== GRANT + RLS (BR-COL-09) =====
GRANT SELECT ON public.collaborator_profiles, public.collaborator_assignments, public.collaborator_assignment_lines, public.collaborator_settlements TO wf_app;
GRANT INSERT (collaborator_id, doc_date, note, created_by), UPDATE (collaborator_id, doc_date, note), DELETE ON public.collaborator_assignments TO wf_app;
GRANT INSERT (assignment_id, line_no, unit_id, base_price_vnd), UPDATE (base_price_vnd, line_no), DELETE ON public.collaborator_assignment_lines TO wf_app;
DROP POLICY IF EXISTS collab_profiles_select ON public.collaborator_profiles;
CREATE POLICY collab_profiles_select ON public.collaborator_profiles FOR SELECT TO wf_app
  USING (app.has_permission('collab.view') OR user_id = app.current_user_id());
DROP POLICY IF EXISTS collab_assign_select ON public.collaborator_assignments;
CREATE POLICY collab_assign_select ON public.collaborator_assignments FOR SELECT TO wf_app
  USING (app.has_permission('collab.view') OR (app.has_permission('collab.view_own') AND collaborator_id = app.current_user_id() AND status <> 'draft'));
DROP POLICY IF EXISTS collab_assign_write ON public.collaborator_assignments;
CREATE POLICY collab_assign_write ON public.collaborator_assignments FOR ALL TO wf_app
  USING (app.has_permission('collab.manage') AND status = 'draft') WITH CHECK (app.has_permission('collab.manage') AND status = 'draft');
DROP POLICY IF EXISTS collab_lines_select ON public.collaborator_assignment_lines;
CREATE POLICY collab_lines_select ON public.collaborator_assignment_lines FOR SELECT TO wf_app
  USING (EXISTS (SELECT 1 FROM public.collaborator_assignments a WHERE a.id = assignment_id));
DROP POLICY IF EXISTS collab_lines_write ON public.collaborator_assignment_lines;
CREATE POLICY collab_lines_write ON public.collaborator_assignment_lines FOR ALL TO wf_app
  USING (app.has_permission('collab.manage') AND EXISTS (SELECT 1 FROM public.collaborator_assignments a WHERE a.id = assignment_id AND a.status = 'draft'))
  WITH CHECK (app.has_permission('collab.manage') AND EXISTS (SELECT 1 FROM public.collaborator_assignments a WHERE a.id = assignment_id AND a.status = 'draft'));
DROP POLICY IF EXISTS collab_settle_select ON public.collaborator_settlements;
CREATE POLICY collab_settle_select ON public.collaborator_settlements FOR SELECT TO wf_app
  USING (app.has_permission('collab.view') OR (app.has_permission('collab.view_own') AND collaborator_id = app.current_user_id()));

-- Giá thu giao CTV trên dòng bán: KHÔNG cấp cho wf_app (nhân viên bán hàng xác nhận đơn CTV nhưng không thấy giá thu) — đọc qua
-- app.fn_sale_line_collab (cost.view/collab.view hoặc chính CTV). shop_revenue_vnd cũng ẩn (dòng CTV = giá thu).
REVOKE SELECT ON public.sale_lines FROM wf_app;
GRANT SELECT (id, sale_id, line_no, line_type, unit_id, part_id, qty, list_price_snapshot_vnd, unit_price_vnd, line_discount_vnd, alloc_discount_vnd,
              line_total_vnd, is_effective, note, created_at, assignment_line_id, settlement_id) ON public.sale_lines TO wf_app;

CREATE OR REPLACE FUNCTION app.fn_sale_line_collab(p_sale uuid) RETURNS TABLE (sale_line_id uuid, base_price_vnd bigint, shop_revenue_vnd bigint, settlement_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF NOT (app.has_any_permission(ARRAY['cost.view','collab.view'])
          OR EXISTS (SELECT 1 FROM public.sales s WHERE s.id = p_sale AND s.collaborator_id = app.current_user_id() AND app.has_permission('collab.view_own'))) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn không có quyền xem giá thu của đơn này.');
  END IF;
  RETURN QUERY SELECT sl.id, sl.base_price_vnd, sl.shop_revenue_vnd, sl.settlement_id FROM public.sale_lines sl WHERE sl.sale_id = p_sale;
END $$;

-- Thanh toán quyết toán: CTV thấy của mình
CREATE OR REPLACE FUNCTION app.payment_visible(p_doc_type text, p_doc_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF app.has_any_permission(ARRAY['debt.view','payment.create','payment.void']) THEN RETURN true; END IF;
  IF p_doc_type = 'settlement' THEN
    RETURN app.has_permission('collab.view') OR (app.has_permission('collab.view_own')
      AND EXISTS (SELECT 1 FROM public.collaborator_settlements cs WHERE cs.id = p_doc_id AND cs.collaborator_id = app.current_user_id()));
  END IF;
  RETURN false;
END $$;

-- Chiếc CTV đang giữ (PT-02): cột an toàn + giá thu giao + ngày giao, KHÔNG giá vốn
CREATE OR REPLACE VIEW public.v_units_collab WITH (security_invoker = true) AS
  SELECT u.id, u.asset_code, u.status, u.condition, u.condition_grade, u.serial_no, m.id AS model_id, m.code AS model_code, m.name AS model_name,
         b.name AS brand_name, app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS list_price_vnd,
         l.base_price_vnd, a.doc_date AS assigned_date, a.code AS assignment_code, u.held_by_collaborator_id,
         (SELECT f.id FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1) AS photo_id
  FROM public.watch_units u
  JOIN public.collaborator_assignment_lines l ON l.unit_id = u.id AND l.status = 'active'
  JOIN public.collaborator_assignments a ON a.id = l.assignment_id
  JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
  WHERE u.status = 'with_collaborator';
ALTER VIEW public.v_units_collab OWNER TO wf_owner;
REVOKE ALL ON public.v_units_collab FROM PUBLIC;
GRANT SELECT ON public.v_units_collab TO wf_app, wf_worker, wf_backup;

-- ===== Trạng thái tiền: thêm nhánh settlement =====
CREATE OR REPLACE FUNCTION app.doc_payment_state(p_doc_type text, p_doc_id uuid, p_lock boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s record; r record; c record; v_in bigint; v_out bigint;
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
  END IF;
  RETURN jsonb_build_object('exists', false);
END $$;

-- ===== Hồ sơ CTV =====
CREATE OR REPLACE FUNCTION app.fn_upsert_collaborator_profile(p_user uuid, p_phone text, p_area text, p_note text, p_active boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.manage');
  IF NOT ('collab.view_own' = ANY(app.user_permissions(p_user))) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Người dùng này không có vai trò cộng tác viên.');
  END IF;
  INSERT INTO public.collaborator_profiles (user_id, phone, area, note, is_active) VALUES (p_user, p_phone, p_area, p_note, coalesce(p_active, true))
  ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, area = EXCLUDED.area, note = EXCLUDED.note, is_active = EXCLUDED.is_active, updated_at = now();
END $$;

-- ===== Giao hàng (BR-COL-01): tạo + xác nhận phiếu giao =====
CREATE OR REPLACE FUNCTION app.fn_confirm_assignment(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE a public.collaborator_assignments; l record; u public.watch_units; v_code text; v_warn jsonb := '[]'; v_cost bigint; n int;
BEGIN
  PERFORM app.require_permission('collab.manage');
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.collaborator_assignment_lines WHERE assignment_id = p_assignment) ORDER BY id FOR UPDATE;
  SELECT * INTO a FROM public.collaborator_assignments WHERE id = p_assignment FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu giao.'); END IF;
  IF a.status <> 'draft' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu giao đã xác nhận hoặc đã hủy.'); END IF;
  IF NOT ('collab.view_own' = ANY(app.user_permissions(a.collaborator_id))) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Người nhận không phải cộng tác viên đang hoạt động.');
  END IF;
  PERFORM app.check_doc_date(a.doc_date);
  SELECT count(*) INTO n FROM public.collaborator_assignment_lines WHERE assignment_id = p_assignment;
  IF n = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu giao chưa có chiếc nào.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  v_code := app.fn_next_number('GC');
  FOR l IN SELECT * FROM public.collaborator_assignment_lines WHERE assignment_id = p_assignment ORDER BY line_no LOOP
    SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
    IF u.status <> 'in_stock' THEN
      PERFORM app.raise_wf(CASE WHEN u.status = 'with_collaborator' THEN 'WF-COL-UNIT-ASSIGNED' ELSE 'WF-UNIT-INVALID-TRANSITION' END,
        format('Chiếc %s không giao được (chỉ giao chiếc sẵn sàng bán, không đang giữ hàng/đang ở CTV).', u.asset_code));
    END IF;
    BEGIN
      UPDATE public.collaborator_assignment_lines SET status = 'active' WHERE id = l.id;
    EXCEPTION WHEN unique_violation THEN
      PERFORM app.raise_wf('WF-COL-UNIT-ASSIGNED', format('Chiếc %s vừa được giao cho cộng tác viên khác.', u.asset_code));
    END;
    PERFORM app.set_unit_status(l.unit_id, 'with_collaborator', 'Giao CTV ' || v_code, 'collaborator_assignments', p_assignment, NULL, a.collaborator_id);
    SELECT coalesce(sum(amount_vnd), 0) INTO v_cost FROM public.unit_cost_entries WHERE unit_id = u.id AND cycle = u.cost_cycle;
    IF l.base_price_vnd < v_cost AND coalesce((app.setting('collab.warn_below_cost', 'true'))::boolean, true) THEN
      v_warn := v_warn || jsonb_build_object('lineNo', l.line_no, 'assetCode', u.asset_code, 'belowCost', true);
    END IF;
  END LOOP;
  UPDATE public.collaborator_assignments SET status = 'confirmed', code = v_code, confirmed_at = now(), confirmed_by = app.current_user_id() WHERE id = p_assignment;
  PERFORM app.fn_audit_event('assignment.confirmed', 'collaborator_assignments', p_assignment::text, NULL, jsonb_build_object('code', v_code), NULL, 'high');
  PERFORM app.fn_emit_event('assignment.confirmed', jsonb_build_object('assignmentId', p_assignment, 'collaboratorId', a.collaborator_id));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_assignment, 'code', v_code, 'status', 'confirmed', 'warnings', v_warn);
END $$;

-- Hủy phiếu giao: chỉ khi chưa có chiếc nào đã bán và đã thu hồi hết chiếc đang ở CTV (state-machines §2)
CREATE OR REPLACE FUNCTION app.fn_void_assignment(p_assignment uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE a public.collaborator_assignments; v_reason text;
BEGIN
  PERFORM app.require_permission('collab.manage');
  v_reason := app.require_reason(p_reason);
  SELECT * INTO a FROM public.collaborator_assignments WHERE id = p_assignment FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu giao.'); END IF;
  IF a.status NOT IN ('confirmed','closed') THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Phiếu giao không ở trạng thái hủy được.'); END IF;
  IF EXISTS (SELECT 1 FROM public.collaborator_assignment_lines WHERE assignment_id = p_assignment AND status = 'sold') THEN
    PERFORM app.raise_wf('WF-COL-HAS-SOLD', 'Phiếu giao đã có chiếc được bán, không hủy được.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.collaborator_assignment_lines WHERE assignment_id = p_assignment AND status = 'active') THEN
    PERFORM app.raise_wf('WF-COL-HAS-SOLD', 'Còn chiếc đang ở cộng tác viên — hãy thu hồi trước khi hủy phiếu giao.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_assignments SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = v_reason WHERE id = p_assignment;
  PERFORM app.fn_audit_event('assignment.voided', 'collaborator_assignments', p_assignment::text, NULL, NULL, v_reason, 'high');
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_assignment, 'status', 'voided');
END $$;

-- Thu hồi (BR-COL-07): with_collaborator → in_stock (vị trí bắt buộc), lý do; không đụng giá vốn
CREATE OR REPLACE FUNCTION app.fn_return_from_collaborator(p_unit uuid, p_location uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_reason text;
BEGIN
  PERFORM app.require_permission('collab.manage');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status = 'sold' THEN PERFORM app.raise_wf('WF-COL-HAS-SOLD', format('Chiếc %s đã bán, không thu hồi được.', u.asset_code)); END IF;
  IF u.status <> 'with_collaborator' THEN PERFORM app.raise_wf('WF-COL-UNIT-NOT-HELD', format('Chiếc %s không ở cộng tác viên.', u.asset_code)); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.storage_locations WHERE id = p_location AND is_active) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Chọn vị trí lưu kho khi thu hồi.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_assignment_lines SET status = 'returned', closed_at = now(), return_reason = v_reason WHERE unit_id = p_unit AND status = 'active';
  PERFORM app.set_unit_status(p_unit, 'in_stock', 'Thu hồi từ CTV: ' || v_reason, 'collaborator_assignments', NULL, p_location);
  PERFORM app.close_assignments_for_unit(p_unit);
  PERFORM app.fn_emit_event('assignment.returned', jsonb_build_object('unitId', p_unit, 'collaboratorId', u.held_by_collaborator_id));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_unit, 'status', 'in_stock');
END $$;

-- Quyết toán (BR-COL-06, CT-10): khóa dòng bán theo id; mỗi dòng một lần
CREATE OR REPLACE FUNCTION app.fn_settle_collaborator(p_collaborator uuid, p_line_ids uuid[], p_method text, p_doc_date date DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l record; v_total bigint := 0; v_id uuid; v_code text; v_date date; v_pay jsonb; n int := 0;
BEGIN
  PERFORM app.require_permission('collab.manage');
  IF coalesce(array_length(p_line_ids, 1), 0) = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chọn ít nhất một dòng đã bán để quyết toán.'); END IF;
  v_date := app.check_doc_date(p_doc_date);
  SET LOCAL lock_timeout = '5s';
  FOR l IN SELECT sl.id, sl.settlement_id, sl.base_price_vnd, sl.is_effective, s.status, s.collaborator_id
           FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE sl.id = ANY(p_line_ids) ORDER BY sl.id FOR UPDATE OF sl LOOP
    n := n + 1;
    IF l.collaborator_id IS DISTINCT FROM p_collaborator OR l.status <> 'confirmed' OR l.base_price_vnd IS NULL THEN
      PERFORM app.raise_wf('WF-VALIDATION', 'Có dòng không phải đơn đã xác nhận của cộng tác viên này (có thể vừa bị hủy).');
    END IF;
    IF l.settlement_id IS NOT NULL THEN PERFORM app.raise_wf('WF-COL-ALREADY-SETTLED', 'Có dòng đã được quyết toán trước đó.'); END IF;
    v_total := v_total + l.base_price_vnd;
  END LOOP;
  IF n <> array_length(p_line_ids, 1) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Có dòng bán không tồn tại.'); END IF;
  IF v_total <= 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Tổng tiền quyết toán phải lớn hơn 0.'); END IF;
  v_code := app.fn_next_number('QT');
  INSERT INTO public.collaborator_settlements (code, collaborator_id, doc_date, total_vnd, method, note, created_by)
  VALUES (v_code, p_collaborator, v_date, v_total, p_method, p_note, app.current_user_id()) RETURNING id INTO v_id;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.sale_lines SET settlement_id = v_id WHERE id = ANY(p_line_ids);
  v_pay := app.fn_record_payment('settlement', v_id, 'collab_settlement', p_method, v_total, v_date, p_note);
  PERFORM app.fn_audit_event('settlement.confirmed', 'collaborator_settlements', v_id::text, NULL, jsonb_build_object('code', v_code, 'total', v_total), NULL, 'high');
  PERFORM app.fn_emit_event('settlement.confirmed', jsonb_build_object('settlementId', v_id, 'collaboratorId', p_collaborator, 'total', v_total));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total, 'payment', v_pay);
END $$;

-- Hủy quyết toán (BR-COL-08): owner (collab.manage) + lý do; thanh toán voided; dòng về "chưa nộp"
CREATE OR REPLACE FUNCTION app.fn_void_settlement(p_settlement uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE c public.collaborator_settlements; v_reason text;
BEGIN
  PERFORM app.require_permission('collab.manage');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.sale_lines WHERE settlement_id = p_settlement ORDER BY id FOR UPDATE;
  SELECT * INTO c FROM public.collaborator_settlements WHERE id = p_settlement FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy quyết toán.'); END IF;
  IF c.status <> 'confirmed' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Quyết toán đã bị hủy.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.sale_lines SET settlement_id = NULL WHERE settlement_id = p_settlement;
  UPDATE public.payments SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = 'Hủy quyết toán: ' || v_reason
  WHERE doc_type = 'settlement' AND doc_id = p_settlement AND status = 'posted';
  UPDATE public.collaborator_settlements SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = v_reason WHERE id = p_settlement;
  PERFORM app.fn_audit_event('settlement.voided', 'collaborator_settlements', p_settlement::text, NULL, NULL, v_reason, 'high');
  PERFORM app.fn_emit_event('settlement.voided', jsonb_build_object('settlementId', p_settlement));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_settlement, 'status', 'voided');
END $$;

-- Thống kê CTV (BR-COL-10, R9): theo kỳ (month|quarter|year) theo ngày phiếu; chủ xem tất cả, CTV xem của mình
CREATE OR REPLACE FUNCTION app.rpt_collaborator(p_from date, p_to date, p_period text DEFAULT 'month', p_collaborator uuid DEFAULT NULL)
RETURNS TABLE (collaborator_id uuid, collaborator_name text, period_start date, units_sold bigint, sales_total bigint, base_total bigint, collab_earn bigint,
               settled bigint, unsettled bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_who uuid := p_collaborator;
BEGIN
  IF NOT app.has_permission('collab.view') THEN
    IF NOT app.has_permission('collab.view_own') THEN PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn không có quyền xem thống kê cộng tác viên.'); END IF;
    v_who := app.current_user_id();
  END IF;
  IF p_period NOT IN ('month','quarter','year') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Kỳ không hợp lệ.'); END IF;
  RETURN QUERY
  SELECT s.collaborator_id, app.user_display_name(s.collaborator_id), date_trunc(p_period, s.doc_date)::date,
         count(*)::bigint, sum(sl.line_total_vnd)::bigint, sum(sl.base_price_vnd)::bigint, sum(sl.line_total_vnd - sl.base_price_vnd)::bigint,
         coalesce(sum(sl.base_price_vnd) FILTER (WHERE sl.settlement_id IS NOT NULL), 0)::bigint,
         coalesce(sum(sl.base_price_vnd) FILTER (WHERE sl.settlement_id IS NULL), 0)::bigint
  FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
  WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND s.doc_date BETWEEN p_from AND p_to
    AND (v_who IS NULL OR s.collaborator_id = v_who)
  GROUP BY s.collaborator_id, date_trunc(p_period, s.doc_date)
  ORDER BY 3, 2;
END $$;

-- ===== fn_confirm_sale / fn_void_sale mở rộng cho đơn CTV =====
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
  -- Đơn CTV (BR-COL-03/05): không thanh toán khách, không thu cũ, không giữ hàng, chỉ chiếc đồng hồ; khách có SĐT để tạo bảo hành
  IF s.collaborator_id IS NOT NULL THEN
    IF jsonb_array_length(coalesce(p_payments, '[]')) > 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Đơn cộng tác viên không ghi thanh toán của khách (CTV tự thu).'); END IF;
    IF s.reservation_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.sale_trade_ins WHERE sale_id = p_sale) THEN
      PERFORM app.raise_wf('WF-VALIDATION', 'Đơn cộng tác viên không có giữ hàng/thu cũ đổi mới.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.sale_lines WHERE sale_id = p_sale AND line_type <> 'watch') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Đơn cộng tác viên chỉ gồm đồng hồ CTV đang giữ.'); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = s.customer_id AND phone IS NOT NULL) THEN
      PERFORM app.raise_wf('WF-SALE-CUSTOMER-REQUIRED', 'Đơn cộng tác viên cần tên và số điện thoại khách (để bảo hành).');
    END IF;
  END IF;
  PERFORM app.check_doc_date(s.doc_date, s.backdate_reason);
  SELECT count(*) INTO n FROM public.sale_lines WHERE sale_id = p_sale;
  IF n = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phiếu bán chưa có hàng.'); END IF;
  IF s.reservation_id IS NOT NULL THEN SELECT * INTO rsv FROM public.reservations WHERE id = s.reservation_id; END IF;

  -- 2. Kiểm hàng & giá niêm yết hiệu lực
  FOR l IN SELECT * FROM public.sale_lines WHERE sale_id = p_sale ORDER BY line_no LOOP
    IF l.line_type = 'watch' THEN
      SELECT * INTO u FROM public.watch_units WHERE id = l.unit_id;
      IF s.collaborator_id IS NOT NULL THEN
        IF NOT (u.status = 'with_collaborator' AND u.held_by_collaborator_id = s.collaborator_id
                AND EXISTS (SELECT 1 FROM public.collaborator_assignment_lines al WHERE al.unit_id = u.id AND al.status = 'active')) THEN
          PERFORM app.raise_wf('WF-COL-UNIT-NOT-HELD', format('Chiếc %s không còn do cộng tác viên này giữ.', u.asset_code));
        END IF;
      ELSIF NOT (u.status = 'in_stock' OR (u.status = 'reserved' AND rsv.id IS NOT NULL AND rsv.unit_id = u.id AND rsv.status IN ('active','expired'))) THEN
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
  -- Đơn CTV: chốt giá thu từ dòng phiếu giao; doanh thu cửa hàng = giá thu (BR-COL-04)
  IF s.collaborator_id IS NOT NULL THEN
    UPDATE public.sale_lines sl SET base_price_vnd = al.base_price_vnd, assignment_line_id = al.id, shop_revenue_vnd = al.base_price_vnd
    FROM public.collaborator_assignment_lines al WHERE al.unit_id = sl.unit_id AND al.status = 'active' AND sl.sale_id = p_sale;
  END IF;
  SELECT sum(list_price_snapshot_vnd * qty), sum(line_total_vnd) INTO v_sub_list, v_grand FROM public.sale_lines WHERE sale_id = p_sale;

  -- 4. Hạn mức giảm giá theo vai trò (BR-SALE-03): mức cao nhất trong các vai trò của người xác nhận
  SELECT coalesce(max(r.max_discount_pct), 0) INTO v_pct FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id AND r.is_active WHERE ur.user_id = app.current_user_id();
  IF s.collaborator_id IS NULL AND v_sub_list > 0 AND (v_sub_list - v_grand) * 100 > v_pct * v_sub_list THEN
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
    IF s.collaborator_id IS NULL AND l.line_total_vnd < v_cost AND NOT app.has_permission('sale.below_cost') THEN
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
      PERFORM app.set_unit_status(l.unit_id, 'sold', CASE WHEN s.collaborator_id IS NULL THEN 'Bán hàng' ELSE 'CTV bán' END, 'sales', p_sale);
      UPDATE public.sale_lines SET is_effective = true WHERE id = l.id;
      IF s.collaborator_id IS NOT NULL THEN
        UPDATE public.collaborator_assignment_lines SET status = 'sold', closed_at = now() WHERE unit_id = l.unit_id AND status = 'active';
        PERFORM app.close_assignments_for_unit(l.unit_id);
        PERFORM set_config('app.in_fn', 'on', true);
      END IF;
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
  -- Đơn CTV: dòng đã quyết toán ⇒ phải hủy quyết toán trước (BR-COL-08, CT-08)
  PERFORM 1 FROM public.sale_lines WHERE sale_id = p_sale ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.sale_lines WHERE sale_id = p_sale AND settlement_id IS NOT NULL) THEN
    PERFORM app.raise_wf('WF-SALE-VOID-NOT-ALLOWED', 'Đơn cộng tác viên đã quyết toán — hãy hủy quyết toán trước.');
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
      IF s.collaborator_id IS NULL THEN
        PERFORM app.set_unit_status(l.unit_id, 'in_stock', 'Hủy phiếu bán: ' || v_reason, 'sales', p_sale);
      ELSE
        -- Đơn CTV hủy ⇒ chiếc về with_collaborator (không về kho), dòng phiếu giao active lại
        UPDATE public.collaborator_assignment_lines SET status = 'active', closed_at = NULL WHERE id = l.assignment_line_id;
        UPDATE public.collaborator_assignments SET status = 'confirmed'
        WHERE id = (SELECT assignment_id FROM public.collaborator_assignment_lines WHERE id = l.assignment_line_id) AND status = 'closed';
        PERFORM app.set_unit_status(l.unit_id, 'with_collaborator', 'Hủy đơn CTV: ' || v_reason, 'sales', p_sale, NULL, s.collaborator_id);
      END IF;
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

ALTER FUNCTION app.tg_assignment_price_guard() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_assignment_price_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_assignment_price_guard() TO wf_app, wf_definer, wf_worker;

ALTER FUNCTION app.tg_unit_collab_close() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_unit_collab_close() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_unit_collab_close() TO wf_app, wf_definer, wf_worker;

ALTER FUNCTION app.close_assignments_for_unit(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.close_assignments_for_unit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.close_assignments_for_unit(uuid) TO wf_definer;

ALTER FUNCTION app.fn_sale_line_collab(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_sale_line_collab(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_sale_line_collab(uuid) TO wf_app;

ALTER FUNCTION app.payment_visible(text,uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.payment_visible(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.payment_visible(text,uuid) TO wf_app, wf_definer;

ALTER FUNCTION app.doc_payment_state(text,uuid,boolean) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.doc_payment_state(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.doc_payment_state(text,uuid,boolean) TO wf_definer;

ALTER FUNCTION app.fn_upsert_collaborator_profile(uuid,text,text,text,boolean) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_upsert_collaborator_profile(uuid,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_upsert_collaborator_profile(uuid,text,text,text,boolean) TO wf_app;

ALTER FUNCTION app.fn_confirm_assignment(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_confirm_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_confirm_assignment(uuid) TO wf_app;

ALTER FUNCTION app.fn_void_assignment(uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_void_assignment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_void_assignment(uuid,text) TO wf_app;

ALTER FUNCTION app.fn_return_from_collaborator(uuid,uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_return_from_collaborator(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_return_from_collaborator(uuid,uuid,text) TO wf_app;

ALTER FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) TO wf_app;

ALTER FUNCTION app.fn_void_settlement(uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_void_settlement(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_void_settlement(uuid,text) TO wf_app;

ALTER FUNCTION app.rpt_collaborator(date,date,text,uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.rpt_collaborator(date,date,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.rpt_collaborator(date,date,text,uuid) TO wf_app, wf_worker;

COMMIT;
