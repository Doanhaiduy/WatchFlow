-- 0003a_definer_grants.sql — wf_definer (chủ hàm SECURITY DEFINER) cần quyền DML trên bảng nghiệp vụ; BYPASSRLS chỉ bỏ qua RLS,
-- không thay GRANT. wf_backup chỉ SELECT. Default privileges đặt theo vai trò chạy migration (bảng do vai trò đó tạo rồi đổi owner).
-- CQ-001. Idempotent.
BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wf_definer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO wf_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wf_definer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO wf_backup;
COMMIT;
