-- 0021 — Nhật ký hoạt động cấp request (activity_logs) + cài đặt giữ dữ liệu. Áp lại nhiều lần không lỗi.
--
-- Mục đích: trả lời "ai đã làm gì, lúc nào, từ đâu" ở mức yêu cầu API (khác audit_logs = thay đổi dữ liệu do trigger/hàm DB ghi).
--   • Ghi: tầng ứng dụng (src/server/activity.ts) ghi SAU khi trả phản hồi, gộp nhiều request thành một INSERT, dưới wf_worker
--     (chỉ INSERT). Không ghi nội dung gửi lên, không ghi query string, không ghi giá trị tham số đường dẫn: `route` là mẫu
--     (vd. /api/v1/sales/[id]/confirm). Ràng buộc CHECK chặn ký tự lạ (không có '?', '=', khoảng trắng, chữ có dấu) ⇒ PII không lọt được.
--   • `entity_id`: chỉ nhận UUID của đối tượng được thao tác (lấy từ tham số đường dẫn), để truy ngược chứng từ; không phải PII.
--   • `action`: mã sự kiện đọc nhạy cảm (export, print, view_cost, view_report, reveal_pii…) do máy chủ gắn — liên kết audit_logs
--     (cùng request_id) khi hàm DB đã ghi audit riêng (pii.reveal, report.exported…).
--   • Đọc: chỉ quyền audit.view (RLS). wf_app KHÔNG có INSERT/UPDATE/DELETE.
--   • Append-only: trigger chặn UPDATE/TRUNCATE; DELETE chỉ qua hàm app.fn_activity_purge (SECURITY DEFINER, wf_definer) — dọn dữ
--     liệu quá activity.retention_days (mặc định 180, sàn 30 ngày). Không có đường xóa nào khác (kể cả wf_worker/wf_definer gọi DELETE trực tiếp).

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          uuid        PRIMARY KEY DEFAULT app.uuid_v7(),
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     uuid        REFERENCES public.users(id) ON DELETE RESTRICT,
  method      text        NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  route       text        NOT NULL CHECK (route ~ '^/api/[a-z0-9/_\[\]-]{1,180}$'),
  action      text        CHECK (action IS NULL OR action ~ '^[a-z_]{1,40}$'),
  entity_id   text        CHECK (entity_id IS NULL OR entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  status      smallint    NOT NULL CHECK (status BETWEEN 100 AND 599),
  error_code  text        CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9-]{1,40}$'),
  duration_ms integer     CHECK (duration_ms IS NULL OR duration_ms >= 0),
  ip_hash     text        CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{8,64}$'),
  request_id  text        CHECK (request_id IS NULL OR request_id ~ '^[0-9a-f-]{8,40}$')
);
COMMENT ON TABLE public.activity_logs IS
  'Nhật ký hoạt động cấp request: ai (user_id), làm gì (method + route mẫu, action cho đọc nhạy cảm), kết quả, từ đâu (ip_hash). Không nội dung, không query, không PII. Append-only; dọn qua app.fn_activity_purge. Chỉ audit.view đọc.';
COMMENT ON COLUMN public.activity_logs.route IS 'Mẫu đường dẫn API, giá trị tham số thay bằng [tên] (vd. /api/v1/sales/[id]/confirm). Không chứa query.';
COMMENT ON COLUMN public.activity_logs.action IS 'Mã sự kiện đọc nhạy cảm (export, print, view_cost, view_report, reveal_pii, view_audit) hoặc NULL.';
COMMENT ON COLUMN public.activity_logs.request_id IS 'Trùng audit_logs.request_id — nối với thay đổi dữ liệu do cùng request gây ra.';
CREATE INDEX IF NOT EXISTS ix_activity_logs_at ON public.activity_logs (at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_activity_logs_user ON public.activity_logs (user_id, at DESC);
CREATE INDEX IF NOT EXISTS ix_activity_logs_action ON public.activity_logs (action, at DESC) WHERE action IS NOT NULL;

ALTER TABLE public.activity_logs OWNER TO wf_owner;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_logs FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api, wf_definer;
GRANT SELECT ON public.activity_logs TO wf_app;
GRANT INSERT ON public.activity_logs TO wf_worker;
GRANT SELECT, INSERT, DELETE ON public.activity_logs TO wf_definer;

DROP POLICY IF EXISTS activity_logs_select ON public.activity_logs;
CREATE POLICY activity_logs_select ON public.activity_logs FOR SELECT TO wf_app USING (app.has_permission('audit.view'));
DROP POLICY IF EXISTS activity_logs_worker_insert ON public.activity_logs;
CREATE POLICY activity_logs_worker_insert ON public.activity_logs FOR INSERT TO wf_worker WITH CHECK (true);
DROP POLICY IF EXISTS activity_logs_definer ON public.activity_logs;
CREATE POLICY activity_logs_definer ON public.activity_logs FOR ALL TO wf_definer USING (true) WITH CHECK (true);

-- ===== Append-only: UPDATE/TRUNCATE luôn bị chặn; DELETE chỉ cho hàm dọn (wf_definer + cờ cục bộ transaction) =====
CREATE OR REPLACE FUNCTION app.tg_activity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'wf_definer' AND current_setting('app.activity_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'P0001',
    MESSAGE = jsonb_build_object('code', 'WF-IMMUTABLE', 'vi', 'Dữ liệu này không được sửa hoặc xóa (' || TG_TABLE_NAME || ').')::text;
END $$;
REVOKE ALL ON FUNCTION app.tg_activity_immutable() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_activity_logs__immutable ON public.activity_logs;
CREATE TRIGGER trg_activity_logs__immutable BEFORE UPDATE OR DELETE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION app.tg_activity_immutable();
DROP TRIGGER IF EXISTS trg_activity_logs__no_truncate ON public.activity_logs;
CREATE TRIGGER trg_activity_logs__no_truncate BEFORE TRUNCATE ON public.activity_logs FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate();

-- ===== Hàm dọn dữ liệu quá hạn giữ (chỉ job định kỳ, wf_worker) =====
-- p_days NULL ⇒ lấy activity.retention_days (mặc định 180); luôn giữ tối thiểu 30 ngày dù cài đặt/tham số nhỏ hơn.
CREATE OR REPLACE FUNCTION app.fn_activity_purge(p_days int DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_days int; v_n integer;
BEGIN
  v_days := greatest(30, coalesce(p_days, app.setting_int('activity.retention_days', 180)));
  PERFORM set_config('app.activity_purge', 'on', true);
  DELETE FROM public.activity_logs WHERE at < now() - make_interval(days => v_days);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.activity_purge', '', true);
  IF v_n > 0 THEN
    PERFORM app.fn_audit_event('activity.purged', 'activity_logs', NULL, NULL, jsonb_build_object('count', v_n, 'retentionDays', v_days),
                               'Dọn nhật ký hoạt động quá hạn giữ', 'info');
  END IF;
  RETURN v_n;
END $$;
ALTER FUNCTION app.fn_activity_purge(int) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_activity_purge(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_activity_purge(int) TO wf_worker;

-- ===== Cài đặt =====
INSERT INTO public.settings (key, value, description) VALUES
  ('activity.retention_days', '180', 'Giữ nhật ký hoạt động người dùng bao nhiêu ngày (tối thiểu 30) rồi dọn tự động hằng ngày'),
  ('security.trusted_device_days', '30', 'Số ngày "tin cậy thiết bị này" ở bước xác thực 2 bước (0 = tắt tính năng, tối đa 90)')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
