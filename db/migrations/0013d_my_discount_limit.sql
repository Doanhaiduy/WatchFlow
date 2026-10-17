-- 0013d — Hạn mức giảm giá của chính người dùng (BR-SALE: max_discount_pct cao nhất trong các vai trò đang bật),
-- để POS cảnh báo sớm thay vì chỉ báo lỗi lúc xác nhận. Chỉ đọc giá trị của chính mình. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.my_max_discount_pct() RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT coalesce(max(r.max_discount_pct), 0)
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id AND r.is_active
  WHERE ur.user_id = app.current_user_id()
$$;
ALTER FUNCTION app.my_max_discount_pct() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.my_max_discount_pct() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.my_max_discount_pct() TO wf_app;
COMMIT;
