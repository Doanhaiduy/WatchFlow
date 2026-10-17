-- 0013e — "Đơn của tôi" của CTV: dòng đơn kèm mã chiếc/loại, giá bán, giá thu, đã quyết toán (BR-COL-03/04, PT-02).
-- Lỗi cũ: route JOIN watch_units dưới RLS — chiếc đã bán không còn "đang giữ" nên CTV không thấy ⇒ đơn đã xác nhận rỗng dòng.
-- Hàm chỉ trả dòng của đơn do CHÍNH CTV tạo; không có giá vốn. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_collab_my_sale_lines(p_sale uuid)
RETURNS TABLE (line_no int, asset_code text, model_name text, brand_name text, sale_price_vnd bigint, base_price_vnd bigint, settled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF NOT (app.has_permission('collab.view_own')
          AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = p_sale AND s.collaborator_id = app.current_user_id())) THEN
    PERFORM app.raise_wf('WF-AUTH-FORBIDDEN', 'Bạn chỉ xem được đơn của chính mình.');
  END IF;
  RETURN QUERY
    SELECT sl.line_no::int, u.asset_code::text, m.name::text, b.name::text, sl.unit_price_vnd, sl.base_price_vnd, (sl.settlement_id IS NOT NULL)
    FROM public.sale_lines sl
    JOIN public.watch_units u ON u.id = sl.unit_id
    JOIN public.watch_models m ON m.id = u.model_id
    JOIN public.brands b ON b.id = m.brand_id
    WHERE sl.sale_id = p_sale
    ORDER BY sl.line_no;
END $$;
ALTER FUNCTION app.fn_collab_my_sale_lines(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_collab_my_sale_lines(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_collab_my_sale_lines(uuid) TO wf_app;
COMMIT;
