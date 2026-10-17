-- 0019_bulk_import.sql — Nhập Excel hàng loạt (khách hàng, đồng hồ tồn đầu kỳ, linh kiện): không thêm bảng mới.
-- Dữ liệu vẫn đi qua các đường hiện có (INSERT khách theo RLS; phiếu nhập loại `opening` + app.fn_confirm_purchase cho đồng hồ/linh kiện).
-- Chỉ thêm app.fn_audit_import: ghi MỘT dòng audit tổng hợp cho cả lần nhập (số dòng tạo/bỏ qua/lỗi, mã phiếu) — đúng quyền theo loại.
-- FR-IMP-01…04. Áp lại nhiều lần không lỗi.
BEGIN;

CREATE OR REPLACE FUNCTION app.fn_audit_import(p_kind text, p_summary jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF p_kind = 'customers' THEN
    PERFORM app.require_permission('customer.create');
  ELSIF p_kind IN ('watches', 'parts') THEN
    PERFORM app.require_permission('purchase.create');
    PERFORM app.require_permission('purchase.confirm');
  ELSE
    PERFORM app.raise_wf('WF-VALIDATION', 'Loại nhập không hợp lệ.');
  END IF;
  IF p_summary IS NULL OR jsonb_typeof(p_summary) <> 'object' THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Tóm tắt lần nhập không hợp lệ.');
  END IF;
  PERFORM app.fn_audit_event('import.' || p_kind, 'imports', p_kind, NULL, p_summary, NULL, 'info');
END $$;

ALTER FUNCTION app.fn_audit_import(text, jsonb) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_audit_import(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_audit_import(text, jsonb) TO wf_app;
COMMENT ON FUNCTION app.fn_audit_import(text, jsonb) IS 'Audit tổng hợp một lần nhập Excel hàng loạt (không chứa dữ liệu cá nhân — chỉ số đếm + mã phiếu).';

COMMIT;
