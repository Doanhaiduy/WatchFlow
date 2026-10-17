-- 0003b_worker_health.sql — /api/health?deep=1 chạy dưới wf_worker cần đọc app_migrations (đếm migration đã áp). Idempotent.
BEGIN;
GRANT SELECT ON public.app_migrations TO wf_worker;
DROP POLICY IF EXISTS app_migrations_worker ON public.app_migrations;
CREATE POLICY app_migrations_worker ON public.app_migrations FOR SELECT TO wf_worker USING (true);
COMMIT;
