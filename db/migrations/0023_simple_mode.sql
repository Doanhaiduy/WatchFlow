-- 0023_simple_mode.sql — Rút gọn theo phản hồi vòng 2 (CF-10…CF-18, docs/01-product/customer-feedback-02.md):
--  (1) CTV: bỏ giá thu/quyết toán, thay bằng "chào hàng" nhiều CTV cho một chiếc + "báo đã bán" — CTV nào báo trước được giữ chiếc, chủ xác nhận
--      (collaborator_offers, collaborator_claims; fn_offer_units, fn_withdraw_offer, fn_collab_claim, fn_cancel_claim, fn_reject_claim,
--      fn_confirm_claim, fn_my_offers, fn_my_claims, fn_my_collab_stats). Chiếc VẪN `in_stock` trong lúc chào hàng (BR-COL-12…18).
--  (2) Đơn bán gọn: fn_record_sale ghi một lần (chiếc + khách + giá + ngày + hạn bảo hành), không nháp/thanh toán/nợ/giảm giá/thu cũ (BR-SALE-20…24).
--      fn_void_sale mới (đơn gọn); đơn cũ có linh kiện/thu cũ/cọc/thanh toán/CTV-giá-thu vẫn đi đường cũ (fn_void_sale_v1).
--  (3) Báo cáo: rpt_revenue thêm số chiếc + tách kênh; rpt_units, rpt_collab_sales (chỉ chủ); rpt_dashboard, fn_daily_alerts, fn_consistency_check gọn lại.
--  (4) Quyền: vai trò CTV chỉ còn collab.view_own (không thấy đơn/khách/giá); đổi nhãn một số quyền cho đúng nghĩa mới.
-- Không xóa bảng/hàm cũ (đóng băng — dọn bằng migration "contract" sau). Idempotent.
BEGIN;

-- ===== Bảng: chào hàng CTV =====
CREATE TABLE IF NOT EXISTS public.collaborator_offers (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id         uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  collaborator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','won','lost','withdrawn')),
  note            text,
  offered_at      timestamptz NOT NULL DEFAULT now(),
  offered_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  closed_at       timestamptz,
  close_reason    text,
  CONSTRAINT collab_offers_closed CHECK ((status = 'active') = (closed_at IS NULL))
);
-- Một CTV chỉ có một chào hàng còn hiệu lực trên một chiếc
CREATE UNIQUE INDEX IF NOT EXISTS ux_collab_offers_active ON public.collaborator_offers (unit_id, collaborator_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_collab_offers_unit ON public.collaborator_offers (unit_id);
CREATE INDEX IF NOT EXISTS ix_collab_offers_collab ON public.collaborator_offers (collaborator_id, status);
CREATE INDEX IF NOT EXISTS ix_collab_offers_offered_by ON public.collaborator_offers (offered_by);

-- ===== Bảng: CTV báo đã bán (chờ chủ xác nhận) =====
CREATE TABLE IF NOT EXISTS public.collaborator_claims (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  offer_id        uuid NOT NULL REFERENCES public.collaborator_offers(id) ON DELETE RESTRICT,
  unit_id         uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  collaborator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  customer_name   text NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 120),
  customer_phone  text NOT NULL CHECK (char_length(btrim(customer_phone)) BETWEEN 6 AND 20),
  note            text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','cancelled','voided')),
  sale_id         uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  reject_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  decided_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
-- "Ai báo trước thì được": mỗi chiếc chỉ có MỘT báo bán đang chờ
CREATE UNIQUE INDEX IF NOT EXISTS ux_collab_claims_pending_unit ON public.collaborator_claims (unit_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_collab_claims_offer ON public.collaborator_claims (offer_id);
CREATE INDEX IF NOT EXISTS ix_collab_claims_unit ON public.collaborator_claims (unit_id);
CREATE INDEX IF NOT EXISTS ix_collab_claims_collab ON public.collaborator_claims (collaborator_id, status);
CREATE INDEX IF NOT EXISTS ix_collab_claims_sale ON public.collaborator_claims (sale_id);
CREATE INDEX IF NOT EXISTS ix_collab_claims_decided_by ON public.collaborator_claims (decided_by);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collaborator_offers','collaborator_claims'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_app', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__fn_only ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__fn_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_fn_only()', t, t);
  END LOOP;
END $$;
-- Chủ (collab.view) thấy tất cả; CTV chỉ thấy của mình. Người xác nhận đơn (sale.confirm) thấy báo bán để duyệt. Ghi chỉ qua fn_*.
DROP POLICY IF EXISTS collab_offers_select ON public.collaborator_offers;
CREATE POLICY collab_offers_select ON public.collaborator_offers FOR SELECT TO wf_app
  USING (app.has_permission('collab.view') OR (app.has_permission('collab.view_own') AND collaborator_id = app.current_user_id()));
DROP POLICY IF EXISTS collab_claims_select ON public.collaborator_claims;
CREATE POLICY collab_claims_select ON public.collaborator_claims FOR SELECT TO wf_app
  USING (app.has_any_permission(ARRAY['collab.view','sale.confirm']) OR (app.has_permission('collab.view_own') AND collaborator_id = app.current_user_id()));

-- Nhật ký không giữ tên/SĐT khách do CTV nhập (mở rộng 0013b)
CREATE OR REPLACE FUNCTION app.tg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  masked text[] := ARRAY['password_hash','totp_secret_enc','id_number_enc','id_number_bidx','recovery_codes_hash','token_hash','search_text','id_number_last3']
    || CASE TG_TABLE_NAME
         WHEN 'customers' THEN ARRAY['full_name','phone','phone_norm','email','address','note']
         WHEN 'purchase_receipts' THEN ARRAY['seller_name','seller_phone']
         WHEN 'collaborator_profiles' THEN ARRAY['phone']
         WHEN 'collaborator_claims' THEN ARRAY['customer_name','customer_phone','note']
         ELSE ARRAY[]::text[] END;
  ignored text[] := coalesce(TG_ARGV::text[], '{}') || ARRAY['updated_at','version','updated_by','search_text'];
  o jsonb; n jsonb; b jsonb := '{}'; a jsonb := '{}'; k text; eid text;
BEGIN
  o := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END;
  n := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END;
  eid := coalesce(n->>'id', o->>'id', n->>'key', o->>'key', n->>'code', o->>'code');
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(n) LOOP
      IF (o->k) IS DISTINCT FROM (n->k) AND NOT (k = ANY(ignored)) THEN
        b := b || jsonb_build_object(k, CASE WHEN k = ANY(masked) THEN to_jsonb('***'::text) ELSE o->k END);
        a := a || jsonb_build_object(k, CASE WHEN k = ANY(masked) THEN to_jsonb('***'::text) ELSE n->k END);
      END IF;
    END LOOP;
    IF a = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSE
    IF o IS NOT NULL THEN b := o - masked; END IF;
    IF n IS NOT NULL THEN a := n - masked; END IF;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, before, after, request_id, ip_hash)
  VALUES (app.current_user_id(), lower(TG_OP), TG_TABLE_NAME, eid,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE b END, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE a END,
          app.request_id(), nullif(current_setting('app.ip_hash', true), ''));
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_audit() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_audit() TO wf_app, wf_auth, wf_worker, wf_definer;

-- ===== Chiếc rời trạng thái "sẵn sàng bán" ⇒ đóng chào hàng còn hiệu lực + huỷ báo bán đang chờ (BR-COL-16) =====
CREATE OR REPLACE FUNCTION app.tg_unit_offers_close() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_prev text := coalesce(current_setting('app.in_fn', true), '');
BEGIN
  IF OLD.status = 'in_stock' AND NEW.status <> 'in_stock' THEN
    PERFORM set_config('app.in_fn', 'on', true);
    UPDATE public.collaborator_claims SET status = 'cancelled', decided_at = now(), reject_reason = 'Chiếc không còn sẵn sàng bán'
    WHERE unit_id = NEW.id AND status = 'pending';
    UPDATE public.collaborator_offers SET status = 'lost', closed_at = now(),
      close_reason = CASE WHEN NEW.status = 'sold' THEN 'Chiếc đã bán' ELSE 'Chiếc không còn sẵn sàng bán' END
    WHERE unit_id = NEW.id AND status = 'active';
    PERFORM set_config('app.in_fn', v_prev, true);
  END IF;
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_unit_offers_close() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_unit_offers_close() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_unit_offers_close() TO wf_app, wf_definer, wf_worker;
DROP TRIGGER IF EXISTS trg_watch_units__offers_close ON public.watch_units;
CREATE TRIGGER trg_watch_units__offers_close AFTER UPDATE OF status ON public.watch_units FOR EACH ROW EXECUTE FUNCTION app.tg_unit_offers_close();

-- ===== Bảo hành gọn của đơn bán: hạn bảo hành theo tình trạng, sửa được trên từng dòng (CF-15) =====
CREATE OR REPLACE FUNCTION app.mk_sale_warranty(p_line uuid, p_unit uuid, p_customer uuid, p_date date, p_months int) RETURNS date
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_cond text; v_months int; v_end date;
BEGIN
  SELECT condition INTO v_cond FROM public.watch_units WHERE id = p_unit;
  v_months := coalesce(p_months, app.setting_int('warranty.shop_months.' || v_cond, CASE WHEN v_cond = 'new' THEN 12 ELSE 3 END));
  IF v_months <= 0 THEN RETURN NULL; END IF;
  v_end := (p_date + make_interval(months => v_months))::date;
  INSERT INTO public.warranties (code, kind, unit_id, sale_line_id, customer_id, start_date, end_date, terms)
  VALUES (app.fn_next_number('BH'), 'sale', p_unit, p_line, p_customer, p_date, v_end, app.setting('store.warranty_terms', '""') #>> '{}');
  RETURN v_end;
END $$;
ALTER FUNCTION app.mk_sale_warranty(uuid,uuid,uuid,date,int) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.mk_sale_warranty(uuid,uuid,uuid,date,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.mk_sale_warranty(uuid,uuid,uuid,date,int) TO wf_definer;

-- ===== Ghi đơn bán (FR-SALE-20): đơn "đã xác nhận" ngay, chỉ gồm chiếc + giá; khách bắt buộc =====
-- p_lines: [{"unitId":"…","price":123000,"warrantyMonths":12?}, …] (1…20 chiếc, mỗi chiếc một dòng)
CREATE OR REPLACE FUNCTION app.fn_record_sale(p_customer uuid, p_doc_date date, p_lines jsonb, p_note text DEFAULT NULL, p_backdate_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  v_ids uuid[]; n int; i int; x jsonb; u public.watch_units; v_date date; v_sale uuid; v_code text; v_line uuid;
  v_price bigint; v_list bigint; v_sub bigint := 0; v_grand bigint := 0; v_cost bigint; v_months int; v_end date; v_ends jsonb := '[]';
BEGIN
  PERFORM app.require_permission('sale.confirm');
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '15s';
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 20 THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Đơn bán cần từ 1 đến 20 chiếc.');
  END IF;
  n := jsonb_array_length(p_lines);
  IF p_customer IS NULL OR NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer AND anonymized_at IS NULL) THEN
    PERFORM app.raise_wf('WF-SALE-CUSTOMER-REQUIRED', 'Cần chọn khách hàng (ít nhất họ tên) để lưu đơn.');
  END IF;
  -- Khóa chiếc theo id tăng dần (tránh deadlock)
  SELECT array_agg(DISTINCT (e->>'unitId')::uuid ORDER BY (e->>'unitId')::uuid) INTO v_ids FROM jsonb_array_elements(p_lines) e;
  IF cardinality(v_ids) <> n THEN PERFORM app.raise_wf('WF-VALIDATION', 'Mỗi chiếc chỉ được ghi một lần trong đơn.'); END IF;
  PERFORM 1 FROM public.watch_units WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;
  v_date := app.check_doc_date(p_doc_date, p_backdate_reason);
  FOR i IN 0..n - 1 LOOP
    x := p_lines -> i;
    SELECT * INTO u FROM public.watch_units WHERE id = (x->>'unitId')::uuid;
    IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy chiếc đồng hồ trong đơn.'); END IF;
    IF u.status <> 'in_stock' THEN
      PERFORM app.raise_wf('WF-SALE-UNIT-UNAVAILABLE', format('Chiếc %s không còn sẵn sàng bán (đã bán hoặc chưa kiểm tra). Hãy bỏ chiếc này khỏi đơn.', u.asset_code));
    END IF;
    IF EXISTS (SELECT 1 FROM public.collaborator_claims WHERE unit_id = u.id AND status = 'pending') THEN
      PERFORM app.raise_wf('WF-SALE-UNIT-CLAIMED', format('Chiếc %s đang có cộng tác viên báo đã bán — hãy xác nhận hoặc từ chối báo bán đó trước.', u.asset_code));
    END IF;
    IF (x->>'price') IS NULL OR (x->>'price')::numeric < 0 OR (x->>'price')::numeric > 9007199254740991 OR (x->>'price')::numeric <> trunc((x->>'price')::numeric) THEN
      PERFORM app.raise_wf('WF-VALIDATION', format('Giá bán chiếc %s không hợp lệ.', u.asset_code));
    END IF;
    IF (x->>'warrantyMonths') IS NOT NULL AND ((x->>'warrantyMonths')::int < 0 OR (x->>'warrantyMonths')::int > 120) THEN
      PERFORM app.raise_wf('WF-VALIDATION', 'Hạn bảo hành từ 0 đến 120 tháng.');
    END IF;
    v_list := app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to, v_date);
    v_sub := v_sub + v_list;
    v_grand := v_grand + (x->>'price')::bigint;
  END LOOP;

  PERFORM set_config('app.in_fn', 'on', true);
  v_code := app.fn_next_number('HD');
  INSERT INTO public.sales (code, customer_id, doc_date, backdate_reason, status, subtotal_list_vnd, discount_total_vnd, grand_total_vnd, note,
                            confirmed_at, confirmed_by, created_by, updated_by)
  VALUES (v_code, p_customer, v_date, nullif(btrim(coalesce(p_backdate_reason, '')), ''), 'confirmed', v_sub, greatest(v_sub - v_grand, 0), v_grand,
          nullif(btrim(coalesce(p_note, '')), ''), now(), app.current_user_id(), app.current_user_id(), app.current_user_id())
  RETURNING id INTO v_sale;
  FOR i IN 0..n - 1 LOOP
    x := p_lines -> i;
    SELECT * INTO u FROM public.watch_units WHERE id = (x->>'unitId')::uuid;
    v_price := (x->>'price')::bigint;
    v_list := app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to, v_date);
    INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, list_price_snapshot_vnd, unit_price_vnd, line_discount_vnd, alloc_discount_vnd,
                                   line_total_vnd, shop_revenue_vnd, is_effective)
    VALUES (v_sale, i + 1, 'watch', u.id, 1, v_list, v_price, v_list - v_price, 0, v_price, v_price, true) RETURNING id INTO v_line;
    SELECT coalesce(sum(amount_vnd), 0) INTO v_cost FROM public.unit_cost_entries WHERE unit_id = u.id AND cycle = u.cost_cycle;
    INSERT INTO public.sale_line_costs (sale_line_id, cost_vnd, cost_cycle) VALUES (v_line, v_cost, u.cost_cycle);
    PERFORM app.set_unit_status(u.id, 'sold', 'Bán hàng', 'sales', v_sale);
    PERFORM set_config('app.in_fn', 'on', true);
    v_months := nullif(x->>'warrantyMonths', '')::int;
    v_end := app.mk_sale_warranty(v_line, u.id, p_customer, v_date, v_months);
    v_ends := v_ends || jsonb_build_object('unitId', u.id, 'warrantyEnd', v_end);
  END LOOP;
  PERFORM app.fn_audit_event('sale.recorded', 'sales', v_sale::text, NULL, jsonb_build_object('code', v_code, 'grandTotal', v_grand, 'units', n), NULL, 'info');
  PERFORM app.fn_emit_event('sale.confirmed', jsonb_build_object('saleId', v_sale, 'code', v_code, 'grandTotal', v_grand));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', v_sale, 'code', v_code, 'status', 'confirmed', 'grandTotal', v_grand, 'units', v_ends);
END $$;
ALTER FUNCTION app.fn_record_sale(uuid,date,jsonb,text,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_record_sale(uuid,date,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_record_sale(uuid,date,jsonb,text,text) TO wf_app;

-- ===== Hủy đơn bán: đơn gọn xử lý ở đây; đơn cũ (linh kiện/thu cũ/cọc/thanh toán/CTV giá thu) đi đường cũ (fn_void_sale_v1) =====
DO $$
BEGIN
  IF to_regprocedure('app.fn_void_sale_v1(uuid,text)') IS NULL AND to_regprocedure('app.fn_void_sale(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION app.fn_void_sale(uuid,text) RENAME TO fn_void_sale_v1;
  END IF;
END $$;
REVOKE ALL ON FUNCTION app.fn_void_sale_v1(uuid,text) FROM PUBLIC, wf_app;
GRANT EXECUTE ON FUNCTION app.fn_void_sale_v1(uuid,text) TO wf_definer;

CREATE OR REPLACE FUNCTION app.fn_void_sale(p_sale uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s public.sales; v_reason text; l record; v_hours int; v_legacy boolean;
BEGIN
  PERFORM app.require_permission('sale.void');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM public.watch_units WHERE id IN (SELECT unit_id FROM public.sale_lines WHERE sale_id = p_sale AND unit_id IS NOT NULL) ORDER BY id FOR UPDATE;
  SELECT * INTO s FROM public.sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy đơn bán.'); END IF;
  IF s.status <> 'confirmed' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Chỉ hủy được đơn đã ghi (đơn nháp cũ thì xóa).'); END IF;
  v_legacy := EXISTS (SELECT 1 FROM public.sale_lines WHERE sale_id = p_sale AND (line_type <> 'watch' OR assignment_line_id IS NOT NULL OR settlement_id IS NOT NULL))
           OR EXISTS (SELECT 1 FROM public.sale_trade_ins WHERE sale_id = p_sale)
           OR s.deposit_applied_vnd > 0 OR s.reservation_id IS NOT NULL
           OR EXISTS (SELECT 1 FROM public.payments WHERE doc_type = 'sale' AND doc_id = p_sale AND status = 'posted');
  IF v_legacy THEN RETURN app.fn_void_sale_v1(p_sale, p_reason); END IF;
  v_hours := app.setting_int('sales.void_window_hours', 24);
  IF app.now_ts() > s.confirmed_at + make_interval(hours => v_hours) THEN
    PERFORM app.raise_wf('WF-SALE-VOID-EXPIRED', format('Đã quá %s giờ kể từ lúc ghi đơn, không thể hủy.', v_hours));
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  FOR l IN SELECT * FROM public.sale_lines WHERE sale_id = p_sale ORDER BY line_no LOOP
    IF NOT l.is_effective THEN PERFORM app.raise_wf('WF-SALE-VOID-NOT-ALLOWED', 'Chiếc trong đơn đã được cửa hàng mua lại, không hủy được đơn.'); END IF;
    UPDATE public.sale_lines SET is_effective = false WHERE id = l.id;
    PERFORM app.set_unit_status(l.unit_id, 'in_stock', 'Hủy đơn bán: ' || v_reason, 'sales', p_sale);
    PERFORM set_config('app.in_fn', 'on', true);
  END LOOP;
  UPDATE public.collaborator_claims SET status = 'voided' WHERE sale_id = p_sale AND status = 'confirmed';
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

-- ===== Chủ giao chiếc cho một hay nhiều CTV (BR-COL-12): chiếc vẫn in_stock =====
CREATE OR REPLACE FUNCTION app.fn_offer_units(p_units uuid[], p_collaborators uuid[], p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_units uuid[]; v_collabs uuid[]; v_found int; v_bad text; n int; c uuid;
BEGIN
  PERFORM app.require_permission('collab.manage');
  SET LOCAL lock_timeout = '5s';
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_units FROM unnest(coalesce(p_units, '{}')) x;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_collabs FROM unnest(coalesce(p_collaborators, '{}')) x;
  IF coalesce(cardinality(v_units), 0) NOT BETWEEN 1 AND 100 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chọn từ 1 đến 100 chiếc để giao.'); END IF;
  IF coalesce(cardinality(v_collabs), 0) NOT BETWEEN 1 AND 50 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chọn từ 1 đến 50 cộng tác viên.'); END IF;
  SELECT count(*) INTO v_found FROM (SELECT 1 FROM public.watch_units WHERE id = ANY(v_units) ORDER BY id FOR UPDATE) q;
  IF v_found <> cardinality(v_units) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Có chiếc đồng hồ không tồn tại.'); END IF;
  SELECT string_agg(asset_code, ', ' ORDER BY asset_code) INTO v_bad FROM public.watch_units WHERE id = ANY(v_units) AND status <> 'in_stock';
  IF v_bad IS NOT NULL THEN
    PERFORM app.raise_wf('WF-COL-UNIT-NOT-OFFERABLE', 'Chỉ giao được chiếc đang “Sẵn sàng bán”. Chiếc không hợp lệ: ' || v_bad || '.');
  END IF;
  -- CTV = người dùng đang hoạt động có quyền collab.view_own; hồ sơ (SĐT/khu vực) là tùy chọn — chưa có hồ sơ vẫn giao được, chỉ chặn khi hồ sơ đã tắt
  SELECT count(*) INTO v_found FROM public.users u LEFT JOIN public.collaborator_profiles cp ON cp.user_id = u.id
  WHERE u.id = ANY(v_collabs) AND u.status = 'active' AND coalesce(cp.is_active, true) AND 'collab.view_own' = ANY(app.user_permissions(u.id));
  IF v_found <> cardinality(v_collabs) THEN PERFORM app.raise_wf('WF-VALIDATION', 'Có cộng tác viên không tồn tại hoặc đã ngừng hoạt động.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  INSERT INTO public.collaborator_offers (unit_id, collaborator_id, note, offered_by)
  SELECT u, c2, nullif(btrim(coalesce(p_note, '')), ''), app.current_user_id() FROM unnest(v_units) u CROSS JOIN unnest(v_collabs) c2
  ON CONFLICT (unit_id, collaborator_id) WHERE status = 'active' DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  FOREACH c IN ARRAY v_collabs LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (c, 'collab.offered', 'Có đồng hồ mới để bán', 'Cửa hàng vừa giao thêm đồng hồ cho bạn. Ai báo đã bán trước sẽ được giữ chiếc.', '/ctv');
  END LOOP;
  PERFORM app.fn_audit_event('collab.offered', 'collaborator_offers', NULL, NULL,
    jsonb_build_object('units', cardinality(v_units), 'collaborators', cardinality(v_collabs), 'created', n), NULL, 'info');
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('created', n, 'units', cardinality(v_units), 'collaborators', cardinality(v_collabs));
END $$;
ALTER FUNCTION app.fn_offer_units(uuid[],uuid[],text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_offer_units(uuid[],uuid[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_offer_units(uuid[],uuid[],text) TO wf_app;

-- ===== Chủ thu hồi chào hàng: một CTV hoặc tất cả CTV của chiếc =====
CREATE OR REPLACE FUNCTION app.fn_withdraw_offer(p_unit uuid, p_collaborator uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE n int;
BEGIN
  PERFORM app.require_permission('collab.manage');
  SET LOCAL lock_timeout = '5s';
  PERFORM app.lock_unit(p_unit);
  IF EXISTS (SELECT 1 FROM public.collaborator_claims WHERE unit_id = p_unit AND status = 'pending' AND (p_collaborator IS NULL OR collaborator_id = p_collaborator)) THEN
    PERFORM app.raise_wf('WF-COL-CLAIM-PENDING', 'Chiếc này đang có báo đã bán chờ xác nhận — hãy xác nhận hoặc từ chối trước khi thu hồi.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_offers SET status = 'withdrawn', closed_at = now(), close_reason = 'Cửa hàng thu hồi'
  WHERE unit_id = p_unit AND status = 'active' AND (p_collaborator IS NULL OR collaborator_id = p_collaborator);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM app.fn_audit_event('collab.offer_withdrawn', 'watch_units', p_unit::text, NULL, jsonb_build_object('withdrawn', n, 'collaborator', p_collaborator), NULL, 'info');
  END IF;
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('withdrawn', n);
END $$;
ALTER FUNCTION app.fn_withdraw_offer(uuid,uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_withdraw_offer(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_withdraw_offer(uuid,uuid) TO wf_app;

-- ===== CTV báo đã bán: ai báo trước thì được (BR-COL-13) =====
CREATE OR REPLACE FUNCTION app.fn_collab_claim(p_unit uuid, p_name text, p_phone text, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_me uuid := app.current_user_id(); v_offer uuid; v_name text := btrim(coalesce(p_name, '')); v_phone text := btrim(coalesce(p_phone, ''));
        v_claim uuid; v_pending record;
BEGIN
  PERFORM app.require_permission('collab.view_own');
  SET LOCAL lock_timeout = '5s';
  IF char_length(v_name) NOT BETWEEN 1 AND 120 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Nhập họ tên khách.'); END IF;
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15 OR char_length(v_phone) > 20 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Nhập số điện thoại khách hợp lệ.'); END IF;
  u := app.lock_unit(p_unit);
  SELECT id INTO v_offer FROM public.collaborator_offers WHERE unit_id = p_unit AND collaborator_id = v_me AND status = 'active' FOR UPDATE;
  IF v_offer IS NULL THEN
    PERFORM app.raise_wf('WF-COL-NO-OFFER', CASE WHEN u.status = 'sold' THEN 'Chiếc này đã được bán.' ELSE 'Chiếc này không (còn) được giao cho bạn.' END);
  END IF;
  IF u.status <> 'in_stock' THEN PERFORM app.raise_wf('WF-COL-UNIT-GONE', 'Chiếc này không còn sẵn sàng bán.'); END IF;
  SELECT id, collaborator_id INTO v_pending FROM public.collaborator_claims WHERE unit_id = p_unit AND status = 'pending';
  IF FOUND THEN
    IF v_pending.collaborator_id = v_me THEN PERFORM app.raise_wf('WF-COL-CLAIMED-SELF', 'Bạn đã báo đã bán chiếc này, đang chờ cửa hàng xác nhận.'); END IF;
    PERFORM app.raise_wf('WF-COL-CLAIMED', 'Một cộng tác viên khác đã báo bán chiếc này trước bạn, đang chờ cửa hàng xác nhận.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  INSERT INTO public.collaborator_claims (offer_id, unit_id, collaborator_id, customer_name, customer_phone, note)
  VALUES (v_offer, p_unit, v_me, v_name, v_phone, nullif(btrim(coalesce(p_note, '')), '')) RETURNING id INTO v_claim;
  PERFORM app.fn_notify_permission('sale.confirm', 'collab.claim', 'CTV báo đã bán: ' || u.asset_code,
    coalesce(app.user_display_name(v_me), 'Cộng tác viên') || ' vừa báo đã bán chiếc này — cần bạn xác nhận.', '/cong-tac-vien/bao-ban', 'claim:' || v_claim);
  PERFORM app.fn_audit_event('collab.claimed', 'collaborator_claims', v_claim::text, NULL, jsonb_build_object('unit', p_unit), NULL, 'info');
  PERFORM app.fn_emit_event('collab.claimed', jsonb_build_object('claimId', v_claim, 'unitId', p_unit));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', v_claim, 'status', 'pending');
END $$;
ALTER FUNCTION app.fn_collab_claim(uuid,text,text,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_collab_claim(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_collab_claim(uuid,text,text,text) TO wf_app;

-- ===== CTV rút lại báo bán còn chờ =====
CREATE OR REPLACE FUNCTION app.fn_cancel_claim(p_claim uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE c public.collaborator_claims;
BEGIN
  PERFORM app.require_permission('collab.view_own');
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO c FROM public.collaborator_claims WHERE id = p_claim AND collaborator_id = app.current_user_id() FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy báo bán của bạn.'); END IF;
  IF c.status <> 'pending' THEN PERFORM app.raise_wf('WF-COL-CLAIM-DECIDED', 'Báo bán này đã được xử lý, không rút lại được.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_claims SET status = 'cancelled', decided_at = now(), decided_by = app.current_user_id() WHERE id = p_claim;
  PERFORM app.fn_audit_event('collab.claim_cancelled', 'collaborator_claims', p_claim::text, NULL, NULL, NULL, 'info');
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_claim, 'status', 'cancelled');
END $$;
ALTER FUNCTION app.fn_cancel_claim(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_cancel_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_cancel_claim(uuid) TO wf_app;

-- ===== Cửa hàng từ chối báo bán (chiếc quay lại cho các CTV khác báo) =====
CREATE OR REPLACE FUNCTION app.fn_reject_claim(p_claim uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE c public.collaborator_claims; v_reason text; v_asset text;
BEGIN
  PERFORM app.require_permission('sale.confirm');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO c FROM public.collaborator_claims WHERE id = p_claim FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy báo bán.'); END IF;
  IF c.status <> 'pending' THEN PERFORM app.raise_wf('WF-COL-CLAIM-DECIDED', 'Báo bán này đã được xử lý.'); END IF;
  SELECT asset_code INTO v_asset FROM public.watch_units WHERE id = c.unit_id;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.collaborator_claims SET status = 'rejected', reject_reason = v_reason, decided_at = now(), decided_by = app.current_user_id() WHERE id = p_claim;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (c.collaborator_id, 'collab.claim_rejected', 'Báo bán bị từ chối: ' || v_asset, v_reason, '/ctv/don');
  PERFORM app.fn_audit_event('collab.claim_rejected', 'collaborator_claims', p_claim::text, NULL, NULL, v_reason, 'info');
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_claim, 'status', 'rejected');
END $$;
ALTER FUNCTION app.fn_reject_claim(uuid,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_reject_claim(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_reject_claim(uuid,text) TO wf_app;

-- ===== Cửa hàng xác nhận báo bán ⇒ tạo đơn bán, chiếc → sold, các CTV khác mất quyền (BR-COL-14/15) =====
-- Giá mặc định = giá niêm yết hiện hành của chiếc (CF-12), chủ sửa được khi xác nhận. Doanh thu cửa hàng = giá này.
CREATE OR REPLACE FUNCTION app.fn_confirm_claim(p_claim uuid, p_price bigint DEFAULT NULL, p_doc_date date DEFAULT NULL, p_warranty_months int DEFAULT NULL,
                                                p_backdate_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  c public.collaborator_claims; u public.watch_units; v_unit uuid; v_date date; v_list bigint; v_price bigint; v_cust uuid; v_sale uuid; v_code text;
  v_line uuid; v_cost bigint; v_end date; o record;
BEGIN
  PERFORM app.require_permission('sale.confirm');
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '15s';
  SELECT unit_id INTO v_unit FROM public.collaborator_claims WHERE id = p_claim;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy báo bán.'); END IF;
  u := app.lock_unit(v_unit);
  SELECT * INTO c FROM public.collaborator_claims WHERE id = p_claim FOR UPDATE;
  IF c.status <> 'pending' THEN PERFORM app.raise_wf('WF-COL-CLAIM-DECIDED', 'Báo bán này đã được xử lý (có thể CTV vừa rút lại).'); END IF;
  IF u.status <> 'in_stock' THEN PERFORM app.raise_wf('WF-COL-UNIT-GONE', 'Chiếc này không còn sẵn sàng bán.'); END IF;
  IF p_warranty_months IS NOT NULL AND (p_warranty_months < 0 OR p_warranty_months > 120) THEN PERFORM app.raise_wf('WF-VALIDATION', 'Hạn bảo hành từ 0 đến 120 tháng.'); END IF;
  v_date := app.check_doc_date(p_doc_date, p_backdate_reason);
  v_list := app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to, v_date);
  v_price := coalesce(p_price, v_list);
  IF v_price IS NULL OR v_price <= 0 OR v_price > 9007199254740991 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Giá bán phải lớn hơn 0 (chiếc chưa có giá niêm yết thì nhập giá).'); END IF;

  PERFORM set_config('app.in_fn', 'on', true);
  -- Khách: dùng lại khách trùng SĐT, nếu chưa có thì tạo
  SELECT id INTO v_cust FROM public.customers WHERE phone_norm = app.norm_phone(c.customer_phone) AND anonymized_at IS NULL ORDER BY created_at LIMIT 1;
  IF v_cust IS NULL THEN
    INSERT INTO public.customers (full_name, phone, created_by) VALUES (c.customer_name, c.customer_phone, app.current_user_id()) RETURNING id INTO v_cust;
  END IF;
  v_code := app.fn_next_number('HD');
  INSERT INTO public.sales (code, customer_id, doc_date, backdate_reason, status, collaborator_id, subtotal_list_vnd, discount_total_vnd, grand_total_vnd, note,
                            confirmed_at, confirmed_by, created_by, updated_by)
  VALUES (v_code, v_cust, v_date, nullif(btrim(coalesce(p_backdate_reason, '')), ''), 'confirmed', c.collaborator_id, v_list, greatest(v_list - v_price, 0), v_price,
          c.note, now(), app.current_user_id(), app.current_user_id(), app.current_user_id())
  RETURNING id INTO v_sale;
  INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, list_price_snapshot_vnd, unit_price_vnd, line_discount_vnd, alloc_discount_vnd,
                                 line_total_vnd, shop_revenue_vnd, is_effective)
  VALUES (v_sale, 1, 'watch', u.id, 1, v_list, v_price, v_list - v_price, 0, v_price, v_price, true) RETURNING id INTO v_line;
  SELECT coalesce(sum(amount_vnd), 0) INTO v_cost FROM public.unit_cost_entries WHERE unit_id = u.id AND cycle = u.cost_cycle;
  INSERT INTO public.sale_line_costs (sale_line_id, cost_vnd, cost_cycle) VALUES (v_line, v_cost, u.cost_cycle);
  -- Chốt báo bán + chào hàng thắng TRƯỚC khi đổi trạng thái chiếc (trigger sẽ đóng các chào hàng còn lại thành 'lost')
  UPDATE public.collaborator_claims SET status = 'confirmed', sale_id = v_sale, decided_at = now(), decided_by = app.current_user_id() WHERE id = p_claim;
  UPDATE public.collaborator_offers SET status = 'won', closed_at = now(), close_reason = 'Bán được' WHERE id = c.offer_id;
  FOR o IN SELECT collaborator_id FROM public.collaborator_offers WHERE unit_id = u.id AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (o.collaborator_id, 'collab.offer_lost', 'Chiếc ' || u.asset_code || ' đã được bán', 'Một cộng tác viên khác đã bán được trước. Chiếc này không còn trong danh sách của bạn.', '/ctv');
  END LOOP;
  PERFORM app.set_unit_status(u.id, 'sold', 'CTV bán', 'sales', v_sale);
  PERFORM set_config('app.in_fn', 'on', true);
  v_end := app.mk_sale_warranty(v_line, u.id, v_cust, v_date, p_warranty_months);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (c.collaborator_id, 'collab.claim_confirmed', 'Đã xác nhận bán: ' || u.asset_code, 'Cửa hàng đã xác nhận bạn bán được chiếc này.', '/ctv/don');
  PERFORM app.fn_audit_event('collab.claim_confirmed', 'collaborator_claims', p_claim::text, NULL, jsonb_build_object('sale', v_code, 'price', v_price), NULL, 'info');
  PERFORM app.fn_emit_event('sale.confirmed', jsonb_build_object('saleId', v_sale, 'code', v_code, 'grandTotal', v_price));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('saleId', v_sale, 'code', v_code, 'price', v_price, 'warrantyEnd', v_end);
END $$;
ALTER FUNCTION app.fn_confirm_claim(uuid,bigint,date,int,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_confirm_claim(uuid,bigint,date,int,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_confirm_claim(uuid,bigint,date,int,text) TO wf_app;

-- ===== Màn hình của CTV: chỉ cột an toàn (KHÔNG giá vốn/doanh thu); giá niêm yết để tham khảo =====
CREATE OR REPLACE FUNCTION app.fn_my_offers() RETURNS TABLE (
  unit_id uuid, asset_code text, serial_no text, condition text, condition_grade text, model_name text, brand_name text, list_price_vnd bigint,
  offered_at timestamptz, photo_id uuid, claim_id uuid, taken boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.view_own');
  RETURN QUERY
  SELECT u.id, u.asset_code, u.serial_no, u.condition, u.condition_grade, m.name, b.name,
         app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to),
         o.offered_at,
         (SELECT f.id FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1),
         (SELECT c.id FROM public.collaborator_claims c WHERE c.unit_id = u.id AND c.status = 'pending' AND c.collaborator_id = app.current_user_id()),
         EXISTS (SELECT 1 FROM public.collaborator_claims c WHERE c.unit_id = u.id AND c.status = 'pending' AND c.collaborator_id <> app.current_user_id())
  FROM public.collaborator_offers o
  JOIN public.watch_units u ON u.id = o.unit_id JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
  WHERE o.collaborator_id = app.current_user_id() AND o.status = 'active' AND u.status = 'in_stock'
  ORDER BY o.offered_at DESC, u.asset_code;
END $$;
ALTER FUNCTION app.fn_my_offers() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_my_offers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_my_offers() TO wf_app;

CREATE OR REPLACE FUNCTION app.fn_my_claims(p_limit int DEFAULT 100) RETURNS TABLE (
  id uuid, unit_id uuid, asset_code text, model_name text, brand_name text, customer_name text, customer_phone text, note text, status text,
  reject_reason text, created_at timestamptz, decided_at timestamptz, photo_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.view_own');
  RETURN QUERY
  SELECT c.id, c.unit_id, u.asset_code, m.name, b.name, c.customer_name, c.customer_phone, c.note, c.status, c.reject_reason, c.created_at, c.decided_at,
         (SELECT f.id FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = u.id AND f.kind = 'product' AND NOT f.is_deleted ORDER BY f.created_at LIMIT 1)
  FROM public.collaborator_claims c
  JOIN public.watch_units u ON u.id = c.unit_id JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
  WHERE c.collaborator_id = app.current_user_id()
  ORDER BY c.created_at DESC LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END $$;
ALTER FUNCTION app.fn_my_claims(int) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_my_claims(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_my_claims(int) TO wf_app;

-- Thống kê của CTV: CHỈ số chiếc (không tiền) theo ngày/tháng/quý/năm
CREATE OR REPLACE FUNCTION app.fn_my_collab_stats(p_from date, p_to date, p_period text DEFAULT 'month') RETURNS TABLE (period_start date, units_sold bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.view_own');
  IF p_period NOT IN ('day','month','quarter','year') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Kỳ không hợp lệ.'); END IF;
  RETURN QUERY
  SELECT app.rpt_bucket(s.doc_date, p_period), count(*)::bigint
  FROM public.collaborator_claims c JOIN public.sales s ON s.id = c.sale_id
  WHERE c.collaborator_id = app.current_user_id() AND c.status = 'confirmed' AND s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to
  GROUP BY 1 ORDER BY 1;
END $$;
ALTER FUNCTION app.fn_my_collab_stats(date,date,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_my_collab_stats(date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_my_collab_stats(date,date,text) TO wf_app;

-- Hàm báo cáo CTV cũ trả tiền (giá thu/phần hưởng): từ nay CHỈ người có collab.view, CTV không được gọi
CREATE OR REPLACE FUNCTION app.rpt_collaborator(p_from date, p_to date, p_period text DEFAULT 'month', p_collaborator uuid DEFAULT NULL)
RETURNS TABLE (collaborator_id uuid, collaborator_name text, period_start date, units_sold bigint, sales_total bigint, base_total bigint, collab_earn bigint,
               settled bigint, unsettled bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.view');
  IF p_period NOT IN ('month','quarter','year') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Kỳ không hợp lệ.'); END IF;
  RETURN QUERY
  SELECT s.collaborator_id, app.user_display_name(s.collaborator_id), date_trunc(p_period, s.doc_date)::date,
         count(*)::bigint, sum(sl.line_total_vnd)::bigint, coalesce(sum(sl.base_price_vnd), 0)::bigint, coalesce(sum(sl.line_total_vnd - sl.base_price_vnd), 0)::bigint,
         coalesce(sum(sl.base_price_vnd) FILTER (WHERE sl.settlement_id IS NOT NULL), 0)::bigint,
         coalesce(sum(sl.base_price_vnd) FILTER (WHERE sl.settlement_id IS NULL), 0)::bigint
  FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
  WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND s.doc_date BETWEEN p_from AND p_to
    AND (p_collaborator IS NULL OR s.collaborator_id = p_collaborator)
  GROUP BY s.collaborator_id, date_trunc(p_period, s.doc_date)
  ORDER BY 3, 2;
END $$;
ALTER FUNCTION app.rpt_collaborator(date,date,text,uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.rpt_collaborator(date,date,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.rpt_collaborator(date,date,text,uuid) TO wf_app, wf_worker;

-- ===== Báo cáo =====
-- R1 Doanh thu theo kỳ: thêm số chiếc + tách kênh (cửa hàng / CTV / sửa chữa). Doanh thu từ CHỨNG TỪ (đơn bán đã ghi, phiếu sửa đã giao) — BR-PAY-02.
CREATE OR REPLACE FUNCTION app.rpt_revenue(p_from date, p_to date, p_group text DEFAULT 'day') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('report.sales');
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'period'), '[]') FROM (
    SELECT jsonb_build_object('period', k, 'shopRevenue', sum(shop), 'collabRevenue', sum(col), 'salesRevenue', sum(shop) + sum(col), 'repairRevenue', sum(rr),
      'revenue', sum(shop) + sum(col) + sum(rr), 'invoiceCount', sum(ic), 'unitsSold', sum(us), 'collabUnits', sum(cu), 'repairCount', sum(rc),
      'avgPerInvoice', CASE WHEN sum(ic) > 0 THEN round((sum(shop) + sum(col)) / sum(ic)) ELSE 0 END) x
    FROM (
      SELECT app.rpt_bucket(s.doc_date, p_group) k,
             coalesce(sum(sl.shop_revenue_vnd) FILTER (WHERE s.collaborator_id IS NULL), 0) shop,
             coalesce(sum(sl.shop_revenue_vnd) FILTER (WHERE s.collaborator_id IS NOT NULL), 0) col,
             0::numeric rr, count(DISTINCT s.id) ic,
             count(*) FILTER (WHERE sl.line_type = 'watch') us, count(*) FILTER (WHERE sl.line_type = 'watch' AND s.collaborator_id IS NOT NULL) cu, 0::bigint rc
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id WHERE s.status = 'confirmed' AND s.doc_date BETWEEN p_from AND p_to GROUP BY 1
      UNION ALL
      SELECT app.rpt_bucket(o.delivered_date, p_group), 0, 0, sum(o.revenue_vnd), 0, 0, 0, count(*) FROM public.repair_orders o
      WHERE o.status = 'delivered' AND o.kind = 'customer' AND o.delivered_date BETWEEN p_from AND p_to GROUP BY 1) t GROUP BY k) q);
END $$;

-- R2 Số lượng đồng hồ: đã bán trong kỳ (theo hãng, theo kênh) + tồn kho hiện tại
CREATE OR REPLACE FUNCTION app.rpt_units(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF NOT app.has_any_permission(ARRAY['report.sales','report.inventory']) THEN PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn không có quyền xem báo cáo này.'); END IF;
  RETURN jsonb_build_object(
    'sold', jsonb_build_object(
      'total', (SELECT count(*) FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE s.status = 'confirmed' AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to),
      'shop', (SELECT count(*) FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE s.status = 'confirmed' AND sl.line_type = 'watch' AND s.collaborator_id IS NULL AND s.doc_date BETWEEN p_from AND p_to),
      'collab', (SELECT count(*) FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE s.status = 'confirmed' AND sl.line_type = 'watch' AND s.collaborator_id IS NOT NULL AND s.doc_date BETWEEN p_from AND p_to),
      'byBrand', (SELECT coalesce(jsonb_agg(jsonb_build_object('brand', brand, 'units', n) ORDER BY n DESC, brand), '[]') FROM (
        SELECT b.name brand, count(*) n FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id JOIN public.watch_units u ON u.id = sl.unit_id JOIN public.brands b ON b.id = u.brand_id
        WHERE s.status = 'confirmed' AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to GROUP BY b.name) q)),
    'stock', jsonb_build_object(
      'sellable', (SELECT count(*) FROM public.watch_units WHERE status = 'in_stock'),
      'inspecting', (SELECT count(*) FROM public.watch_units WHERE status = 'inspecting'),
      'offered', (SELECT count(DISTINCT unit_id) FROM public.collaborator_offers WHERE status = 'active'),
      'byBrand', (SELECT coalesce(jsonb_agg(jsonb_build_object('brand', brand, 'units', n) ORDER BY n DESC, brand), '[]') FROM (
        SELECT b.name brand, count(*) n FROM public.watch_units u JOIN public.brands b ON b.id = u.brand_id WHERE u.status IN ('in_stock','inspecting') GROUP BY b.name) q)));
END $$;

-- R3 Cộng tác viên mang về (CHỈ chủ/collab.view): theo kỳ + từng CTV — số chiếc và doanh thu
CREATE OR REPLACE FUNCTION app.rpt_collab_sales(p_from date, p_to date, p_group text DEFAULT 'month') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('collab.view');
  RETURN jsonb_build_object(
    'periods', (SELECT coalesce(jsonb_agg(jsonb_build_object('period', k, 'units', n, 'revenue', r, 'collaborators', cc) ORDER BY k), '[]') FROM (
      SELECT app.rpt_bucket(s.doc_date, p_group) k, count(*) n, coalesce(sum(sl.shop_revenue_vnd), 0) r, count(DISTINCT s.collaborator_id) cc
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
      WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to GROUP BY 1) q),
    'byCollaborator', (SELECT coalesce(jsonb_agg(jsonb_build_object('collaboratorId', cid, 'name', nm, 'units', n, 'revenue', r) ORDER BY r DESC, nm), '[]') FROM (
      SELECT s.collaborator_id cid, app.user_display_name(s.collaborator_id) nm, count(*) n, coalesce(sum(sl.shop_revenue_vnd), 0) r
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
      WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to GROUP BY 1, 2) q),
    'rows', (SELECT coalesce(jsonb_agg(jsonb_build_object('period', k, 'collaboratorId', cid, 'name', nm, 'units', n, 'revenue', r) ORDER BY k, nm), '[]') FROM (
      SELECT app.rpt_bucket(s.doc_date, p_group) k, s.collaborator_id cid, app.user_display_name(s.collaborator_id) nm, count(*) n, coalesce(sum(sl.shop_revenue_vnd), 0) r
      FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id
      WHERE s.status = 'confirmed' AND s.collaborator_id IS NOT NULL AND sl.line_type = 'watch' AND s.doc_date BETWEEN p_from AND p_to GROUP BY 1, 2, 3) q));
END $$;

-- Tổng quan: chỉ số theo quyền, KHÔNG còn giá vốn/lãi/nợ/cọc/linh kiện/kiểm kê
CREATE OR REPLACE FUNCTION app.rpt_dashboard(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE b jsonb := app.rpt_base(p_from, p_to); out jsonb := jsonb_build_object('from', p_from, 'to', p_to); v jsonb;
BEGIN
  IF app.current_user_id() IS NULL THEN PERFORM app.raise_wf('WF-AUTH-UNAUTHENTICATED', 'Cần đăng nhập.'); END IF;
  IF app.has_permission('report.sales') THEN
    out := out || jsonb_build_object('revenue', (b->>'salesRevenue')::bigint + (b->>'repairRevenue')::bigint, 'salesRevenue', b->'salesRevenue',
      'shopSalesRevenue', b->'shopSalesRevenue', 'collabSalesRevenue', b->'collabSalesRevenue', 'repairRevenue', b->'repairRevenue',
      'invoiceCount', b->'invoiceCount', 'unitsSold', b->'unitsSold');
  END IF;
  IF app.has_any_permission(ARRAY['report.inventory','catalog.view']) THEN
    SELECT jsonb_build_object('unitsInStock', count(*) FILTER (WHERE status IN ('in_stock','inspecting')), 'unitsSellable', count(*) FILTER (WHERE status = 'in_stock'),
      'unitsInspecting', count(*) FILTER (WHERE status = 'inspecting')) INTO v FROM public.watch_units;
    out := out || v || jsonb_build_object('unitsOffered', (SELECT count(DISTINCT unit_id) FROM public.collaborator_offers WHERE status = 'active'));
  END IF;
  IF app.has_any_permission(ARRAY['collab.view','sale.confirm']) THEN
    out := out || jsonb_build_object('collabPendingClaims', (SELECT count(*) FROM public.collaborator_claims WHERE status = 'pending'));
  END IF;
  IF app.has_permission('repair.view') THEN
    out := out || jsonb_build_object('repairsOpen', (SELECT count(*) FROM public.repair_orders WHERE status IN ('received','inspecting','repairing','waiting_parts') AND kind = 'customer'),
      'repairsReady', (SELECT count(*) FROM public.repair_orders WHERE status = 'completed' AND kind = 'customer'));
  END IF;
  RETURN out;
END $$;

-- ===== Cảnh báo hằng ngày: chỉ giữ việc còn ý nghĩa ở bản gọn =====
CREATE OR REPLACE FUNCTION app.fn_daily_alerts() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE d date := app.today_vn(); n_wexp int; c record; out jsonb := '{}'; v int;
BEGIN
  PERFORM set_config('app.in_fn', 'on', true);
  -- Hạn bảo hành đã qua ⇒ expired (chỉ cập nhật trạng thái, không còn thông báo — bản gọn không có màn Bảo hành)
  UPDATE public.warranties SET status = 'expired' WHERE status = 'active' AND end_date < d;
  GET DIAGNOSTICS n_wexp = ROW_COUNT;
  out := out || jsonb_build_object('warrantiesExpired', n_wexp);
  -- Máy sửa hoàn thành chưa lấy (BR-REP-12)
  v := 0;
  FOR c IN SELECT o.id, o.code FROM public.repair_orders o WHERE o.status = 'completed' AND o.kind = 'customer' AND o.completed_at::date <= d - app.setting_int('repair.pickup_alert_days', 14) LOOP
    PERFORM app.fn_notify_permission('repair.view', 'repair.pickup', 'Máy chưa lấy: ' || c.code, 'Máy đã hoàn thành nhưng khách chưa đến lấy.', '/sua-chua/' || c.id, 'pick:' || c.id);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('repairsNotPicked', v);
  -- Báo bán của CTV chờ xác nhận quá 1 ngày ⇒ nhắc người xác nhận
  v := 0;
  FOR c IN SELECT cl.id, u.asset_code FROM public.collaborator_claims cl JOIN public.watch_units u ON u.id = cl.unit_id
           WHERE cl.status = 'pending' AND cl.created_at < now() - interval '1 day' LOOP
    PERFORM app.fn_notify_permission('sale.confirm', 'collab.claim_waiting', 'CTV báo bán chờ xác nhận: ' || c.asset_code, 'Có báo bán đã chờ hơn một ngày.', '/cong-tac-vien/bao-ban', 'claimw:' || c.id || ':' || d);
    v := v + 1;
  END LOOP;
  out := out || jsonb_build_object('claimsWaiting', v);
  PERFORM set_config('app.in_fn', '', true);
  RETURN out;
END $$;

-- ===== Bộ kiểm bất biến: sửa I11 cho đơn CTV mới; thêm I13/I14 cho chào hàng/báo bán =====
CREATE OR REPLACE FUNCTION app.fn_consistency_check() RETURNS TABLE (check_code text, entity_id text, detail text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT 'I1', p.id::text, 'Thanh toán ' || p.code || ' trỏ tới chứng từ không tồn tại'
  FROM public.payments p WHERE p.status = 'posted' AND NOT (
       (p.doc_type = 'sale' AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = p.doc_id AND s.status = 'confirmed'))
    OR (p.doc_type = 'reservation' AND EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = p.doc_id))
    OR (p.doc_type = 'repair' AND EXISTS (SELECT 1 FROM public.repair_orders o WHERE o.id = p.doc_id))
    OR (p.doc_type = 'settlement' AND EXISTS (SELECT 1 FROM public.collaborator_settlements c WHERE c.id = p.doc_id AND c.status = 'confirmed')))
  UNION ALL
  SELECT 'I2', b.doc_id::text, b.doc_type || ' ' || b.code || ' thu vượt / cọc âm' FROM public.v_doc_balances b WHERE b.due < 0 OR b.held < 0
  UNION ALL
  SELECT 'I2', r.id::text, 'Giữ hàng ' || r.code || ' đã đóng nhưng cọc còn lệch'
  FROM public.reservations r JOIN public.v_doc_balances b ON b.doc_type = 'reservation' AND b.doc_id = r.id WHERE r.status NOT IN ('active','expired') AND b.held <> 0
  UNION ALL
  SELECT 'I3', u.id::text, 'Chiếc ' || u.asset_code || ' lệch lịch sử trạng thái'
  FROM public.watch_units u WHERE u.status IS DISTINCT FROM (SELECT h.to_status FROM public.unit_status_history h WHERE h.unit_id = u.id ORDER BY h.at DESC, h.id DESC LIMIT 1)
  UNION ALL
  SELECT 'I4', u.id::text, 'Chiếc ' || u.asset_code || ' có ' || (SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) || ' dòng bán hiệu lực'
  FROM public.watch_units u WHERE (u.status = 'sold') <> ((SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) = 1)
    AND NOT (u.status <> 'sold' AND (SELECT count(*) FROM public.sale_lines sl WHERE sl.unit_id = u.id AND sl.is_effective) = 0)
  UNION ALL
  SELECT 'I5', u.id::text, 'Chiếc ' || u.asset_code || ' lệch giữ hàng'
  FROM public.watch_units u WHERE (u.status = 'reserved') <> EXISTS (SELECT 1 FROM public.reservations r WHERE r.unit_id = u.id AND r.status IN ('active','expired'))
  UNION ALL
  SELECT 'I6', u.id::text, 'Chiếc ' || u.asset_code || ' lệch phiếu giao CTV'
  FROM public.watch_units u WHERE (u.status = 'with_collaborator') <> EXISTS (SELECT 1 FROM public.collaborator_assignment_lines l
    JOIN public.collaborator_assignments a ON a.id = l.assignment_id WHERE l.unit_id = u.id AND l.status = 'active' AND a.collaborator_id = u.held_by_collaborator_id)
  UNION ALL
  SELECT 'I7', p.id::text, 'Linh kiện ' || p.code || ' tồn ' || p.qty_on_hand || ' ≠ Σ xuất nhập'
  FROM public.parts p WHERE p.qty_on_hand <> coalesce((SELECT sum(m.qty_delta) FROM public.part_stock_movements m WHERE m.part_id = p.id), 0)
  UNION ALL
  SELECT 'I8', sl.id::text, 'Dòng bán thiếu giá vốn chốt'
  FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE s.status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM public.sale_line_costs c WHERE c.sale_line_id = sl.id)
  UNION ALL
  SELECT 'I9', l.id::text, 'Dòng phiếu nhập ' || r.code || ' thiếu chiếc'
  FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id = l.receipt_id WHERE r.status = 'confirmed' AND l.line_type = 'watch' AND l.unit_id IS NULL
  UNION ALL
  SELECT 'I9', u.id::text, 'Chiếc ' || u.asset_code || ' còn trong kho dù phiếu nhập đã hủy'
  FROM public.purchase_lines l JOIN public.purchase_receipts r ON r.id = l.receipt_id JOIN public.watch_units u ON u.id = l.unit_id
  WHERE r.status = 'voided' AND l.rebuy_unit_id IS NULL AND u.status = 'in_stock'
  UNION ALL
  SELECT 'I10', cs.id::text, 'Quyết toán ' || cs.code || ' lệch tổng'
  FROM public.collaborator_settlements cs WHERE cs.status = 'confirmed' AND (cs.total_vnd <> (SELECT coalesce(sum(base_price_vnd), 0) FROM public.sale_lines WHERE settlement_id = cs.id)
    OR cs.total_vnd <> (SELECT coalesce(sum(amount_vnd), 0) FROM public.payments p WHERE p.doc_type = 'settlement' AND p.doc_id = cs.id AND p.status = 'posted'))
  UNION ALL
  -- I11: doanh thu dòng = giá bán; riêng đơn CTV kiểu cũ (có dòng phiếu giao) = giá thu
  SELECT 'I11', sl.id::text, 'Doanh thu dòng bán lệch quy tắc'
  FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id
  WHERE s.status = 'confirmed' AND sl.shop_revenue_vnd <> CASE WHEN s.collaborator_id IS NOT NULL AND sl.assignment_line_id IS NOT NULL THEN coalesce(sl.base_price_vnd, -1) ELSE sl.line_total_vnd END
  UNION ALL
  SELECT 'I12', o.id::text, 'Phiếu sửa ' || o.code || ' lệch doanh thu'
  FROM public.repair_orders o WHERE o.status = 'delivered' AND o.revenue_vnd <> CASE WHEN o.kind = 'customer' AND o.charge_mode = 'paid'
    THEN (SELECT coalesce(sum(line_total_vnd), 0) FROM public.repair_lines WHERE order_id = o.id) ELSE 0 END
  UNION ALL
  -- I13: chào hàng CTV còn hiệu lực chỉ trên chiếc "sẵn sàng bán"
  SELECT 'I13', o.id::text, 'Chào hàng CTV còn hiệu lực trên chiếc ' || u.asset_code || ' không ở trạng thái sẵn sàng bán'
  FROM public.collaborator_offers o JOIN public.watch_units u ON u.id = o.unit_id WHERE o.status = 'active' AND u.status <> 'in_stock'
  UNION ALL
  -- I14: báo bán đang chờ ⇒ chiếc sẵn sàng bán và chào hàng của chính CTV đó còn hiệu lực
  SELECT 'I14', c.id::text, 'Báo bán đang chờ nhưng chiếc không sẵn sàng hoặc chào hàng không còn hiệu lực'
  FROM public.collaborator_claims c JOIN public.watch_units u ON u.id = c.unit_id
  WHERE c.status = 'pending' AND (u.status <> 'in_stock' OR NOT EXISTS (SELECT 1 FROM public.collaborator_offers o WHERE o.id = c.offer_id AND o.status = 'active'))
  UNION ALL
  -- I15: báo bán đã xác nhận ⇒ có đơn bán cùng chiếc (đã ghi hoặc đã hủy)
  SELECT 'I15', c.id::text, 'Báo bán đã xác nhận nhưng thiếu đơn bán tương ứng'
  FROM public.collaborator_claims c WHERE c.status = 'confirmed' AND NOT EXISTS (
    SELECT 1 FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id = s.id WHERE s.id = c.sale_id AND sl.unit_id = c.unit_id AND s.status = 'confirmed')
$$;
ALTER FUNCTION app.fn_consistency_check() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_consistency_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_consistency_check() TO wf_worker;

-- ===== EXECUTE cho hàm báo cáo mới / đổi chữ ký =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.rpt_revenue(date,date,text)','app.rpt_units(date,date)','app.rpt_collab_sales(date,date,text)','app.rpt_dashboard(date,date)','app.fn_daily_alerts()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.rpt_revenue(date,date,text), app.rpt_units(date,date), app.rpt_collab_sales(date,date,text), app.rpt_dashboard(date,date) TO wf_app, wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_daily_alerts() TO wf_worker;

-- ===== Quyền: nhãn đúng nghĩa mới + vai trò CTV chỉ còn collab.view_own (CF-10/CF-13) =====
UPDATE public.permissions SET name_vi = 'Xem đơn bán' WHERE code = 'sale.view';
UPDATE public.permissions SET name_vi = 'Ghi đơn bán & xác nhận CTV báo bán' WHERE code = 'sale.confirm';
UPDATE public.permissions SET name_vi = 'Hủy đơn bán' WHERE code = 'sale.void';
UPDATE public.permissions SET name_vi = 'Xem cộng tác viên & thống kê' WHERE code = 'collab.view';
UPDATE public.permissions SET name_vi = 'Giao đồng hồ cho cộng tác viên' WHERE code = 'collab.manage';
UPDATE public.permissions SET name_vi = 'CTV: xem hàng được giao & báo đã bán' WHERE code = 'collab.view_own';
UPDATE public.permissions SET name_vi = 'Xem hạn bảo hành' WHERE code = 'warranty.view';
UPDATE public.permissions SET name_vi = 'Giao máy sửa' WHERE code = 'repair.deliver';
DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'collaborator')
  AND permission_code IN ('customer.view_own','customer.create','sale.view_own','sale.create_draft');

COMMIT;
