-- 0003_platform.sql — Nền tảng hệ thống: settings, audit_logs (append-only), number_sequences, files, domain_events,
-- notifications, job_runs, error_events, rate_limit_hits, idempotency_keys, ops_heartbeats; hàm app.setting, tg_audit,
-- fn_next_number, fn_emit_event, fn_begin_request, hàm quản trị người dùng/vai trò/cài đặt; seed settings.
-- BR-GEN-04/06/09, BR-SEC-07, BR-BAK-02, settings-catalog. Idempotent, một transaction.
BEGIN;

-- ===== Bảng =====
CREATE TABLE IF NOT EXISTS public.settings (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_settings_updated_by ON public.settings (updated_by);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  at           timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  action       text NOT NULL,
  entity_table text,
  entity_id    text,
  reason       text,
  before       jsonb,
  after        jsonb,
  request_id   text,
  ip_hash      text,
  level        text NOT NULL DEFAULT 'info' CHECK (level IN ('info','high'))
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON public.audit_logs (entity_table, entity_id, at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor ON public.audit_logs (actor_id, at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_at ON public.audit_logs (at);

CREATE TABLE IF NOT EXISTS public.number_sequences (
  code       text NOT NULL,
  year       integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (code, year)
);

CREATE TABLE IF NOT EXISTS public.files (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  bucket        text NOT NULL CHECK (bucket IN ('unit-photos','repair-photos','documents','branding')),
  path          text NOT NULL UNIQUE,
  original_name text,
  mime          text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes >= 0),
  sha256        text NOT NULL,
  width         integer,
  height        integer,
  thumb_path    text,
  kind          text NOT NULL CHECK (kind IN ('product','condition','intake','evidence','id_document','logo','other')),
  entity_table  text,
  entity_id     uuid,
  is_immutable  boolean NOT NULL DEFAULT false,
  taken_at      timestamptz,
  is_deleted    boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_files_entity ON public.files (entity_table, entity_id);
CREATE INDEX IF NOT EXISTS ix_files_created_by ON public.files (created_by);

CREATE TABLE IF NOT EXISTS public.domain_events (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  type         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  actor_id     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text
);
CREATE INDEX IF NOT EXISTS ix_domain_events_pending ON public.domain_events (available_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_domain_events_actor ON public.domain_events (actor_id);
CREATE INDEX IF NOT EXISTS ix_domain_events_type ON public.domain_events (type, occurred_at);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.job_runs (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  job         text NOT NULL,
  slot        text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed')),
  note        text
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_job_runs_slot ON public.job_runs (job, slot);

CREATE TABLE IF NOT EXISTS public.error_events (
  fingerprint text PRIMARY KEY,
  source      text NOT NULL,
  route       text,
  code        text,
  message     text,
  count       integer NOT NULL DEFAULT 1,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  request_id  text
);

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key_hash     text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 1,
  PRIMARY KEY (key_hash, window_start)
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key          uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route        text NOT NULL,
  request_hash text NOT NULL,
  response     jsonb,
  status_code  integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, user_id)
);
CREATE INDEX IF NOT EXISTS ix_idempotency_keys_user ON public.idempotency_keys (user_id);
CREATE INDEX IF NOT EXISTS ix_idempotency_keys_created ON public.idempotency_keys (created_at);

CREATE TABLE IF NOT EXISTS public.ops_heartbeats (
  id      uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  kind    text NOT NULL CHECK (kind IN ('backup','restore_drill','storage_backup')),
  at      timestamptz NOT NULL DEFAULT now(),
  ok      boolean NOT NULL DEFAULT true,
  note    text
);
CREATE INDEX IF NOT EXISTS ix_ops_heartbeats_kind ON public.ops_heartbeats (kind, at DESC);

-- app_migrations do migrate.mjs tạo; ở đây chỉ chuẩn hóa sở hữu + RLS
CREATE TABLE IF NOT EXISTS public.app_migrations (
  name       text PRIMARY KEY,
  sha256     text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['settings','audit_logs','number_sequences','files','domain_events','notifications','job_runs',
                           'error_events','rate_limit_hits','idempotency_keys','ops_heartbeats','app_migrations'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
  END LOOP;
END $$;

-- ===== Append-only: audit_logs =====
DROP TRIGGER IF EXISTS trg_audit_logs__immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs__immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION app.tg_immutable();
DROP TRIGGER IF EXISTS trg_audit_logs__no_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs__no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate();
DROP TRIGGER IF EXISTS trg_ops_heartbeats__immutable ON public.ops_heartbeats;
CREATE TRIGGER trg_ops_heartbeats__immutable BEFORE UPDATE OR DELETE ON public.ops_heartbeats FOR EACH ROW EXECUTE FUNCTION app.tg_immutable();

-- ===== Hàm nền =====
CREATE OR REPLACE FUNCTION app.setting(p_key text, p_default jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT coalesce((SELECT value FROM public.settings WHERE key = p_key), p_default)
$$;

CREATE OR REPLACE FUNCTION app.setting_int(p_key text, p_default int) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT coalesce((SELECT (value #>> '{}')::int FROM public.settings WHERE key = p_key), p_default)
$$;

-- Ghi một dòng audit (dùng trong fn_*)
CREATE OR REPLACE FUNCTION app.fn_audit_event(p_action text, p_table text, p_id text, p_before jsonb, p_after jsonb,
                                              p_reason text DEFAULT NULL, p_level text DEFAULT 'info') RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, reason, before, after, request_id, ip_hash, level)
  VALUES (app.current_user_id(), p_action, p_table, p_id, p_reason, p_before, p_after, app.request_id(),
          nullif(current_setting('app.ip_hash', true), ''), p_level)
$$;

-- Trigger audit chung: che cột nhạy cảm; UPDATE chỉ ghi cột đổi; TG_ARGV = cột bỏ qua (không ghi nếu chỉ đổi các cột này)
CREATE OR REPLACE FUNCTION app.tg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  masked text[] := ARRAY['password_hash','totp_secret_enc','id_number_enc','id_number_bidx','recovery_codes_hash','token_hash','search_text'];
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

-- Cấp mã chứng từ trong transaction (BR-GEN-06): PREFIX-YYYY-0001 (năm) hoặc PREFIX-000001 (danh mục)
CREATE OR REPLACE FUNCTION app.fn_next_number(p_prefix text, p_yearly boolean DEFAULT true, p_pad int DEFAULT 4) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE y int := CASE WHEN p_yearly THEN extract(year FROM app.today_vn())::int ELSE 0 END; v bigint;
BEGIN
  INSERT INTO public.number_sequences (code, year, last_value) VALUES (p_prefix, y, 1)
  ON CONFLICT (code, year) DO UPDATE SET last_value = public.number_sequences.last_value + 1
  RETURNING last_value INTO v;
  RETURN p_prefix || '-' || CASE WHEN p_yearly THEN y::text || '-' ELSE '' END || lpad(v::text, greatest(p_pad, length(v::text)), '0');
END $$;

-- Outbox: chèn sự kiện cùng transaction (payload không PII)
CREATE OR REPLACE FUNCTION app.fn_emit_event(p_type text, p_payload jsonb DEFAULT '{}') RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  INSERT INTO public.domain_events (type, payload, actor_id) VALUES (p_type, coalesce(p_payload, '{}'), app.current_user_id()) RETURNING id
$$;

-- Thông báo trong ứng dụng cho mọi người có quyền p_perm (dedupe theo khóa)
CREATE OR REPLACE FUNCTION app.fn_notify_permission(p_perm text, p_type text, p_title text, p_body text, p_link text, p_dedupe text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, dedupe_key)
  SELECT u.id, p_type, p_title, p_body, p_link, p_dedupe FROM public.users u
  WHERE u.status = 'active' AND p_perm = ANY(app.user_permissions(u.id))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Bắt đầu request: kiểm phiên + gắn ngữ cảnh người dùng. Gọi bởi wf_api trước khi SET ROLE wf_app.
CREATE OR REPLACE FUNCTION app.fn_begin_request(p_user uuid, p_session uuid, p_request_id text, p_ip_hash text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u record; s record; mfa_roles jsonb; mfa_required boolean;
BEGIN
  SELECT id, email::text AS email, full_name, status, must_change_password, mfa_enabled, locked_until INTO u FROM public.users WHERE id = p_user;
  IF NOT FOUND OR u.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'user'); END IF;
  SELECT id, revoked_at, mfa_at, reauth_at INTO s FROM public.auth_sessions WHERE id = p_session AND user_id = p_user;
  IF NOT FOUND OR s.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'session'); END IF;
  PERFORM set_config('app.current_user_id', p_user::text, true);
  PERFORM set_config('app.session_id', p_session::text, true);
  PERFORM set_config('app.request_id', coalesce(p_request_id, ''), true);
  PERFORM set_config('app.ip_hash', coalesce(p_ip_hash, ''), true);
  mfa_roles := app.setting('security.mfa_required_roles', '["owner"]');
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
                 WHERE ur.user_id = p_user AND mfa_roles ? r.code) INTO mfa_required;
  RETURN jsonb_build_object('ok', true, 'userId', u.id, 'email', u.email, 'fullName', u.full_name,
    'mustChangePassword', u.must_change_password, 'mfaEnabled', u.mfa_enabled, 'mfaRequired', mfa_required,
    'mfaOk', s.mfa_at IS NOT NULL, 'reauthAt', s.reauth_at,
    'roles', (SELECT coalesce(jsonb_agg(r.code ORDER BY r.code), '[]') FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_user),
    'perms', to_jsonb(app.user_permissions(p_user)));
END $$;

-- ===== Quản trị người dùng / vai trò / cài đặt (đường ghi duy nhất) =====
CREATE OR REPLACE FUNCTION app.fn_create_user(p_email text, p_full_name text, p_phone text, p_password_hash text, p_roles text[]) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid; v_missing text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email::citext) THEN
    PERFORM app.raise_wf('WF-USER-EMAIL-DUPLICATE', 'Email này đã được dùng cho tài khoản khác.');
  END IF;
  SELECT string_agg(x, ', ') INTO v_missing FROM unnest(p_roles) x WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = x AND is_active);
  IF v_missing IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Vai trò không hợp lệ: ' || v_missing); END IF;
  INSERT INTO public.users (email, full_name, phone, password_hash, must_change_password, created_by)
  VALUES (p_email, btrim(p_full_name), nullif(btrim(coalesce(p_phone, '')), ''), p_password_hash, true, app.current_user_id())
  RETURNING id INTO v_id;
  INSERT INTO public.user_roles (user_id, role_id) SELECT v_id, id FROM public.roles WHERE code = ANY(p_roles);
  PERFORM app.fn_audit_event('user.roles_set', 'users', v_id::text, NULL, to_jsonb(p_roles), NULL, 'high');
  PERFORM app.fn_emit_event('user.created', jsonb_build_object('userId', v_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION app.fn_update_user(p_id uuid, p_full_name text, p_phone text, p_email text, p_version int) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u record;
BEGIN
  PERFORM app.require_permission('user.manage');
  SELECT * INTO u FROM public.users WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  IF p_version IS NOT NULL AND u.version <> p_version THEN
    PERFORM app.raise_wf('WF-CONFLICT-VERSION', 'Người dùng vừa được người khác sửa. Hãy tải lại.');
  END IF;
  IF p_email IS NOT NULL AND p_email::citext <> u.email AND EXISTS (SELECT 1 FROM public.users WHERE email = p_email::citext) THEN
    PERFORM app.raise_wf('WF-USER-EMAIL-DUPLICATE', 'Email này đã được dùng cho tài khoản khác.');
  END IF;
  UPDATE public.users SET
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    phone = CASE WHEN p_phone IS NULL THEN phone ELSE nullif(btrim(p_phone), '') END,
    email = coalesce(p_email::citext, email),
    email_verified_at = CASE WHEN p_email IS NOT NULL AND p_email::citext <> u.email THEN NULL ELSE email_verified_at END
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id);
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_user_status(p_id uuid, p_status text, p_reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_reason text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF p_status NOT IN ('active','disabled') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Trạng thái không hợp lệ.'); END IF;
  v_reason := app.require_reason(p_reason);
  UPDATE public.users SET status = p_status, locked_until = NULL, failed_login_count = 0 WHERE id = p_id;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  IF p_status = 'disabled' THEN
    UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'user_disabled' WHERE user_id = p_id AND revoked_at IS NULL;
  END IF;
  PERFORM app.fn_audit_event('user.status', 'users', p_id::text, NULL, jsonb_build_object('status', p_status), v_reason, 'high');
  -- tg_ensure_owner (deferred) chặn khóa owner cuối
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

CREATE OR REPLACE FUNCTION app.fn_assign_roles(p_id uuid, p_roles text[], p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_before jsonb; v_missing text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  IF coalesce(array_length(p_roles, 1), 0) = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Người dùng phải có ít nhất một vai trò.'); END IF;
  SELECT string_agg(x, ', ') INTO v_missing FROM unnest(p_roles) x WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = x AND is_active);
  IF v_missing IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Vai trò không hợp lệ: ' || v_missing); END IF;
  SELECT coalesce(jsonb_agg(r.code ORDER BY r.code), '[]') INTO v_before FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_id;
  DELETE FROM public.user_roles ur USING public.roles r WHERE ur.user_id = p_id AND r.id = ur.role_id AND NOT (r.code = ANY(p_roles));
  INSERT INTO public.user_roles (user_id, role_id) SELECT p_id, id FROM public.roles WHERE code = ANY(p_roles) ON CONFLICT DO NOTHING;
  PERFORM app.fn_audit_event('user.roles_set', 'users', p_id::text, v_before, to_jsonb(p_roles), p_reason, 'high');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

-- Đặt lại mật khẩu tạm (băm ở tầng ứng dụng); buộc đổi lần đầu; thu hồi mọi phiên
CREATE OR REPLACE FUNCTION app.fn_reset_password(p_id uuid, p_password_hash text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('user.manage');
  UPDATE public.users SET password_hash = p_password_hash, must_change_password = true, failed_login_count = 0, locked_until = NULL,
    status = CASE WHEN status = 'locked' THEN 'active' ELSE status END
  WHERE id = p_id;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'password_reset' WHERE user_id = p_id AND revoked_at IS NULL;
  PERFORM app.fn_audit_event('user.password_reset', 'users', p_id::text, NULL, NULL, NULL, 'high');
END $$;

CREATE OR REPLACE FUNCTION app.fn_upsert_role(p_id uuid, p_code text, p_name_vi text, p_description text, p_max_discount numeric, p_is_active boolean) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid; r record;
BEGIN
  PERFORM app.require_permission('role.manage');
  IF p_id IS NULL THEN
    INSERT INTO public.roles (code, name_vi, description, max_discount_pct, is_active)
    VALUES (p_code, p_name_vi, p_description, coalesce(p_max_discount, 0), coalesce(p_is_active, true)) RETURNING id INTO v_id;
    PERFORM app.fn_audit_event('role.created', 'roles', v_id::text, NULL, jsonb_build_object('code', p_code), NULL, 'high');
  ELSE
    SELECT * INTO r FROM public.roles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy vai trò.'); END IF;
    IF r.code = 'owner' AND p_is_active = false THEN PERFORM app.raise_wf('WF-SEC-LAST-OWNER', 'Không được tắt vai trò chủ cửa hàng.'); END IF;
    UPDATE public.roles SET name_vi = coalesce(p_name_vi, name_vi), description = coalesce(p_description, description),
      max_discount_pct = coalesce(p_max_discount, max_discount_pct), is_active = coalesce(p_is_active, is_active), updated_by = app.current_user_id()
    WHERE id = p_id;
    v_id := p_id;
    PERFORM app.fn_audit_event('role.updated', 'roles', v_id::text, to_jsonb(r) - 'search_text',
      jsonb_build_object('name_vi', p_name_vi, 'max_discount_pct', p_max_discount, 'is_active', p_is_active), NULL, 'high');
  END IF;
  RETURN v_id;
END $$;

-- Đặt quyền cho vai trò. Vai trò owner luôn giữ user.manage + role.manage (chống tự khóa — CQ-002)
CREATE OR REPLACE FUNCTION app.fn_set_role_permissions(p_role uuid, p_perms text[]) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r record; v_before jsonb; v_bad text;
BEGIN
  PERFORM app.require_permission('role.manage');
  SELECT * INTO r FROM public.roles WHERE id = p_role FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy vai trò.'); END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(p_perms) x WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = x);
  IF v_bad IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Quyền không tồn tại: ' || v_bad); END IF;
  IF r.code = 'owner' AND NOT (p_perms @> ARRAY['user.manage','role.manage']) THEN
    PERFORM app.raise_wf('WF-SEC-LAST-OWNER', 'Vai trò chủ cửa hàng phải giữ quyền quản lý người dùng và vai trò.');
  END IF;
  SELECT coalesce(jsonb_agg(permission_code ORDER BY permission_code), '[]') INTO v_before FROM public.role_permissions WHERE role_id = p_role;
  DELETE FROM public.role_permissions WHERE role_id = p_role AND NOT (permission_code = ANY(p_perms));
  INSERT INTO public.role_permissions (role_id, permission_code) SELECT p_role, x FROM unnest(p_perms) x ON CONFLICT DO NOTHING;
  PERFORM app.fn_audit_event('role.permissions_set', 'roles', p_role::text, v_before, to_jsonb(p_perms), NULL, 'high');
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_setting(p_key text, p_value jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_old jsonb;
BEGIN
  PERFORM app.require_permission('settings.manage');
  SELECT value INTO v_old FROM public.settings WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không có khóa cài đặt này.'); END IF;
  UPDATE public.settings SET value = p_value, updated_by = app.current_user_id(), updated_at = now() WHERE key = p_key;
  PERFORM app.fn_audit_event('settings.changed', 'settings', p_key, v_old, p_value, NULL, 'high');
  PERFORM app.fn_emit_event('settings.changed', jsonb_build_object('key', p_key));
END $$;

-- Đánh dấu đã đọc thông báo của chính mình
CREATE OR REPLACE FUNCTION app.fn_mark_notifications_read(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = app.current_user_id() AND read_at IS NULL AND (p_ids IS NULL OR id = ANY(p_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.setting(text,jsonb)','app.setting_int(text,int)',
    'app.fn_audit_event(text,text,text,jsonb,jsonb,text,text)','app.tg_audit()','app.fn_next_number(text,boolean,int)',
    'app.fn_emit_event(text,jsonb)','app.fn_notify_permission(text,text,text,text,text,text)',
    'app.fn_begin_request(uuid,uuid,text,text)','app.fn_create_user(text,text,text,text,text[])',
    'app.fn_update_user(uuid,text,text,text,int)','app.fn_set_user_status(uuid,text,text)','app.fn_assign_roles(uuid,text[],text)',
    'app.fn_reset_password(uuid,text)','app.fn_upsert_role(uuid,text,text,text,numeric,boolean)',
    'app.fn_set_role_permissions(uuid,text[])','app.fn_set_setting(text,jsonb)','app.fn_mark_notifications_read(uuid[])']
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.setting(text,jsonb), app.setting_int(text,int) TO wf_app, wf_auth, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_audit_event(text,text,text,jsonb,jsonb,text,text), app.fn_emit_event(text,jsonb) TO wf_app, wf_auth, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.tg_audit() TO wf_app, wf_auth, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_next_number(text,boolean,int) TO wf_definer, wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_notify_permission(text,text,text,text,text,text) TO wf_definer, wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_begin_request(uuid,uuid,text,text) TO wf_api;
GRANT EXECUTE ON FUNCTION app.fn_create_user(text,text,text,text,text[]), app.fn_update_user(uuid,text,text,text,int),
  app.fn_set_user_status(uuid,text,text), app.fn_assign_roles(uuid,text[],text), app.fn_reset_password(uuid,text),
  app.fn_upsert_role(uuid,text,text,text,numeric,boolean), app.fn_set_role_permissions(uuid,text[]),
  app.fn_set_setting(text,jsonb), app.fn_mark_notifications_read(uuid[]) TO wf_app;

-- ===== GRANT + RLS =====
GRANT SELECT ON public.settings TO wf_app, wf_auth, wf_worker;
DROP POLICY IF EXISTS settings_select ON public.settings;
CREATE POLICY settings_select ON public.settings FOR SELECT TO wf_app USING (app.current_user_id() IS NOT NULL);
DROP POLICY IF EXISTS settings_internal ON public.settings;
CREATE POLICY settings_internal ON public.settings FOR SELECT TO wf_auth, wf_worker USING (true);

GRANT SELECT ON public.audit_logs TO wf_app;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO wf_app USING (app.has_permission('audit.view'));
GRANT INSERT ON public.audit_logs TO wf_auth, wf_worker;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO wf_auth, wf_worker WITH CHECK (true);
GRANT SELECT ON public.audit_logs TO wf_worker;
DROP POLICY IF EXISTS audit_logs_worker ON public.audit_logs;
CREATE POLICY audit_logs_worker ON public.audit_logs FOR SELECT TO wf_worker USING (true);

-- files: đọc theo thực thể (chi tiết bổ sung ở các mốc sau); tải lên qua máy chủ (wf_app INSERT cột hạn chế)
GRANT SELECT ON public.files TO wf_app, wf_worker;
GRANT INSERT (bucket, path, original_name, mime, size_bytes, sha256, width, height, thumb_path, kind, entity_table, entity_id, is_immutable, taken_at, created_by)
  ON public.files TO wf_app;
GRANT UPDATE (is_deleted) ON public.files TO wf_app;
DROP POLICY IF EXISTS files_select ON public.files;
CREATE POLICY files_select ON public.files FOR SELECT TO wf_app USING (
  NOT is_deleted AND (
    created_by = app.current_user_id()
    OR (kind = 'id_document' AND app.has_any_permission(ARRAY['customer.pii.view','purchase.view']))
    OR (kind = 'logo')
    OR (kind IN ('product','condition') AND app.has_any_permission(ARRAY['catalog.view','collab.view_own']))
    OR (kind IN ('intake','evidence') AND app.has_any_permission(ARRAY['repair.view','purchase.view']))
    OR (kind = 'other' AND app.has_permission('catalog.view'))));
DROP POLICY IF EXISTS files_insert ON public.files;
CREATE POLICY files_insert ON public.files FOR INSERT TO wf_app WITH CHECK (created_by = app.current_user_id());
DROP POLICY IF EXISTS files_update ON public.files;
CREATE POLICY files_update ON public.files FOR UPDATE TO wf_app
  USING (NOT is_immutable AND (created_by = app.current_user_id() OR app.has_permission('catalog.manage')))
  WITH CHECK (NOT is_immutable);
DROP POLICY IF EXISTS files_worker ON public.files;
CREATE POLICY files_worker ON public.files FOR SELECT TO wf_worker USING (true);

GRANT SELECT ON public.notifications TO wf_app;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO wf_app USING (user_id = app.current_user_id());
GRANT SELECT, INSERT ON public.notifications TO wf_worker;
DROP POLICY IF EXISTS notifications_worker ON public.notifications;
CREATE POLICY notifications_worker ON public.notifications FOR ALL TO wf_worker USING (true) WITH CHECK (true);

-- domain_events / job_runs / error_events / rate_limit / idempotency / heartbeats: worker & đường nội bộ
GRANT SELECT, INSERT ON public.domain_events TO wf_worker;
GRANT UPDATE (processed_at, attempts, last_error, available_at) ON public.domain_events TO wf_worker;
DROP POLICY IF EXISTS domain_events_worker ON public.domain_events;
CREATE POLICY domain_events_worker ON public.domain_events FOR ALL TO wf_worker USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON public.job_runs TO wf_worker;
GRANT UPDATE (finished_at, status, note) ON public.job_runs TO wf_worker;
DROP POLICY IF EXISTS job_runs_worker ON public.job_runs;
CREATE POLICY job_runs_worker ON public.job_runs FOR ALL TO wf_worker USING (true) WITH CHECK (true);
GRANT SELECT ON public.job_runs TO wf_app;
DROP POLICY IF EXISTS job_runs_select ON public.job_runs;
CREATE POLICY job_runs_select ON public.job_runs FOR SELECT TO wf_app USING (app.has_permission('system.health'));

GRANT SELECT, INSERT ON public.error_events TO wf_worker;
GRANT UPDATE (count, last_seen, request_id, message, code) ON public.error_events TO wf_worker;
DROP POLICY IF EXISTS error_events_worker ON public.error_events;
CREATE POLICY error_events_worker ON public.error_events FOR ALL TO wf_worker USING (true) WITH CHECK (true);
GRANT SELECT ON public.error_events TO wf_app;
DROP POLICY IF EXISTS error_events_select ON public.error_events;
CREATE POLICY error_events_select ON public.error_events FOR SELECT TO wf_app USING (app.has_permission('system.health'));

GRANT SELECT, INSERT, DELETE ON public.rate_limit_hits TO wf_worker;
GRANT UPDATE (count) ON public.rate_limit_hits TO wf_worker;
DROP POLICY IF EXISTS rate_limit_worker ON public.rate_limit_hits;
CREATE POLICY rate_limit_worker ON public.rate_limit_hits FOR ALL TO wf_worker USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON public.idempotency_keys TO wf_app;
GRANT UPDATE (response, status_code) ON public.idempotency_keys TO wf_app;
DROP POLICY IF EXISTS idempotency_own ON public.idempotency_keys;
CREATE POLICY idempotency_own ON public.idempotency_keys FOR ALL TO wf_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
GRANT SELECT, DELETE ON public.idempotency_keys TO wf_worker;
DROP POLICY IF EXISTS idempotency_worker ON public.idempotency_keys;
CREATE POLICY idempotency_worker ON public.idempotency_keys FOR ALL TO wf_worker USING (true);

GRANT SELECT, INSERT ON public.ops_heartbeats TO wf_worker;
DROP POLICY IF EXISTS ops_heartbeats_worker ON public.ops_heartbeats;
CREATE POLICY ops_heartbeats_worker ON public.ops_heartbeats FOR ALL TO wf_worker USING (true) WITH CHECK (true);
GRANT SELECT ON public.ops_heartbeats TO wf_app;
DROP POLICY IF EXISTS ops_heartbeats_select ON public.ops_heartbeats;
CREATE POLICY ops_heartbeats_select ON public.ops_heartbeats FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['system.health','system.backup']));

GRANT SELECT ON public.number_sequences TO wf_worker;
DROP POLICY IF EXISTS number_sequences_worker ON public.number_sequences;
CREATE POLICY number_sequences_worker ON public.number_sequences FOR SELECT TO wf_worker USING (true);

-- Sao lưu: chỉ đọc mọi bảng
GRANT SELECT ON ALL TABLES IN SCHEMA public TO wf_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE wf_owner IN SCHEMA public GRANT SELECT ON TABLES TO wf_backup;

-- ===== Trigger audit cho bảng IAM/nền =====
DROP TRIGGER IF EXISTS trg_users__audit ON public.users;
CREATE TRIGGER trg_users__audit AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION app.tg_audit('last_login_at','failed_login_count','locked_until');
DROP TRIGGER IF EXISTS trg_roles__audit ON public.roles;
CREATE TRIGGER trg_roles__audit AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.tg_audit();
DROP TRIGGER IF EXISTS trg_user_mfa__audit ON public.user_mfa;
CREATE TRIGGER trg_user_mfa__audit AFTER INSERT OR UPDATE OR DELETE ON public.user_mfa
  FOR EACH ROW EXECUTE FUNCTION app.tg_audit('last_used_step');
DROP TRIGGER IF EXISTS trg_files__audit ON public.files;
CREATE TRIGGER trg_files__audit AFTER INSERT OR UPDATE OR DELETE ON public.files FOR EACH ROW EXECUTE FUNCTION app.tg_audit();

-- ===== Seed cài đặt (settings-catalog) — không ghi đè giá trị đã chỉnh =====
INSERT INTO public.settings (key, value, description) VALUES
  ('store.name', '"Cửa hàng đồng hồ"', 'Tên cửa hàng'),
  ('store.address', '""', 'Địa chỉ in trên phiếu'),
  ('store.phone', '""', 'Điện thoại in trên phiếu'),
  ('store.tax_code', '""', 'Mã số thuế'),
  ('store.logo_file_id', 'null', 'Logo in trên phiếu'),
  ('store.receipt_footer', '"Cảm ơn quý khách!"', 'Chân phiếu bán'),
  ('store.warranty_terms', '"Bảo hành máy theo thời hạn ghi trên phiếu. Không bảo hành do va đập, vào nước, tự ý tháo máy."', 'Điều khoản bảo hành'),
  ('store.repair_terms', '"Quá 30 ngày kể từ ngày hẹn trả, cửa hàng không chịu trách nhiệm về máy."', 'Điều khoản nhận sửa chữa'),
  ('sales.void_window_hours', '24', 'Cửa sổ hủy phiếu bán (giờ)'),
  ('sales.allow_walkin_debt', 'false', 'Cho phép nợ với khách vãng lai'),
  ('sales.default_due_days', '7', 'Hạn hẹn trả mặc định (ngày)'),
  ('reservation.hold_days', '7', 'Hạn giữ hàng mặc định (ngày)'),
  ('reservation.min_deposit_pct', '10', 'Cọc tối thiểu (% giá niêm yết)'),
  ('reservation.max_hold_days', '30', 'Trần hạn giữ (ngày)'),
  ('doc.max_backdate_days', '7', 'Số ngày ghi lùi chứng từ tối đa'),
  ('warranty.shop_months.new', '12', 'Bảo hành hàng mới (tháng)'),
  ('warranty.shop_months.used', '3', 'Bảo hành hàng cũ (tháng)'),
  ('warranty.shop_months.refurbished', '3', 'Bảo hành hàng đã sửa/làm mới (tháng)'),
  ('warranty.repair_days', '90', 'Bảo hành sau sửa chữa (ngày)'),
  ('warranty.expiry_alert_days', '14', 'Nhắc trước khi hết hạn bảo hành (ngày)'),
  ('collab.hold_alert_days', '30', 'Cảnh báo chiếc ở CTV quá N ngày'),
  ('collab.warn_below_cost', 'true', 'Cảnh báo giá thu giao CTV dưới giá vốn'),
  ('inventory.aging_days', '90', 'Ngưỡng tồn lâu (ngày)'),
  ('purchase.require_seller_id', 'true', 'Bắt buộc giấy tờ người bán khi thu mua'),
  ('unit.require_photo_on_buyback', 'true', 'Bắt buộc ảnh máy khi thu mua'),
  ('purchase.default_cost_allocation', '"by_value"', 'Cách phân bổ chi phí mặc định'),
  ('unit.search_min_chars', '2', 'Số ký tự tối thiểu để tìm'),
  ('repair.require_quote_approval', 'false', 'Bắt buộc khách đồng ý báo giá trước khi sửa'),
  ('repair.require_intake_photo', 'false', 'Bắt buộc ảnh hiện trạng khi nhận máy'),
  ('repair.pickup_alert_days', '14', 'Nhắc máy hoàn thành chưa lấy (ngày)'),
  ('repair.allow_delivery_with_debt', 'true', 'Cho phép giao máy ghi nợ'),
  ('security.access_token_ttl_seconds', '900', 'Thời hạn access token (giây)'),
  ('security.refresh_token_ttl_days', '30', 'Thời hạn refresh token (ngày)'),
  ('security.max_failed_logins', '5', 'Số lần sai trước khi khóa tạm'),
  ('security.lockout_minutes', '15', 'Thời gian khóa tạm (phút)'),
  ('security.mfa_required_roles', '["owner"]', 'Vai trò bắt buộc xác thực 2 bước'),
  ('security.password_min_length', '10', 'Độ dài mật khẩu tối thiểu'),
  ('security.pii_reveal_requires_reason', 'true', 'Xem CCCD phải nêu lý do'),
  ('backup.heartbeat_max_hours', '36', 'Cảnh báo khi sao lưu cũ hơn N giờ'),
  ('ui.disabled_modules', '[]', 'Module tạm ẩn'),
  ('feature.ai.enabled', 'false', 'Bật tính năng AI'),
  ('notifications.enabled_types', '["*"]', 'Loại thông báo đang bật')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

COMMIT;
