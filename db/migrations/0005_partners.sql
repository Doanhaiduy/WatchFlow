-- 0005_partners.sql — Khách hàng: customer_groups, customers (PII mã hóa tầng ứng dụng), customer_watches;
-- fn_reveal_customer_id (lý do + audit), fn_anonymize_customer. BR-SEC-03, FR-CUS-01/06/07, FR-BAK-05, PT-03, PT-12. Idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_groups (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  note       text,
  is_active  boolean NOT NULL DEFAULT true,
  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_groups_name ON public.customer_groups (lower(name));

CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code            text NOT NULL UNIQUE,
  full_name       text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  phone           text,
  phone_norm      text GENERATED ALWAYS AS (app.norm_phone(phone)) STORED,
  email           citext,
  address         text,
  group_id        uuid REFERENCES public.customer_groups(id) ON DELETE RESTRICT,
  note            text,
  id_number_enc   text,             -- AES-256-GCM (PII_KEY_V1), KHÔNG cấp SELECT cho wf_app
  id_number_bidx  text,             -- HMAC-SHA256 để tìm chính xác
  id_number_last3 text CHECK (id_number_last3 ~ '^[0-9A-Za-z]{1,3}$'),
  is_active       boolean NOT NULL DEFAULT true,
  anonymized_at   timestamptz,
  search_text     text,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT customers_id_pair CHECK ((id_number_enc IS NULL) = (id_number_bidx IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_customers_phone ON public.customers (phone_norm);
CREATE INDEX IF NOT EXISTS ix_customers_bidx ON public.customers (id_number_bidx);
CREATE INDEX IF NOT EXISTS ix_customers_group ON public.customers (group_id);
CREATE INDEX IF NOT EXISTS ix_customers_created_by ON public.customers (created_by);
CREATE INDEX IF NOT EXISTS ix_customers_updated_by ON public.customers (updated_by);
CREATE INDEX IF NOT EXISTS ix_customers_search ON public.customers USING gin (search_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.customer_watches (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  brand_text  text,
  model_text  text,
  serial_no   text,
  serial_norm text GENERATED ALWAYS AS (app.norm_serial(serial_no)) STORED,
  unit_id     uuid REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_customer_watches_customer ON public.customer_watches (customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_watches_serial ON public.customer_watches (serial_norm);
CREATE INDEX IF NOT EXISTS ix_customer_watches_unit ON public.customer_watches (unit_id);
CREATE INDEX IF NOT EXISTS ix_customer_watches_created_by ON public.customer_watches (created_by);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_groups','customers','customer_watches'] LOOP
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
DROP TRIGGER IF EXISTS trg_customer_groups__updated_at ON public.customer_groups;
CREATE TRIGGER trg_customer_groups__updated_at BEFORE UPDATE ON public.customer_groups FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_customers__updated_at ON public.customers;
CREATE TRIGGER trg_customers__updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();

-- Mã khách KH-000001 cấp tự động; search_text (tên, mã, SĐT, email)
CREATE OR REPLACE FUNCTION app.tg_customer_defaults() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.code IS NULL OR NEW.code = '') THEN NEW.code := app.fn_next_number('KH', false, 6); END IF;
  NEW.search_text := app.norm_text(concat_ws(' ', NEW.code, NEW.full_name, app.norm_phone(NEW.phone), NEW.email::text));
  RETURN NEW;
END $$;
ALTER FUNCTION app.tg_customer_defaults() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_customer_defaults() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_customer_defaults() TO wf_app, wf_worker, wf_definer;
DROP TRIGGER IF EXISTS trg_customers__defaults ON public.customers;
CREATE TRIGGER trg_customers__defaults BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION app.tg_customer_defaults();

-- ===== GRANT + RLS =====
GRANT SELECT ON public.customer_groups TO wf_app;
GRANT INSERT (name, note) , UPDATE (name, note, is_active) ON public.customer_groups TO wf_app;
DROP POLICY IF EXISTS customer_groups_select ON public.customer_groups;
CREATE POLICY customer_groups_select ON public.customer_groups FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['customer.view','customer.view_own']));
DROP POLICY IF EXISTS customer_groups_write ON public.customer_groups;
CREATE POLICY customer_groups_write ON public.customer_groups FOR ALL TO wf_app USING (app.has_permission('customer.manage')) WITH CHECK (app.has_permission('customer.manage'));

-- customers: KHÔNG cấp SELECT id_number_enc cho wf_app (PT-12) — xem đủ qua fn_reveal_customer_id
GRANT SELECT (id, code, full_name, phone, phone_norm, email, address, group_id, note, id_number_bidx, id_number_last3, is_active, anonymized_at,
              search_text, version, created_at, created_by, updated_at, updated_by) ON public.customers TO wf_app;
GRANT INSERT (full_name, phone, email, address, group_id, note, id_number_enc, id_number_bidx, id_number_last3, created_by) ON public.customers TO wf_app;
GRANT UPDATE (full_name, phone, email, address, group_id, note, id_number_enc, id_number_bidx, id_number_last3, is_active) ON public.customers TO wf_app;
DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT TO wf_app
  USING (app.has_permission('customer.view') OR (app.has_permission('customer.view_own') AND created_by = app.current_user_id()));
DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers FOR INSERT TO wf_app
  WITH CHECK (app.has_permission('customer.create') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers FOR UPDATE TO wf_app
  USING (anonymized_at IS NULL AND (app.has_permission('customer.manage') OR (app.has_permission('customer.create') AND created_by = app.current_user_id())))
  WITH CHECK (true);

GRANT SELECT, DELETE ON public.customer_watches TO wf_app;
GRANT INSERT (customer_id, brand_text, model_text, serial_no, unit_id, note, created_by) ON public.customer_watches TO wf_app;
DROP POLICY IF EXISTS customer_watches_select ON public.customer_watches;
CREATE POLICY customer_watches_select ON public.customer_watches FOR SELECT TO wf_app
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id));
DROP POLICY IF EXISTS customer_watches_insert ON public.customer_watches;
CREATE POLICY customer_watches_insert ON public.customer_watches FOR INSERT TO wf_app
  WITH CHECK (app.has_any_permission(ARRAY['customer.create','customer.manage']) AND created_by = app.current_user_id()
              AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id));
DROP POLICY IF EXISTS customer_watches_delete ON public.customer_watches;
CREATE POLICY customer_watches_delete ON public.customer_watches FOR DELETE TO wf_app
  USING (app.has_permission('customer.manage') OR created_by = app.current_user_id());

-- ===== Hàm =====
-- Xem CCCD đầy đủ: quyền customer.pii.view + lý do (nếu cài đặt bắt buộc) + audit 'pii.reveal' mức cao. Trả bản mã hóa; ứng dụng giải mã.
CREATE OR REPLACE FUNCTION app.fn_reveal_customer_id(p_customer uuid, p_reason text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_enc text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  PERFORM app.require_permission('customer.pii.view');
  IF (app.setting('security.pii_reveal_requires_reason', 'true'))::boolean THEN
    IF v_reason IS NULL OR char_length(v_reason) < 10 THEN PERFORM app.raise_wf('WF-SEC-PII-REASON', 'Nhập lý do xem số giấy tờ (ít nhất 10 ký tự).'); END IF;
  END IF;
  SELECT id_number_enc INTO v_enc FROM public.customers WHERE id = p_customer;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy khách hàng.'); END IF;
  PERFORM app.fn_audit_event('pii.reveal', 'customers', p_customer::text, NULL, NULL, v_reason, 'high');
  RETURN v_enc;
END $$;

-- Ẩn danh khách (quyền chủ thể dữ liệu): xóa PII, giữ giao dịch
CREATE OR REPLACE FUNCTION app.fn_anonymize_customer(p_customer uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_reason text; c record;
BEGIN
  PERFORM app.require_permission('customer.manage');
  PERFORM app.require_permission('customer.pii.view');
  v_reason := app.require_reason(p_reason);
  SELECT id, code, anonymized_at INTO c FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy khách hàng.'); END IF;
  IF c.anonymized_at IS NOT NULL THEN RETURN jsonb_build_object('id', p_customer, 'unchanged', true); END IF;
  UPDATE public.customers SET full_name = 'Khách đã ẩn danh ' || c.code, phone = NULL, email = NULL, address = NULL, note = NULL,
    id_number_enc = NULL, id_number_bidx = NULL, id_number_last3 = NULL, is_active = false, anonymized_at = now()
  WHERE id = p_customer;
  UPDATE public.files SET is_deleted = true WHERE entity_table = 'customers' AND entity_id = p_customer AND kind = 'id_document';
  PERFORM app.fn_audit_event('customer.anonymized', 'customers', p_customer::text, NULL, NULL, v_reason, 'high');
  RETURN jsonb_build_object('id', p_customer);
END $$;

ALTER FUNCTION app.fn_reveal_customer_id(uuid, text) OWNER TO wf_definer;
ALTER FUNCTION app.fn_anonymize_customer(uuid, text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_reveal_customer_id(uuid, text), app.fn_anonymize_customer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_reveal_customer_id(uuid, text), app.fn_anonymize_customer(uuid, text) TO wf_app;

-- Ảnh giấy tờ của khách: chỉ customer.pii.view (files_select đã có nhánh id_document); mở rộng nhánh files cho thực thể customers
INSERT INTO public.customer_groups (name, note) VALUES ('Khách lẻ', 'Mặc định'), ('Khách quen', NULL), ('Đại lý / mua sỉ', NULL)
ON CONFLICT DO NOTHING;

COMMIT;
