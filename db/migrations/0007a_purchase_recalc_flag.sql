-- 0007a_purchase_recalc_flag.sql — Sửa tg_purchase_recalc: không được xóa cờ app.in_fn của hàm đang gọi (fn_confirm_purchase cập nhật
-- dòng ⇒ trigger chạy giữa chừng). Lưu và khôi phục giá trị cũ. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.tg_purchase_recalc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_rid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.receipt_id ELSE NEW.receipt_id END; s bigint; c bigint;
        v_prev text := coalesce(current_setting('app.in_fn', true), '');
BEGIN
  SELECT coalesce(sum(line_total_vnd), 0) INTO s FROM public.purchase_lines WHERE receipt_id = v_rid;
  SELECT coalesce(sum(amount_vnd), 0) INTO c FROM public.purchase_costs WHERE receipt_id = v_rid;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.purchase_receipts SET subtotal_vnd = s, extra_cost_total_vnd = c, grand_total_vnd = s + c
  WHERE id = v_rid AND status = 'draft' AND (subtotal_vnd, extra_cost_total_vnd) IS DISTINCT FROM (s, c);
  PERFORM set_config('app.in_fn', v_prev, true);
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_purchase_recalc() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_purchase_recalc() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_purchase_recalc() TO wf_app, wf_definer, wf_worker;
COMMIT;
