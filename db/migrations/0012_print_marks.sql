-- 0012_print_marks.sql — In phiếu bán (BR-SALE-11): đếm số lần in; lần thứ 2 trở đi là "BẢN IN LẠI" và ghi audit. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_mark_sale_printed(p_sale uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE s record; v_n int;
BEGIN
  SELECT id, code, status, print_count, created_by, collaborator_id INTO s FROM public.sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND OR NOT app.sale_visible(s.created_by, s.collaborator_id) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy phiếu bán.'); END IF;
  IF s.status <> 'confirmed' THEN PERFORM app.raise_wf('WF-DOC-NOT-DRAFT', 'Chỉ in phiếu đã xác nhận.'); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.sales SET print_count = print_count + 1 WHERE id = p_sale RETURNING print_count INTO v_n;
  IF v_n > 1 THEN
    PERFORM app.fn_audit_event('sale.reprinted', 'sales', p_sale::text, NULL, jsonb_build_object('printCount', v_n), NULL, 'info');
  END IF;
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', p_sale, 'printCount', v_n, 'reprint', v_n > 1);
END $$;
ALTER FUNCTION app.fn_mark_sale_printed(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_mark_sale_printed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_mark_sale_printed(uuid) TO wf_app;
COMMIT;
