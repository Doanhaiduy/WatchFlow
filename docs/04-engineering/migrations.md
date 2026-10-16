# Migration & vai trò cơ sở dữ liệu

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Mẫu tham khảo: `D:\THCode\tools\luu_xa_phanxico\scripts\db\migrate.mjs`, `db/app/1011_house_rules.sql`, `db/migrations/01_foundation.sql`, `49_a_ownership.sql`, `49_b_grants.sql`

## 1. Bố cục & công cụ

```
db/
  migrations/0001_foundation.sql        vai trò, extension, schema app, hàm tiện ích, uuid_v7
  migrations/0002_iam.sql … 00NN_*.sql  một migration = một chủ đề, đánh số tăng dần
  seed/                                  demo (không chạy ở production)
scripts/db/migrate.mjs                  áp migration, ghi bảng app_migrations (tên + sha256)
scripts/db/bundle.mjs                   dựng DB MỚI hoàn toàn từ đầu (môi trường mới)
```

- **Tăng dần, không sửa file đã áp.** Sửa nội dung ⇒ sha256 đổi ⇒ bị chạy lại. Cần sửa ⇒ tạo migration mới.
- **Mỗi file một transaction** (`BEGIN … COMMIT`), **idempotent** (chạy lại không lỗi: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DO $$ … $$` kiểm tồn tại).
- Chú thích **tiếng Việt** đầu file: mục đích, BR/ADR liên quan.
- Dữ liệu tham chiếu bắt buộc (quyền, vai trò, cài đặt mặc định, hạng mục) nằm trong migration (`INSERT … ON CONFLICT DO UPDATE/NOTHING`). Dữ liệu thay đổi một lần (sửa dữ liệu nghiệp vụ) đặt `db/migrations/NNNN_data_*.sql` có tiền tố rõ.
- Lệnh: `pnpm db:migrate [-- --dry-run]` (local), `pnpm db:migrate:staging|:production -- --dry-run` rồi bỏ cờ để áp thật (dùng `MIGRATE_DATABASE_URL`).

## 2. Thứ tự migration dự kiến (khớp mốc)

| Số | Nội dung | Mốc |
|---|---|---|
| 0001 | Vai trò DB, extension (`pgcrypto`, `citext`, `pg_trgm`, `unaccent`), schema `app`, `uuid_v7`, `norm_text`, `round_vnd`, `allocate_vnd`, `current_user_id`, `has_permission`, `tg_audit`, `tg_immutable`, `tg_no_truncate`, `tg_updated_at`, `tg_search_text`, `fn_next_number`, `fn_emit_event`, `app.setting`, `app.today_vn()` (ngày hiện tại giờ VN; DB test cho phép ghi đè qua `app.test_today`, bỏ qua ở production) | M0 |
| 0002 | IAM: users, roles, permissions, role_permissions, user_roles, auth_sessions, refresh_tokens, user_mfa, profiles; seed quyền/vai trò | M0 |
| 0003 | Platform: settings, audit_logs, files, domain_events, notifications, job_runs, error_events, rate_limit_hits, idempotency_keys, app_migrations; seed cài đặt | M0 |
| 0004 | Catalog + Parts (master): brands, watch_models, storage_locations, watch_units, unit_*, part_*; trigger guard trạng thái | M1 |
| 0005 | Partners: customers (+PII), groups, customer_watches | M2 |
| 0006 | Payments tối giản: payments, view `v_doc_balances`; `fn_record_payment`, `fn_void_payment` (không quỹ/sổ cái/kỳ — CF-07) | M3 |
| 0007 | Purchasing: receipts/lines/costs (nguồn hàng chữ, không NCC); `fn_confirm_purchase`, `fn_void_purchase`, `fn_adjust_unit_cost`; `allocate` | M4 |
| 0008 | Sales: reservations, sales, lines, costs, trade_ins, warranties; `fn_*` (không returns/commissions) | M5a |
| 0008b | Cộng tác viên: collaborator_assignments(+lines), collaborator_settlements, cột `held_by_collaborator_id`, `sale_lines.base_price_vnd/shop_revenue_vnd/settlement_id`; `fn_confirm_assignment`, `fn_return_from_collaborator`, `fn_settle_collaborator`, `fn_void_settlement`; mở rộng `fn_confirm_sale`/`fn_void_sale` | M5b |
| 0009 | Repairs: service_types, orders, lines, costs, history; `fn_*` (không tech_pay, không phân công) | M6 |
| 0010 | Inventory + cảnh báo: stocktakes, views aging/low_stock, `fn_reconcile_stocktake`, `fn_consistency_check` (I1–I12) | M7 |
| 0011 | Reports: `rpt_*`, views | M8 |
| 0012+ | Hardening, sửa lỗi phát hiện ở kiểm định/UAT | M9 |

(Số chỉ là gợi ý thứ tự; một mốc có thể tách nhiều file.)

## 3. Vai trò & quyền cơ bản (0001)

```sql
-- Vai trò (NOLOGIN trừ wf_api): thứ tự tạo & thuộc tính theo security-model §2
CREATE ROLE wf_owner NOLOGIN; CREATE ROLE wf_definer NOLOGIN;
CREATE ROLE wf_app   NOLOGIN; CREATE ROLE wf_auth NOLOGIN; CREATE ROLE wf_worker NOLOGIN BYPASSRLS;
CREATE ROLE wf_api   LOGIN NOINHERIT PASSWORD :'api_password';   -- mật khẩu truyền từ biến, không ghi vào file
GRANT wf_app, wf_auth, wf_worker TO wf_api;                       -- để SET ROLE được (NOINHERIT: không tự có quyền)
-- Chú ý Supabase: không cấp SUPERUSER; BYPASSRLS có thể cần kiểm tra khả năng; wf_worker thay thế được bằng SET ROLE trong transaction nếu không cho BYPASSRLS
GRANT USAGE ON SCHEMA public, app TO wf_owner, wf_definer, wf_app, wf_auth, wf_worker;  -- (bài học F-026: thiếu USAGE trên schema app làm lỗi chập chờn)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;   -- tắt Data API
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

Kiểm tra sau khi áp: `SELECT … FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated')` ⇒ 0 dòng. Test cấu trúc `db:audit` kiểm: mọi bảng `public` có `relrowsecurity` **và** `relforcerowsecurity`; mọi hàm `SECURITY DEFINER` có `proconfig` chứa `search_path`; không hàm `app.*` cấp cho `PUBLIC`; mọi FK có index; chủ sở hữu đúng.

## 4. Mẫu migration cho bảng mới

```sql
-- 0007_example.sql — Phiếu nhập (BR-PUR-*, FR-PUR-*). Idempotent, một transaction.
BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code          text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN ('purchase','customer_buyback','trade_in','opening')),
  source_name   text,                                   -- nguồn hàng (chữ) khi kind='purchase'
  doc_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','voided')),
  grand_total_vnd bigint NOT NULL DEFAULT 0 CHECK (grand_total_vnd >= 0),
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_source_required CHECK (kind <> 'purchase' OR source_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_purchase_receipts_doc_date ON public.purchase_receipts (doc_date);

ALTER TABLE public.purchase_receipts OWNER TO wf_owner;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts FORCE  ROW LEVEL SECURITY;

REVOKE ALL ON public.purchase_receipts FROM wf_app, PUBLIC;
GRANT SELECT ON public.purchase_receipts TO wf_app;                       -- đọc theo RLS
GRANT INSERT (kind, source_name, doc_date, created_by) ON public.purchase_receipts TO wf_app;  -- chỉ tạo nháp, cột hạn chế
GRANT UPDATE (source_name, doc_date, version, updated_at) ON public.purchase_receipts TO wf_app; -- sửa nháp (trigger chặn khi đã xác nhận)

DROP POLICY IF EXISTS purchase_receipts_select ON public.purchase_receipts;
CREATE POLICY purchase_receipts_select ON public.purchase_receipts FOR SELECT TO wf_app
  USING (app.has_permission('purchase.view'));
DROP POLICY IF EXISTS purchase_receipts_insert ON public.purchase_receipts;
CREATE POLICY purchase_receipts_insert ON public.purchase_receipts FOR INSERT TO wf_app
  WITH CHECK (app.has_permission('purchase.create') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS purchase_receipts_update ON public.purchase_receipts;
CREATE POLICY purchase_receipts_update ON public.purchase_receipts FOR UPDATE TO wf_app
  USING (app.has_permission('purchase.create') AND status = 'draft')
  WITH CHECK (status = 'draft');

DROP TRIGGER IF EXISTS trg_purchase_receipts__audit ON public.purchase_receipts;
CREATE TRIGGER trg_purchase_receipts__audit AFTER INSERT OR UPDATE OR DELETE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION app.tg_audit();
DROP TRIGGER IF EXISTS trg_purchase_receipts__guard ON public.purchase_receipts;
CREATE TRIGGER trg_purchase_receipts__guard BEFORE UPDATE OR DELETE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION app.tg_confirmed_doc_guard();

-- Hàm đặc quyền: SECURITY DEFINER + search_path cố định + owner wf_definer + chỉ cấp EXECUTE đúng vai trò
CREATE OR REPLACE FUNCTION app.fn_confirm_purchase(p_receipt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF NOT app.has_permission('purchase.confirm') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='{"code":"WF-AUTH-FORBIDDEN","vi":"Bạn không có quyền xác nhận phiếu nhập."}';
  END IF;
  -- … khóa theo thứ tự, kiểm tra, ghi, audit, sự kiện (xem integrity-and-concurrency §3)
  RETURN '{}'::jsonb;
END $$;
ALTER FUNCTION app.fn_confirm_purchase(uuid) OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.fn_confirm_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.fn_confirm_purchase(uuid) TO wf_app;

COMMIT;
```

### Checklist bắt buộc cho **bảng mới**
1. Khóa chính `uuid` v7; cột chung (`created_at`, `created_by`, …); `CHECK` cho trạng thái/loại/khoảng giá trị.
2. `OWNER TO wf_owner`; `ENABLE` + `FORCE ROW LEVEL SECURITY`.
3. `REVOKE ALL … FROM wf_app, PUBLIC` rồi `GRANT` **từng quyền/cột** cần; chính sách RLS cho từng thao tác.
4. Index cho **mọi FK** và cột lọc; partial unique cho bất biến nghiệp vụ.
5. Trigger `tg_audit` (bảng nghiệp vụ); `tg_immutable` + `tg_no_truncate` (bảng append-only); `tg_confirmed_doc_guard` (chứng từ).
6. Thêm vào bộ test cấu trúc (`db:audit`) nếu có ngoại lệ có chủ đích.
7. Cập nhật `data-model`, `security-model` (nếu quyền mới), `settings-catalog` (nếu cài đặt mới).

### Checklist bắt buộc cho **hàm `fn_*`**
1. `SECURITY DEFINER`, `SET search_path = public, app, pg_temp`, `OWNER TO wf_definer`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE` đúng vai trò.
2. Kiểm quyền (`has_permission`) **trong thân**; kiểm ngày chứng từ (BR-GEN-08); lý do khi cần.
3. Khóa theo thứ tự (`integrity-and-concurrency` §2); `SET LOCAL lock_timeout`/`statement_timeout`.
4. Lỗi nghiệp vụ `RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='{"code":"WF-…","vi":"…"}'`.
5. Ghi `audit_logs` + `fn_emit_event` trong cùng hàm.
6. Test: kịch bản vàng + ca từ chối (thiếu quyền, sai trạng thái) + ca đồng thời nếu động tới kho/tiền/trạng thái.

## 5. Quy trình áp migration

1. Viết/sửa migration ở local → `pnpm db:migrate -- --dry-run` → áp → chạy lại lần 2 (phải không lỗi, không đổi gì) → `pnpm test:api`.
2. **Sao lưu production** (xem `backup-restore`) nếu có migration lên production.
3. Staging: `pnpm db:migrate:staging -- --dry-run` → áp thật → kiểm tra Preview.
4. Production: `pnpm db:migrate:production -- --dry-run` → áp thật **trước** khi deploy code mới → deploy.
5. Migration **tương thích ngược** (expand/contract): code cũ phải chạy được trên schema mới trong khoảng giữa bước 4 và deploy.

## 6. Dựng DB mới hoàn toàn

`node scripts/db/bundle.mjs --apply <chuỗi chủ DB pooler> --allow-remote --api-password <…>` gộp mọi migration theo thứ tự và áp; sau đó `pnpm db:migrate:<env>` để ghi nhận `app_migrations`. Tài khoản chủ đầu tiên: `scripts/env/bootstrap-owner.mjs`.

## 7. Bài học cần tránh (từ kiểm định dự án mẫu)

- Thiếu `USAGE` trên schema `app` cho `wf_owner` ⇒ lỗi FK ngẫu nhiên theo trạng thái cache của từng kết nối. Test bằng **nhiều kết nối riêng**, không chỉ một phiên superuser.
- Job phân vùng/bảo trì thiếu quyền `CREATE`/`USAGE` ⇒ hỏng ngầm từ một tháng nào đó. Mọi job định kỳ có test chạy dưới đúng vai trò.
- Trigger dùng chung hai bảng: dùng `IF/ELSIF`, đừng `CASE` tham chiếu `OLD.cột` của bảng kia.
- Mọi quyền `GRANT INSERT (cột)` phải có trigger/hàm kiểm giá trị (vd. `base_price_vnd` hay số tiền chèn trực tiếp) — mass-assignment test (PT-07).
- Đừng khẳng định "DB đã chặn" khi chưa có test dưới `wf_app`.
