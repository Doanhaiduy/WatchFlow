-- 0013_hardening_iam.sql — Kiểm định M9 (đối chiếu Lưu Xá F-040/F-058, D-005):
-- (1) Chặn chiếm quyền chủ: người có user.manage/role.manage nhưng KHÔNG phải owner không được đụng tới tài khoản/vai trò owner,
--     không tự đổi vai trò/khóa/đặt lại mật khẩu của chính mình, không sửa vai trò mình đang giữ.
-- (2) Phiên có hạn tuyệt đối auth_sessions.expires_at (kiểm ở fn_begin_request và refresh).
-- (3) Đổi cài đặt security.* cần owner; security.mfa_required_roles luôn chứa 'owner'.
-- (4) Thu EXECUTE hàm pgcrypto khỏi PUBLIC (wf_app không gọi trực tiếp).
-- BR-SEC-04/07, CQ-015. Idempotent.
BEGIN;

CREATE OR REPLACE FUNCTION app.is_owner(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_user AND r.code = 'owner')
$$;
ALTER FUNCTION app.is_owner(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.is_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_owner(uuid) TO wf_app, wf_definer, wf_auth;

-- Chặn người không phải owner đụng tới tài khoản owner; chặn tự thao tác nhạy cảm trên chính mình
CREATE OR REPLACE FUNCTION app.guard_user_target(p_target uuid, p_self_forbidden boolean) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF p_self_forbidden AND p_target = app.current_user_id() THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Không tự thao tác việc này trên tài khoản của chính mình (nhờ chủ cửa hàng khác hoặc dùng "Đổi mật khẩu").');
  END IF;
  IF app.is_owner(p_target) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới thao tác trên tài khoản chủ cửa hàng.');
  END IF;
END $$;
ALTER FUNCTION app.guard_user_target(uuid, boolean) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.guard_user_target(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guard_user_target(uuid, boolean) TO wf_definer;

CREATE OR REPLACE FUNCTION app.fn_create_user(p_email text, p_full_name text, p_phone text, p_password_hash text, p_roles text[]) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid; v_missing text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF 'owner' = ANY(p_roles) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới tạo được tài khoản chủ cửa hàng.');
  END IF;
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
  PERFORM app.guard_user_target(p_id, false);
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
  IF p_email IS NOT NULL AND p_email::citext <> u.email THEN
    PERFORM app.fn_audit_event('user.email_changed', 'users', p_id::text, NULL, NULL, NULL, 'high');
  END IF;
  RETURN jsonb_build_object('id', p_id);
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_user_status(p_id uuid, p_status text, p_reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_reason text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF p_status NOT IN ('active','disabled') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Trạng thái không hợp lệ.'); END IF;
  v_reason := app.require_reason(p_reason);
  PERFORM app.guard_user_target(p_id, true);
  UPDATE public.users SET status = p_status, locked_until = NULL, failed_login_count = 0 WHERE id = p_id;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  IF p_status = 'disabled' THEN
    UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'user_disabled' WHERE user_id = p_id AND revoked_at IS NULL;
  END IF;
  PERFORM app.fn_audit_event('user.status', 'users', p_id::text, NULL, jsonb_build_object('status', p_status), v_reason, 'high');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

CREATE OR REPLACE FUNCTION app.fn_assign_roles(p_id uuid, p_roles text[], p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_before jsonb; v_missing text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  -- Không tự đổi vai trò mình; chỉ owner mới gán/bỏ vai trò owner hoặc đụng tài khoản owner
  IF p_id = app.current_user_id() THEN
    PERFORM app.raise_wf(CASE WHEN app.is_owner(p_id) AND NOT ('owner' = ANY(p_roles)) THEN 'WF-SEC-LAST-OWNER' ELSE 'WF-AUTH-FORBIDDEN' END,
      'Không tự đổi vai trò của chính mình — nhờ chủ cửa hàng khác.');
  END IF;
  PERFORM app.guard_user_target(p_id, false);
  IF 'owner' = ANY(p_roles) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới gán được vai trò chủ cửa hàng.');
  END IF;
  IF coalesce(array_length(p_roles, 1), 0) = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Người dùng phải có ít nhất một vai trò.'); END IF;
  SELECT string_agg(x, ', ') INTO v_missing FROM unnest(p_roles) x WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = x AND is_active);
  IF v_missing IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Vai trò không hợp lệ: ' || v_missing); END IF;
  SELECT coalesce(jsonb_agg(r.code ORDER BY r.code), '[]') INTO v_before FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_id;
  DELETE FROM public.user_roles ur USING public.roles r WHERE ur.user_id = p_id AND r.id = ur.role_id AND NOT (r.code = ANY(p_roles));
  INSERT INTO public.user_roles (user_id, role_id) SELECT p_id, id FROM public.roles WHERE code = ANY(p_roles) ON CONFLICT DO NOTHING;
  PERFORM app.fn_audit_event('user.roles_set', 'users', p_id::text, v_before, to_jsonb(p_roles), p_reason, 'high');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

CREATE OR REPLACE FUNCTION app.fn_reset_password(p_id uuid, p_password_hash text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('user.manage');
  PERFORM app.guard_user_target(p_id, true);
  UPDATE public.users SET password_hash = p_password_hash, must_change_password = true, failed_login_count = 0, locked_until = NULL,
    status = CASE WHEN status = 'locked' THEN 'active' ELSE status END
  WHERE id = p_id;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'password_reset' WHERE user_id = p_id AND revoked_at IS NULL;
  PERFORM app.fn_audit_event('user.password_reset', 'users', p_id::text, NULL, NULL, NULL, 'high');
END $$;

-- Vai trò: chỉ owner sửa vai trò owner hoặc vai trò chính mình đang giữ (chống tự nâng quyền)
CREATE OR REPLACE FUNCTION app.guard_role_target(p_role uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF app.is_owner(app.current_user_id()) THEN RETURN; END IF;
  IF (SELECT code FROM public.roles WHERE id = p_role) = 'owner'
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = app.current_user_id() AND role_id = p_role) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới sửa vai trò chủ hoặc vai trò bạn đang giữ.');
  END IF;
END $$;
ALTER FUNCTION app.guard_role_target(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.guard_role_target(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guard_role_target(uuid) TO wf_definer;

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
    PERFORM app.guard_role_target(p_id);
    SELECT * INTO r FROM public.roles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy vai trò.'); END IF;
    IF r.code = 'owner' AND p_is_active = false THEN PERFORM app.raise_wf('WF-SEC-LAST-OWNER', 'Không được tắt vai trò chủ cửa hàng.'); END IF;
    UPDATE public.roles SET name_vi = coalesce(p_name_vi, name_vi), description = coalesce(p_description, description),
      max_discount_pct = coalesce(p_max_discount, max_discount_pct), is_active = coalesce(p_is_active, is_active), updated_by = app.current_user_id()
    WHERE id = p_id;
    v_id := p_id;
    PERFORM app.fn_audit_event('role.updated', 'roles', v_id::text, to_jsonb(r),
      jsonb_build_object('name_vi', p_name_vi, 'max_discount_pct', p_max_discount, 'is_active', p_is_active), NULL, 'high');
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_role_permissions(p_role uuid, p_perms text[]) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r record; v_before jsonb; v_bad text;
BEGIN
  PERFORM app.require_permission('role.manage');
  PERFORM app.guard_role_target(p_role);
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

-- Cài đặt security.* chỉ owner; mfa_required_roles luôn chứa owner
CREATE OR REPLACE FUNCTION app.fn_set_setting(p_key text, p_value jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_old jsonb;
BEGIN
  PERFORM app.require_permission('settings.manage');
  IF p_key LIKE 'security.%' AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới sửa cài đặt bảo mật.');
  END IF;
  IF p_key = 'security.mfa_required_roles' AND NOT (p_value ? 'owner') THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Vai trò chủ cửa hàng luôn bắt buộc xác thực 2 bước.');
  END IF;
  SELECT value INTO v_old FROM public.settings WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không có khóa cài đặt này.'); END IF;
  UPDATE public.settings SET value = p_value, updated_by = app.current_user_id(), updated_at = now() WHERE key = p_key;
  PERFORM app.fn_audit_event('settings.changed', 'settings', p_key, v_old, p_value, NULL, 'high');
  PERFORM app.fn_emit_event('settings.changed', jsonb_build_object('key', p_key));
END $$;

-- ===== Phiên có hạn tuyệt đối =====
ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');
GRANT UPDATE (expires_at) ON public.auth_sessions TO wf_auth;

CREATE OR REPLACE FUNCTION app.fn_begin_request(p_user uuid, p_session uuid, p_request_id text, p_ip_hash text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u record; s record; mfa_roles jsonb; mfa_required boolean;
BEGIN
  SELECT id, email::text AS email, full_name, status, must_change_password, mfa_enabled, locked_until INTO u FROM public.users WHERE id = p_user;
  IF NOT FOUND OR u.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'user'); END IF;
  SELECT id, revoked_at, mfa_at, reauth_at, expires_at INTO s FROM public.auth_sessions WHERE id = p_session AND user_id = p_user;
  IF NOT FOUND OR s.revoked_at IS NOT NULL OR s.expires_at <= now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'session'); END IF;
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

-- ===== Sở hữu / EXECUTE =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.fn_create_user(text,text,text,text,text[])','app.fn_update_user(uuid,text,text,text,int)','app.fn_set_user_status(uuid,text,text)',
    'app.fn_assign_roles(uuid,text[],text)','app.fn_reset_password(uuid,text)','app.fn_upsert_role(uuid,text,text,text,numeric,boolean)',
    'app.fn_set_role_permissions(uuid,text[])','app.fn_set_setting(text,jsonb)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_app', f);
  END LOOP;
END $$;
ALTER FUNCTION app.fn_begin_request(uuid,uuid,text,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_begin_request(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_begin_request(uuid,uuid,text,text) TO wf_api;

-- ===== pgcrypto: thu EXECUTE khỏi PUBLIC (D-005) =====
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS f FROM pg_proc p JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
           JOIN pg_extension e ON e.oid = d.refobjid WHERE e.extname = 'pgcrypto' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_owner, wf_definer', r.f);
  END LOOP;
END $$;

COMMIT;
