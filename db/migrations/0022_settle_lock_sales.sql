-- 0022 — Sửa đua dữ liệu "hủy đơn CTV ∥ quyết toán" (CT-08): quyết toán phải KHÓA phiếu bán cha trước khi đọc trạng thái của nó.
-- Lỗi cũ: fn_settle_collaborator khóa dòng bán (FOR UPDATE OF sl) và đọc s.status từ phiếu bán trong cùng câu JOIN. Khi fn_void_sale vừa
-- hủy đơn trong lúc quyết toán đang chờ khóa dòng, PostgreSQL chỉ kiểm lại dòng đã khóa và GIỮ NGUYÊN giá trị cũ của bảng nối ⇒ s.status vẫn
-- 'confirmed' ⇒ quyết toán + thu tiền cho đơn đã bị hủy (đã tái hiện bằng test CT-08b; CI Linux/PG16 gặp, máy Windows/PG18 may mắn không).
-- Cách sửa: khóa các phiếu bán cha theo id tăng (cùng thứ tự với fn_void_sale: phiếu → dòng bán) bằng MỘT câu lệnh riêng; câu lệnh đọc kế tiếp lấy
-- snapshot mới nên thấy trạng thái đã commit của lần hủy. Không đổi chữ ký hàm, quyền hay hành vi nào khác.
BEGIN;
CREATE OR REPLACE FUNCTION app.fn_settle_collaborator(p_collaborator uuid, p_line_ids uuid[], p_method text, p_doc_date date DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE l record; v_total bigint := 0; v_id uuid; v_code text; v_date date; v_pay jsonb; n int := 0;
BEGIN
  PERFORM app.require_permission('collab.manage');
  IF coalesce(array_length(p_line_ids, 1), 0) = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Chọn ít nhất một dòng đã bán để quyết toán.'); END IF;
  v_date := app.check_doc_date(p_doc_date);
  SET LOCAL lock_timeout = '5s';
  -- Khóa phiếu bán cha TRƯỚC (id tăng): nếu đơn đang bị hủy ở giao dịch khác thì chờ ở đây; câu lệnh sau thấy trạng thái đã commit.
  PERFORM 1 FROM public.sales WHERE id IN (SELECT sale_id FROM public.sale_lines WHERE id = ANY(p_line_ids)) ORDER BY id FOR UPDATE;
  FOR l IN SELECT sl.id, sl.settlement_id, sl.base_price_vnd, sl.is_effective, s.status, s.collaborator_id
           FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id WHERE sl.id = ANY(p_line_ids) ORDER BY sl.id FOR UPDATE OF sl LOOP
    n := n + 1;
    IF l.collaborator_id IS DISTINCT FROM p_collaborator OR l.status <> 'confirmed' OR l.base_price_vnd IS NULL THEN
      PERFORM app.raise_wf('WF-VALIDATION', 'Có dòng không phải đơn đã xác nhận của cộng tác viên này (có thể vừa bị hủy).');
    END IF;
    IF l.settlement_id IS NOT NULL THEN PERFORM app.raise_wf('WF-COL-ALREADY-SETTLED', 'Có dòng đã được quyết toán trước đó.'); END IF;
    v_total := v_total + l.base_price_vnd;
  END LOOP;
  IF n <> array_length(p_line_ids, 1) THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Có dòng bán không tồn tại.'); END IF;
  IF v_total <= 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Tổng tiền quyết toán phải lớn hơn 0.'); END IF;
  v_code := app.fn_next_number('QT');
  INSERT INTO public.collaborator_settlements (code, collaborator_id, doc_date, total_vnd, method, note, created_by)
  VALUES (v_code, p_collaborator, v_date, v_total, p_method, p_note, app.current_user_id()) RETURNING id INTO v_id;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.sale_lines SET settlement_id = v_id WHERE id = ANY(p_line_ids);
  v_pay := app.fn_record_payment('settlement', v_id, 'collab_settlement', p_method, v_total, v_date, p_note);
  PERFORM app.fn_audit_event('settlement.confirmed', 'collaborator_settlements', v_id::text, NULL, jsonb_build_object('code', v_code, 'total', v_total), NULL, 'high');
  PERFORM app.fn_emit_event('settlement.confirmed', jsonb_build_object('settlementId', v_id, 'collaboratorId', p_collaborator, 'total', v_total));
  PERFORM set_config('app.in_fn', '', true);
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total, 'payment', v_pay);
END $$;
ALTER FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_settle_collaborator(uuid,uuid[],text,date,text) TO wf_app;
COMMIT;
