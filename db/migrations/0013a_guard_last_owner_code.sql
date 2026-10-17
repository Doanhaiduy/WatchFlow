-- 0013a — Giữ mã lỗi cụ thể PT-10: chủ cuối cùng tự khóa/tự đặt lại ⇒ WF-SEC-LAST-OWNER (thay vì WF-AUTH-FORBIDDEN chung).
BEGIN;
CREATE OR REPLACE FUNCTION app.guard_user_target(p_target uuid, p_self_forbidden boolean) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF p_self_forbidden AND p_target = app.current_user_id() THEN
    IF app.is_owner(p_target) AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id JOIN public.users u ON u.id = ur.user_id
         WHERE r.code = 'owner' AND u.status = 'active' AND u.id <> p_target) THEN
      PERFORM app.raise_wf('WF-SEC-LAST-OWNER', 'Đây là chủ cửa hàng cuối cùng — không được tự khóa hoặc hạ quyền.');
    END IF;
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Không tự thao tác việc này trên tài khoản của chính mình (nhờ chủ cửa hàng khác hoặc dùng "Đổi mật khẩu").');
  END IF;
  IF app.is_owner(p_target) AND NOT app.is_owner(app.current_user_id()) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Chỉ chủ cửa hàng mới thao tác trên tài khoản chủ cửa hàng.');
  END IF;
END $$;
ALTER FUNCTION app.guard_user_target(uuid, boolean) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.guard_user_target(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guard_user_target(uuid, boolean) TO wf_definer;
COMMIT;
