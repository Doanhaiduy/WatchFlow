-- 0013c — Trần cấp quyền (kiểm định M9, /code-review): người không phải owner chỉ cấp được những quyền chính mình đang có —
-- cả khi sửa quyền vai trò lẫn khi gán vai trò cho người dùng (chặn đường "tạo vai trò mới đủ quyền rồi gán cho tài khoản bù nhìn").
-- Kèm: owner tự bỏ vai trò owner chỉ báo WF-SEC-LAST-OWNER khi thật sự là chủ cuối cùng; thu UPDATE(expires_at) thừa của wf_auth;
-- nhật ký không ghi dòng "update sales {print_count}" (đã có sự kiện sale.reprinted). CQ-015. Idempotent.
BEGIN;

-- Quyền mới (p_perms) phải nằm trong quyền của người gọi, trừ owner
CREATE OR REPLACE FUNCTION app.guard_grant_ceiling(p_perms text[]) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_extra text;
BEGIN
  IF app.is_owner(app.current_user_id()) THEN RETURN; END IF;
  SELECT string_agg(DISTINCT x, ', ' ORDER BY x) INTO v_extra
  FROM unnest(coalesce(p_perms, '{}')) x WHERE NOT (x = ANY(app.user_permissions(app.current_user_id())));
  IF v_extra IS NOT NULL THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn chỉ cấp được những quyền mình đang có. Quyền vượt: ' || v_extra || '.');
  END IF;
END $$;
ALTER FUNCTION app.guard_grant_ceiling(text[]) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.guard_grant_ceiling(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guard_grant_ceiling(text[]) TO wf_definer;

-- Quyền gộp của các vai trò sắp gán (chỉ vai trò đang bật)
CREATE OR REPLACE FUNCTION app.role_codes_permissions(p_roles text[]) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT rp.permission_code), '{}')
  FROM public.roles r JOIN public.role_permissions rp ON rp.role_id = r.id
  WHERE r.code = ANY(p_roles) AND r.is_active
$$;
ALTER FUNCTION app.role_codes_permissions(text[]) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.role_codes_permissions(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.role_codes_permissions(text[]) TO wf_definer;

CREATE OR REPLACE FUNCTION app.fn_create_user(p_email text, p_full_name text, p_phone text, p_password_hash text, p_roles text[]) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid; v_missing text;
BEGIN
  PERFORM app.require_permission('user.manage');
  IF 'owner' = ANY(p_roles) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới tạo được tài khoản chủ cửa hàng.');
  END IF;
  PERFORM app.guard_grant_ceiling(app.role_codes_permissions(p_roles));
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

CREATE OR REPLACE FUNCTION app.fn_assign_roles(p_id uuid, p_roles text[], p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_before jsonb; v_missing text; v_added text[];
BEGIN
  PERFORM app.require_permission('user.manage');
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy người dùng.'); END IF;
  -- Không tự đổi vai trò mình (guard_user_target báo WF-SEC-LAST-OWNER nếu là chủ cuối cùng)
  IF p_id = app.current_user_id() THEN PERFORM app.guard_user_target(p_id, true); END IF;
  PERFORM app.guard_user_target(p_id, false);
  IF 'owner' = ANY(p_roles) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới gán được vai trò chủ cửa hàng.');
  END IF;
  IF coalesce(array_length(p_roles, 1), 0) = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Người dùng phải có ít nhất một vai trò.'); END IF;
  SELECT string_agg(x, ', ') INTO v_missing FROM unnest(p_roles) x WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = x AND is_active);
  IF v_missing IS NOT NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Vai trò không hợp lệ: ' || v_missing); END IF;
  -- Vai trò THÊM MỚI phải nằm trong trần quyền của người gọi (bỏ bớt vai trò thì luôn được)
  SELECT coalesce(array_agg(x), '{}') INTO v_added FROM unnest(p_roles) x
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_id AND r.code = x);
  PERFORM app.guard_grant_ceiling(app.role_codes_permissions(v_added));
  SELECT coalesce(jsonb_agg(r.code ORDER BY r.code), '[]') INTO v_before FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = p_id;
  DELETE FROM public.user_roles ur USING public.roles r WHERE ur.user_id = p_id AND r.id = ur.role_id AND NOT (r.code = ANY(p_roles));
  INSERT INTO public.user_roles (user_id, role_id) SELECT p_id, id FROM public.roles WHERE code = ANY(p_roles) ON CONFLICT DO NOTHING;
  PERFORM app.fn_audit_event('user.roles_set', 'users', p_id::text, v_before, to_jsonb(p_roles), p_reason, 'high');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_role_permissions(p_role uuid, p_perms text[]) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE r record; v_before jsonb; v_bad text; v_added text[];
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
  SELECT coalesce(array_agg(x), '{}') INTO v_added FROM unnest(p_perms) x
  WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = p_role AND permission_code = x);
  PERFORM app.guard_grant_ceiling(v_added);
  SELECT coalesce(jsonb_agg(permission_code ORDER BY permission_code), '[]') INTO v_before FROM public.role_permissions WHERE role_id = p_role;
  DELETE FROM public.role_permissions WHERE role_id = p_role AND NOT (permission_code = ANY(p_perms));
  INSERT INTO public.role_permissions (role_id, permission_code) SELECT p_role, x FROM unnest(p_perms) x ON CONFLICT DO NOTHING;
  PERFORM app.fn_audit_event('role.permissions_set', 'roles', p_role::text, v_before, to_jsonb(p_perms), NULL, 'high');
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.fn_create_user(text,text,text,text,text[])','app.fn_assign_roles(uuid,text[],text)','app.fn_set_role_permissions(uuid,text[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_app', f);
  END LOOP;
END $$;

-- Không ai ngoài hàm đăng nhập (INSERT) được kéo dài hạn tuyệt đối của phiên
REVOKE UPDATE (expires_at) ON public.auth_sessions FROM wf_auth;

-- In phiếu: bỏ qua cột print_count trong nhật ký dòng (đã có sự kiện sale.reprinted khi in lại)
DROP TRIGGER IF EXISTS trg_sales__audit ON public.sales;
CREATE TRIGGER trg_sales__audit AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION app.tg_audit('print_count');

COMMIT;
