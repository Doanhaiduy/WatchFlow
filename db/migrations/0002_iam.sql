-- 0002_iam.sql — Người dùng, vai trò, quyền, phiên, MFA; app.has_permission; seed 4 vai trò mặc định.
-- BR-SEC-01/04/06/07, security-model §2–§5, §7. Idempotent, một transaction.
BEGIN;

-- ===== Bảng =====
CREATE TABLE IF NOT EXISTS public.users (
  id                   uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  email                citext NOT NULL UNIQUE,
  phone                text,
  full_name            text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  password_hash        text NOT NULL,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  mfa_enabled          boolean NOT NULL DEFAULT false,
  failed_login_count   integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until         timestamptz,
  last_login_at        timestamptz,
  password_changed_at  timestamptz,
  email_verified_at    timestamptz,
  search_text          text,
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_users_created_by ON public.users (created_by);
CREATE INDEX IF NOT EXISTS ix_users_updated_by ON public.users (updated_by);
CREATE INDEX IF NOT EXISTS ix_users_search ON public.users USING gin (search_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.roles (
  id               uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name_vi          text NOT NULL,
  description      text,
  is_system        boolean NOT NULL DEFAULT false,
  max_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_pct BETWEEN 0 AND 100),
  is_active        boolean NOT NULL DEFAULT true,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_roles_updated_by ON public.roles (updated_by);

CREATE TABLE IF NOT EXISTS public.permissions (
  code         text PRIMARY KEY CHECK (code ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module       text NOT NULL,
  name_vi      text NOT NULL,
  description  text,
  is_sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id         uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);
CREATE INDEX IF NOT EXISTS ix_role_permissions_perm ON public.role_permissions (permission_code);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role_id    uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS ix_user_roles_role ON public.user_roles (role_id);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  mfa_at       timestamptz,          -- thời điểm đã qua TOTP trong phiên
  reauth_at    timestamptz,          -- xác thực lại gần nhất (thao tác nhạy cảm ≤ 5 phút)
  revoked_at   timestamptz,
  revoke_reason text,
  user_agent   text,
  ip_hash      text
);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON public.auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  session_id        uuid NOT NULL REFERENCES public.auth_sessions(id) ON DELETE CASCADE,
  token_hash        text NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  rotated_at        timestamptz,
  replaced_by       uuid REFERENCES public.refresh_tokens(id) ON DELETE SET NULL,
  reuse_detected_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_session ON public.refresh_tokens (session_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_replaced_by ON public.refresh_tokens (replaced_by);

CREATE TABLE IF NOT EXISTS public.user_mfa (
  user_id             uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  totp_secret_enc     text NOT NULL,
  enabled_at          timestamptz,
  recovery_codes_hash text[] NOT NULL DEFAULT '{}',
  last_used_step      bigint,          -- chống dùng lại cùng mã TOTP
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ===== Sở hữu, RLS, GRANT =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','roles','permissions','role_permissions','user_roles','auth_sessions','refresh_tokens','user_mfa'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
  END LOOP;
END $$;

-- ===== app.has_permission (hợp quyền các vai trò; cache trong transaction) =====
CREATE OR REPLACE FUNCTION app.user_permissions(p_user uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT rp.permission_code ORDER BY rp.permission_code), '{}')
  FROM public.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  JOIN public.roles r ON r.id = ur.role_id AND r.is_active
  JOIN public.role_permissions rp ON rp.role_id = r.id
  WHERE u.id = p_user AND u.status = 'active'
$$;

CREATE OR REPLACE FUNCTION app.has_permission(p_code text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE uid uuid := app.current_user_id(); cached text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF current_setting('app.perm_uid', true) IS DISTINCT FROM uid::text THEN
    PERFORM set_config('app.perms', ',' || array_to_string(app.user_permissions(uid), ',') || ',', true);
    PERFORM set_config('app.perm_uid', uid::text, true);
  END IF;
  cached := current_setting('app.perms', true);
  RETURN position(',' || p_code || ',' IN coalesce(cached, '')) > 0;
END $$;

-- Có ít nhất một trong các quyền
CREATE OR REPLACE FUNCTION app.has_any_permission(p_codes text[]) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY p_codes LOOP IF app.has_permission(c) THEN RETURN true; END IF; END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION app.require_permission(p_code text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF NOT app.has_permission(p_code) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.', jsonb_build_object('perm', p_code));
  END IF;
END $$;

ALTER FUNCTION app.user_permissions(uuid) OWNER TO wf_definer;
ALTER FUNCTION app.has_permission(text) OWNER TO wf_definer;
ALTER FUNCTION app.has_any_permission(text[]) OWNER TO wf_definer;
ALTER FUNCTION app.require_permission(text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.user_permissions(uuid), app.has_permission(text), app.has_any_permission(text[]), app.require_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.has_permission(text), app.has_any_permission(text[]), app.require_permission(text) TO wf_app, wf_auth, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.user_permissions(uuid) TO wf_auth, wf_worker, wf_definer;

-- ===== GRANT + chính sách =====
-- users: tự đọc; user.manage đọc tất cả; ghi chỉ qua fn_* (wf_app không INSERT/UPDATE trực tiếp)
GRANT SELECT (id, email, phone, full_name, status, must_change_password, mfa_enabled, last_login_at, email_verified_at, created_at, updated_at, version)
  ON public.users TO wf_app;
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO wf_app
  USING (id = app.current_user_id() OR app.has_permission('user.manage'));
-- wf_auth: đăng nhập / đổi mật khẩu / MFA
GRANT SELECT ON public.users TO wf_auth;
GRANT UPDATE (password_hash, must_change_password, mfa_enabled, failed_login_count, locked_until, last_login_at, password_changed_at, status)
  ON public.users TO wf_auth;
DROP POLICY IF EXISTS users_auth ON public.users;
CREATE POLICY users_auth ON public.users FOR ALL TO wf_auth USING (true) WITH CHECK (true);

-- roles / permissions / role_permissions: mọi người đã đăng nhập đọc (hiển thị); ghi qua fn_* (role.manage)
GRANT SELECT ON public.roles, public.permissions, public.role_permissions TO wf_app, wf_auth;
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO wf_app, wf_auth USING (app.current_user_id() IS NOT NULL OR current_user = 'wf_auth');
DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO wf_app, wf_auth USING (app.current_user_id() IS NOT NULL OR current_user = 'wf_auth');
DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO wf_app, wf_auth USING (app.current_user_id() IS NOT NULL OR current_user = 'wf_auth');

-- user_roles: tự đọc vai trò mình; user.manage đọc tất cả
GRANT SELECT ON public.user_roles TO wf_app, wf_auth;
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO wf_app
  USING (user_id = app.current_user_id() OR app.has_permission('user.manage'));
DROP POLICY IF EXISTS user_roles_auth ON public.user_roles;
CREATE POLICY user_roles_auth ON public.user_roles FOR SELECT TO wf_auth USING (true);

-- auth_sessions: wf_auth toàn quyền nghiệp vụ phiên; wf_app đọc phiên của mình
GRANT SELECT, INSERT ON public.auth_sessions TO wf_auth;
GRANT UPDATE (last_seen_at, mfa_at, reauth_at, revoked_at, revoke_reason) ON public.auth_sessions TO wf_auth;
DROP POLICY IF EXISTS auth_sessions_auth ON public.auth_sessions;
CREATE POLICY auth_sessions_auth ON public.auth_sessions FOR ALL TO wf_auth USING (true) WITH CHECK (true);
GRANT SELECT (id, user_id, created_at, last_seen_at, revoked_at, user_agent) ON public.auth_sessions TO wf_app;
DROP POLICY IF EXISTS auth_sessions_select ON public.auth_sessions;
CREATE POLICY auth_sessions_select ON public.auth_sessions FOR SELECT TO wf_app USING (user_id = app.current_user_id());

GRANT SELECT, INSERT ON public.refresh_tokens TO wf_auth;
GRANT UPDATE (rotated_at, replaced_by, reuse_detected_at) ON public.refresh_tokens TO wf_auth;
DROP POLICY IF EXISTS refresh_tokens_auth ON public.refresh_tokens;
CREATE POLICY refresh_tokens_auth ON public.refresh_tokens FOR ALL TO wf_auth USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON public.user_mfa TO wf_auth;
GRANT UPDATE (totp_secret_enc, enabled_at, recovery_codes_hash, last_used_step) ON public.user_mfa TO wf_auth;
DROP POLICY IF EXISTS user_mfa_auth ON public.user_mfa;
CREATE POLICY user_mfa_auth ON public.user_mfa FOR ALL TO wf_auth USING (true) WITH CHECK (true);

-- Worker đọc để gửi thông báo / dọn dẹp
GRANT SELECT ON public.users, public.roles, public.user_roles, public.role_permissions, public.permissions TO wf_worker;
GRANT SELECT, DELETE ON public.refresh_tokens TO wf_worker;
GRANT SELECT ON public.auth_sessions TO wf_worker;

-- ===== Trigger =====
DROP TRIGGER IF EXISTS trg_users__updated_at ON public.users;
CREATE TRIGGER trg_users__updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();
DROP TRIGGER IF EXISTS trg_users__search ON public.users;
CREATE TRIGGER trg_users__search BEFORE INSERT OR UPDATE OF full_name, email, phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION app.tg_search_text('full_name', 'email', 'phone');
DROP TRIGGER IF EXISTS trg_roles__updated_at ON public.roles;
CREATE TRIGGER trg_roles__updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at();

-- Luôn còn ≥ 1 owner hoạt động (B11, BR-SEC-07)
CREATE OR REPLACE FUNCTION app.tg_ensure_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM public.users u JOIN public.user_roles ur ON ur.user_id = u.id JOIN public.roles r ON r.id = ur.role_id
  WHERE r.code = 'owner' AND u.status = 'active';
  IF n = 0 AND EXISTS (SELECT 1 FROM public.roles WHERE code = 'owner')
     AND EXISTS (SELECT 1 FROM public.users) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = jsonb_build_object('code','WF-SEC-LAST-OWNER','vi','Phải luôn còn ít nhất một chủ cửa hàng đang hoạt động.')::text;
  END IF;
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_ensure_owner() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_ensure_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_user_roles__ensure_owner ON public.user_roles;
CREATE CONSTRAINT TRIGGER trg_user_roles__ensure_owner AFTER DELETE OR UPDATE ON public.user_roles
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.tg_ensure_owner();
DROP TRIGGER IF EXISTS trg_users__ensure_owner ON public.users;
CREATE CONSTRAINT TRIGGER trg_users__ensure_owner AFTER UPDATE OF status OR DELETE ON public.users
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.tg_ensure_owner();

-- ===== Seed quyền (security-model §3) =====
INSERT INTO public.permissions (code, module, name_vi, is_sensitive) VALUES
  ('user.manage','iam','Quản lý người dùng',true),
  ('role.manage','iam','Quản lý vai trò & quyền',true),
  ('settings.view','platform','Xem cài đặt',false),
  ('settings.manage','platform','Sửa cài đặt',true),
  ('audit.view','platform','Xem nhật ký hoạt động',true),
  ('system.health','platform','Xem tình trạng hệ thống',false),
  ('system.backup','platform','Xem trạng thái sao lưu',false),
  ('doc.backdate','platform','Ghi lùi ngày chứng từ quá hạn mức',true),
  ('catalog.view','catalog','Xem đồng hồ',false),
  ('catalog.manage','catalog','Quản lý danh mục & chiếc',false),
  ('unit.price.edit','catalog','Sửa giá bán',false),
  ('unit.release','catalog','Chuyển chờ kiểm tra → sẵn sàng bán',false),
  ('location.manage','catalog','Quản lý vị trí kho',false),
  ('part.view','parts','Xem linh kiện',false),
  ('part.manage','parts','Quản lý linh kiện',false),
  ('part.stock.adjust','parts','Điều chỉnh tồn linh kiện',false),
  ('customer.view','partners','Xem mọi khách hàng',false),
  ('customer.view_own','partners','Xem khách do mình tạo',false),
  ('customer.create','partners','Tạo khách hàng',false),
  ('customer.manage','partners','Sửa khách hàng',false),
  ('customer.pii.view','partners','Xem CCCD đầy đủ',true),
  ('cost.view','cost','Xem giá vốn (giá thu của cửa hàng)',true),
  ('cost.adjust','cost','Điều chỉnh giá vốn',true),
  ('profit.view','cost','Xem lợi nhuận',true),
  ('debt.view','cost','Xem phiếu còn nợ',false),
  ('purchase.view','purchasing','Xem phiếu nhập',false),
  ('purchase.create','purchasing','Lập phiếu nhập nháp',false),
  ('purchase.confirm','purchasing','Xác nhận phiếu nhập',false),
  ('purchase.void','purchasing','Hủy phiếu nhập',true),
  ('sale.view','sales','Xem mọi phiếu bán',false),
  ('sale.view_own','sales','Xem phiếu bán của mình',false),
  ('sale.create_draft','sales','Lập phiếu bán nháp',false),
  ('sale.confirm','sales','Xác nhận phiếu bán',false),
  ('sale.below_cost','sales','Bán dưới giá vốn',true),
  ('sale.void','sales','Hủy phiếu bán',true),
  ('reservation.manage','sales','Giữ hàng / hoàn cọc',false),
  ('reservation.forfeit','sales','Tịch thu cọc',true),
  ('warranty.view','sales','Tra cứu bảo hành',false),
  ('payment.create','payments','Ghi thanh toán',false),
  ('payment.void','payments','Hủy thanh toán',true),
  ('collab.view','collaborators','Xem cộng tác viên',true),
  ('collab.manage','collaborators','Quản lý cộng tác viên',true),
  ('collab.view_own','collaborators','CTV xem dữ liệu của mình',false),
  ('repair.view','repairs','Xem phiếu sửa',false),
  ('repair.create','repairs','Nhận máy sửa',false),
  ('repair.update','repairs','Cập nhật phiếu sửa',false),
  ('repair.price.edit','repairs','Sửa giá dòng sửa chữa',false),
  ('repair.deliver','repairs','Giao máy sửa, thu tiền',false),
  ('stocktake.manage','inventory','Kiểm kê',false),
  ('stock.writeoff','inventory','Thanh lý / ghi mất chiếc',true),
  ('report.sales','reports','Báo cáo bán hàng',false),
  ('report.inventory','reports','Báo cáo kho',false),
  ('report.export','reports','Xuất file báo cáo',false)
ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, name_vi = EXCLUDED.name_vi, is_sensitive = EXCLUDED.is_sensitive;

-- ===== Seed vai trò (security-model §4) =====
INSERT INTO public.roles (code, name_vi, is_system, max_discount_pct) VALUES
  ('owner','Chủ cửa hàng',true,100),
  ('sales','Nhân viên bán hàng',true,5),
  ('warehouse','Quản lý kho',true,0),
  ('collaborator','Cộng tác viên',true,0)
ON CONFLICT (code) DO NOTHING;

-- Ma trận mặc định: chỉ chèn khi vai trò chưa có quyền nào (không ghi đè chỉnh sửa của chủ)
DO $$
DECLARE
  m jsonb := jsonb_build_object(
    'owner', (SELECT jsonb_agg(code) FROM public.permissions WHERE code NOT IN ('sale.view_own','collab.view_own')),
    'sales', jsonb_build_array('catalog.view','part.view','customer.view','customer.view_own','customer.create','customer.manage',
                               'debt.view','sale.view','sale.create_draft','sale.confirm','reservation.manage','warranty.view',
                               'payment.create','report.sales','report.export'),
    'warehouse', jsonb_build_array('catalog.view','catalog.manage','location.manage','unit.release','part.view','part.manage',
                               'part.stock.adjust','cost.view','purchase.view','purchase.create','purchase.confirm',
                               'stocktake.manage','report.inventory','report.export'),
    'collaborator', jsonb_build_array('customer.view_own','customer.create','sale.view_own','sale.create_draft','collab.view_own'));
  r record;
BEGIN
  FOR r IN SELECT id, code FROM public.roles WHERE code IN ('owner','sales','warehouse','collaborator') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = r.id) THEN
      INSERT INTO public.role_permissions (role_id, permission_code)
      SELECT r.id, p FROM jsonb_array_elements_text(m->r.code) p ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

COMMIT;
