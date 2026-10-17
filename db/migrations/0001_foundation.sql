-- 0001_foundation.sql — Nền tảng: vai trò DB, extension, schema app, hàm tiện ích, trigger dùng chung.
-- BR-GEN-01/02/04/06/08, ADR-003/004. Idempotent, một transaction. Xem docs/04-engineering/migrations.md §3.
-- Ghi chú: wf_definer có BYPASSRLS (CONFIRM CQ-001) — hàm SECURITY DEFINER tự kiểm quyền trong thân.
BEGIN;

-- ===== Vai trò =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_owner')   THEN CREATE ROLE wf_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_definer') THEN CREATE ROLE wf_definer NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_app')     THEN CREATE ROLE wf_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_auth')    THEN CREATE ROLE wf_auth NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_worker')  THEN CREATE ROLE wf_worker NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_api')     THEN CREATE ROLE wf_api LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wf_backup')  THEN CREATE ROLE wf_backup NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT wf_app, wf_auth, wf_worker TO wf_api;
-- Bỏ quyền mặc định của PUBLIC trên schema public (PG15+ đã bỏ CREATE; giữ cho chắc)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Supabase: thu quyền anon/authenticated nếu tồn tại (tắt Data API)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  END IF;
END $$;

-- ===== Extension =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ===== Schema app =====
CREATE SCHEMA IF NOT EXISTS app;
ALTER SCHEMA app OWNER TO wf_owner;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app TO wf_owner, wf_definer, wf_app, wf_auth, wf_worker, wf_api, wf_backup;
GRANT CREATE ON SCHEMA public, app TO wf_owner, wf_definer;

-- ===== Hàm tiện ích thuần =====
-- UUID v7 (sắp xếp theo thời gian) — tự viết để chạy cả PG < 18
CREATE OR REPLACE FUNCTION app.uuid_v7() RETURNS uuid LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid()) placing
        substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3) FROM 1 FOR 6),
      52, 1), 53, 1), 'hex')::uuid
$$;

-- Chuẩn hóa chữ để tìm kiếm: bỏ dấu tiếng Việt, hạ chữ, gộp khoảng trắng
CREATE OR REPLACE FUNCTION app.norm_text(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN t IS NULL THEN NULL ELSE
    btrim(regexp_replace(lower(public.unaccent('public.unaccent'::regdictionary, translate(t, 'đĐ', 'dD'))), '\s+', ' ', 'g')) END
$$;

-- Chuẩn hóa SĐT: chỉ chữ số, +84/84 → 0
CREATE OR REPLACE FUNCTION app.norm_phone(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN t IS NULL OR regexp_replace(t, '\D', '', 'g') = '' THEN NULL
    ELSE regexp_replace(regexp_replace(t, '\D', '', 'g'), '^84(\d{9,10})$', '0\1') END
$$;

-- Chuẩn hóa serial (data-model §1)
CREATE OR REPLACE FUNCTION app.norm_serial(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT nullif(upper(regexp_replace(coalesce(t, ''), '[\s\-_/.]', '', 'g')), '')
$$;

-- Người dùng hiện tại của request (NULL nếu chưa gắn ⇒ RLS trả 0 dòng)
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.request_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.request_id', true), '')
$$;

-- Ngày hiện tại theo giờ Việt Nam. DB test (app.env='test') cho phép ghi đè qua app.test_today.
CREATE OR REPLACE FUNCTION app.today_vn() RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  IF current_setting('app.env', true) = 'test' THEN
    v := nullif(current_setting('app.test_today', true), '');
    IF v IS NOT NULL THEN RETURN v::date; END IF;
  END IF;
  RETURN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
END $$;

-- Ném lỗi nghiệp vụ có mã WF-* (SQLSTATE P0001, MESSAGE JSON {code, vi})
CREATE OR REPLACE FUNCTION app.raise_wf(p_code text, p_vi text, p_extra jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001',
    MESSAGE = (jsonb_build_object('code', p_code, 'vi', p_vi) || coalesce(p_extra, '{}'::jsonb))::text;
END $$;

-- Lý do bắt buộc ≥ 10 ký tự (BR-GEN-05)
CREATE OR REPLACE FUNCTION app.require_reason(p_reason text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
    PERFORM app.raise_wf('WF-REASON-REQUIRED', 'Vui lòng nhập lý do (ít nhất 10 ký tự).');
  END IF;
  RETURN btrim(p_reason);
END $$;

-- ===== Trigger dùng chung =====
-- updated_at + version (khóa lạc quan)
CREATE OR REPLACE FUNCTION app.tg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF to_jsonb(NEW) ? 'version' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('version', coalesce((to_jsonb(OLD)->>'version')::int, 0) + 1));
  END IF;
  IF to_jsonb(NEW) ? 'updated_by' AND app.current_user_id() IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', app.current_user_id()));
  END IF;
  RETURN NEW;
END $$;

-- Bảng append-only: chặn UPDATE/DELETE (B6)
CREATE OR REPLACE FUNCTION app.tg_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001',
    MESSAGE = jsonb_build_object('code', 'WF-IMMUTABLE', 'vi', 'Dữ liệu này không được sửa hoặc xóa (' || TG_TABLE_NAME || ').')::text;
END $$;

CREATE OR REPLACE FUNCTION app.tg_no_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001',
    MESSAGE = jsonb_build_object('code', 'WF-IMMUTABLE', 'vi', 'Không được xóa toàn bộ bảng ' || TG_TABLE_NAME || '.')::text;
END $$;

-- search_text từ các cột truyền qua TG_ARGV (đã bỏ dấu, hạ chữ)
CREATE OR REPLACE FUNCTION app.tg_search_text() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j jsonb := to_jsonb(NEW); parts text[] := '{}'; c text;
BEGIN
  FOREACH c IN ARRAY TG_ARGV LOOP
    IF j ? c AND j->>c IS NOT NULL THEN parts := parts || (j->>c); END IF;
  END LOOP;
  NEW := jsonb_populate_record(NEW, jsonb_build_object('search_text', app.norm_text(array_to_string(parts, ' '))));
  RETURN NEW;
END $$;

-- Chứng từ đã xác nhận bất biến (B7): chỉ hàm fn_* (cờ app.in_fn) được đổi; DELETE chỉ với nháp
CREATE OR REPLACE FUNCTION app.tg_confirmed_doc_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.in_fn', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF (to_jsonb(OLD)->>'status') IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = jsonb_build_object('code', 'WF-DOC-NOT-DRAFT', 'vi', 'Chứng từ đã xác nhận/hủy, không được sửa hoặc xóa.')::text;
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW)->>'status') IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = jsonb_build_object('code', 'WF-DOC-NOT-DRAFT', 'vi', 'Không được đổi trạng thái chứng từ trực tiếp.')::text;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- Hàm tiện ích được mọi vai trò nội bộ gọi
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.uuid_v7()','app.norm_text(text)','app.norm_phone(text)','app.norm_serial(text)',
    'app.current_user_id()','app.request_id()','app.today_vn()','app.raise_wf(text,text,jsonb)','app.require_reason(text)',
    'app.tg_updated_at()','app.tg_immutable()','app.tg_no_truncate()','app.tg_search_text()','app.tg_confirmed_doc_guard()']
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_owner', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_owner, wf_definer, wf_app, wf_auth, wf_worker, wf_api', f);
  END LOOP;
END $$;

COMMIT;
