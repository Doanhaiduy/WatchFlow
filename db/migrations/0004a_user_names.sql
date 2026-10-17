-- 0004a_user_names.sql — Tên hiển thị người dùng cho danh sách/lịch sử (security-model §5: "danh sách nhân viên qua view rút gọn").
-- Chỉ trả họ tên (không email/SĐT); yêu cầu đã đăng nhập. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.user_display_name(p_user uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT full_name FROM public.users WHERE id = p_user AND app.current_user_id() IS NOT NULL
$$;
ALTER FUNCTION app.user_display_name(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.user_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.user_display_name(uuid) TO wf_app, wf_worker;

-- Danh sách người dùng có một quyền (để chọn CTV, người nhận…): id + họ tên
CREATE OR REPLACE FUNCTION app.fn_users_with_permission(p_perm text) RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT u.id, u.full_name FROM public.users u
  WHERE app.current_user_id() IS NOT NULL AND u.status = 'active' AND p_perm = ANY(app.user_permissions(u.id))
  ORDER BY u.full_name
$$;
ALTER FUNCTION app.fn_users_with_permission(text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_users_with_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_users_with_permission(text) TO wf_app;
COMMIT;
