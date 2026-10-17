-- 0014_storage_purge.sql — Dọn tệp đã xóa khỏi kho lưu trữ (PII!) + theo dõi dung lượng. BR-SEC-03/BR-SEC-05, FR-BAK-05. Idempotent.
--
-- Vấn đề: `files.is_deleted` chỉ đánh dấu; tệp thật (kể cả ẢNH GIẤY TỜ khi ẩn danh khách) còn mãi trong Storage.
-- Thiết kế (mẫu Lưu Xá: storage_files.purge_after + worker xóa đối tượng thật, chỉ chốt sau khi kho xác nhận):
--   1. Cột mới: deleted_at, purge_after (hẹn xóa thật), purged_at (đã xóa thật), thumb_size_bytes (tính đủ dung lượng thumb).
--   2. Trigger BEFORE UPDATE `tg_files_lifecycle`: khi is_deleted false→true ⇒ đặt deleted_at + purge_after:
--        • kind = 'id_document' (ảnh giấy tờ)         ⇒ purge_after = now()  (xóa thật ở lượt job kế tiếp, không chờ ngày giữ);
--        • is_immutable khác (intake/evidence đã gắn chứng từ) ⇒ purge_after = NULL = KHÔNG BAO GIỜ tự xóa; chỉ nghiệp vụ
--          có quyết định riêng mới được đặt purge_after (tệp bất biến phục vụ truy vết chứng từ);
--        • còn lại                                      ⇒ now() + storage.purge_after_days ngày (mặc định 7: còn thời gian hoàn tác).
--      Đã purged_at thì không bỏ xóa/không sửa purged_at (bất biến một chiều).
--   3. Hàm worker: app.fn_storage_purge_candidates(limit) (danh sách cần xóa), app.fn_storage_mark_purged(ids) (chốt SAU khi kho xác nhận;
--      chỉ chốt dòng thật sự đủ điều kiện; ghi audit). wf_worker không có UPDATE trực tiếp bảng files.
--   4. Theo dõi dung lượng: app.fn_storage_usage_raw() (job, không cần người dùng) + app.fn_storage_usage() (cần system.health).
--   5. fn_anonymize_customer: mở rộng — xóa MỌI ảnh giấy tờ của khách: gắn khách, phiếu nhập thu mua (người bán) và phiếu bán (thu cũ đổi mới).
--   6. Cài đặt: storage.purge_after_days, storage.quota_mb, storage.warn_percent, storage.critical_percent.
BEGIN;

ALTER TABLE public.files ADD COLUMN IF NOT EXISTS thumb_size_bytes bigint NOT NULL DEFAULT 0 CHECK (thumb_size_bytes >= 0);
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS purge_after timestamptz;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS purged_at   timestamptz;
COMMENT ON COLUMN public.files.purge_after IS 'Hẹn xóa thật đối tượng ở kho lưu trữ; NULL khi chưa xóa hoặc tệp bất biến không được tự xóa';
COMMENT ON COLUMN public.files.purged_at   IS 'Thời điểm worker xóa thật khỏi kho lưu trữ (đã xác nhận); bất biến một chiều';
COMMENT ON COLUMN public.files.thumb_size_bytes IS 'Dung lượng ảnh thu nhỏ (0 nếu không có) — để tính đủ dung lượng kho';
CREATE INDEX IF NOT EXISTS ix_files_purge ON public.files (purge_after) WHERE is_deleted AND purged_at IS NULL AND purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_files_created_at ON public.files (created_at);

-- wf_app chèn thêm cột dung lượng thumb; KHÔNG có quyền ghi purge_after/purged_at/deleted_at
GRANT INSERT (thumb_size_bytes) ON public.files TO wf_app;

-- ===== Cài đặt =====
INSERT INTO public.settings (key, value, description) VALUES
  ('storage.purge_after_days', '7', 'Giữ tệp ảnh đã xóa bao nhiêu ngày rồi xóa thật khỏi kho (ảnh giấy tờ: xóa ngay lượt job kế tiếp)'),
  ('storage.quota_mb', '1024', 'Hạn mức dung lượng kho lưu trữ (MB) — Supabase gói Free 1 GB'),
  ('storage.warn_percent', '80', 'Cảnh báo khi dùng ≥ N% hạn mức kho lưu trữ'),
  ('storage.critical_percent', '95', 'Khẩn khi dùng ≥ N% hạn mức kho lưu trữ')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- ===== Trigger vòng đời tệp =====
CREATE OR REPLACE FUNCTION app.tg_files_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF OLD.purged_at IS NOT NULL THEN
    IF NEW.purged_at IS DISTINCT FROM OLD.purged_at OR NOT NEW.is_deleted THEN
      RAISE EXCEPTION 'Tệp đã bị xóa thật khỏi kho lưu trữ, không thể khôi phục.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    NEW.deleted_at := now();
    IF NEW.purge_after IS NULL THEN
      IF NEW.kind = 'id_document' THEN
        NEW.purge_after := now();
      ELSIF NEW.is_immutable THEN
        NEW.purge_after := NULL;
      ELSE
        NEW.purge_after := now() + make_interval(days => greatest(0, app.setting_int('storage.purge_after_days', 7)));
      END IF;
    END IF;
  ELSIF OLD.is_deleted AND NOT NEW.is_deleted THEN
    NEW.deleted_at := NULL;
    NEW.purge_after := NULL;
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION app.tg_files_lifecycle() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_files_lifecycle() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_files__lifecycle ON public.files;
CREATE TRIGGER trg_files__lifecycle BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION app.tg_files_lifecycle();

-- Dữ liệu cũ: dòng đã is_deleted từ trước (vd. ảnh giấy tờ của khách đã ẩn danh) ⇒ hẹn xóa theo cùng quy tắc
UPDATE public.files SET
  deleted_at = coalesce(deleted_at, created_at),
  purge_after = CASE WHEN kind = 'id_document' THEN now()
                     WHEN is_immutable THEN NULL
                     ELSE now() + make_interval(days => greatest(0, app.setting_int('storage.purge_after_days', 7))) END
WHERE is_deleted AND purged_at IS NULL AND purge_after IS NULL AND deleted_at IS NULL;

-- ===== Hàm cho worker =====
CREATE OR REPLACE FUNCTION app.fn_storage_purge_candidates(p_limit int DEFAULT 200)
RETURNS TABLE (id uuid, bucket text, path text, thumb_path text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT f.id, f.bucket, f.path, f.thumb_path, f.kind
  FROM public.files f
  WHERE f.is_deleted AND f.purged_at IS NULL AND f.purge_after IS NOT NULL AND f.purge_after <= now()
  ORDER BY f.purge_after, f.id
  LIMIT greatest(1, least(coalesce(p_limit, 200), 1000))
$$;

CREATE OR REPLACE FUNCTION app.fn_storage_mark_purged(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE n integer;
BEGIN
  IF coalesce(cardinality(p_ids), 0) = 0 THEN RETURN 0; END IF;
  UPDATE public.files SET purged_at = now()
  WHERE id = ANY(p_ids) AND is_deleted AND purged_at IS NULL AND purge_after IS NOT NULL AND purge_after <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM app.fn_audit_event('storage.purged', 'files', NULL, NULL, jsonb_build_object('count', n), 'Xóa thật tệp đã xóa khỏi kho lưu trữ', 'info');
  END IF;
  RETURN n;
END $$;

-- ===== Theo dõi dung lượng =====
CREATE OR REPLACE FUNCTION app.fn_storage_usage_raw() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
  SELECT jsonb_build_object(
    'buckets', coalesce((SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'files', n, 'bytes', b) ORDER BY bucket)
      FROM (SELECT bucket, count(*)::int n, sum(size_bytes + thumb_size_bytes)::bigint b FROM public.files WHERE purged_at IS NULL GROUP BY bucket) x), '[]'::jsonb),
    'pending', (SELECT jsonb_build_object('files', count(*)::int, 'bytes', coalesce(sum(size_bytes + thumb_size_bytes), 0)::bigint)
      FROM public.files WHERE is_deleted AND purged_at IS NULL),
    'purged', (SELECT jsonb_build_object('files', count(*)::int, 'bytes', coalesce(sum(size_bytes + thumb_size_bytes), 0)::bigint)
      FROM public.files WHERE purged_at IS NOT NULL),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', d, 'files', n, 'bytes', b) ORDER BY d)
      FROM (SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d, count(*)::int n, sum(size_bytes + thumb_size_bytes)::bigint b
            FROM public.files WHERE created_at >= now() - interval '30 days' GROUP BY 1) y), '[]'::jsonb),
    'quotaMb', app.setting_int('storage.quota_mb', 1024),
    'warnPercent', app.setting_int('storage.warn_percent', 80),
    'criticalPercent', app.setting_int('storage.critical_percent', 95),
    'today', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  )
$$;

CREATE OR REPLACE FUNCTION app.fn_storage_usage() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('system.health');
  RETURN app.fn_storage_usage_raw();
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.fn_storage_purge_candidates(int)','app.fn_storage_mark_purged(uuid[])','app.fn_storage_usage_raw()','app.fn_storage_usage()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.fn_storage_purge_candidates(int), app.fn_storage_mark_purged(uuid[]), app.fn_storage_usage_raw() TO wf_worker;
GRANT EXECUTE ON FUNCTION app.fn_storage_usage() TO wf_app;

-- ===== Ẩn danh khách: xóa MỌI ảnh giấy tờ (gắn khách, phiếu nhập thu mua, phiếu bán) — BR-SEC-03 =====
CREATE OR REPLACE FUNCTION app.fn_anonymize_customer(p_customer uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_reason text; c record; v_files int;
BEGIN
  PERFORM app.require_permission('customer.manage');
  PERFORM app.require_permission('customer.pii.view');
  v_reason := app.require_reason(p_reason);
  SELECT id, code, anonymized_at INTO c FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy khách hàng.'); END IF;
  IF c.anonymized_at IS NOT NULL THEN RETURN jsonb_build_object('id', p_customer, 'unchanged', true); END IF;
  UPDATE public.customers SET full_name = 'Khách đã ẩn danh ' || c.code, phone = NULL, email = NULL, address = NULL, note = NULL,
    id_number_enc = NULL, id_number_bidx = NULL, id_number_last3 = NULL, is_active = false, anonymized_at = now()
  WHERE id = p_customer;
  UPDATE public.files SET is_deleted = true
  WHERE kind = 'id_document' AND NOT is_deleted AND (
       (entity_table = 'customers' AND entity_id = p_customer)
    OR (entity_table = 'purchase_receipts' AND entity_id IN (SELECT id FROM public.purchase_receipts WHERE seller_customer_id = p_customer))
    OR (entity_table = 'sales' AND entity_id IN (SELECT id FROM public.sales WHERE customer_id = p_customer)));
  GET DIAGNOSTICS v_files = ROW_COUNT;
  PERFORM app.fn_audit_event('customer.anonymized', 'customers', p_customer::text, NULL, jsonb_build_object('idDocumentFiles', v_files), v_reason, 'high');
  RETURN jsonb_build_object('id', p_customer);
END $$;
ALTER FUNCTION app.fn_anonymize_customer(uuid, text) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_anonymize_customer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_anonymize_customer(uuid, text) TO wf_app;

COMMIT;
