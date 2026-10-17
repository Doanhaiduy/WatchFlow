-- 0015 — Nhật ký lỗi phía trình duyệt: thêm phiên bản ứng dụng vào error_events (không chứa dữ liệu cá nhân).
-- Bảng/RLS/grant của error_events đã có ở 0003 (worker ghi, wf_app chỉ đọc theo quyền system.health); ở đây chỉ thêm cột
-- và cấp UPDATE đúng cột mới cho wf_worker (gộp lần lặp cập nhật phiên bản mới nhất). Áp lại nhiều lần không lỗi.

ALTER TABLE public.error_events ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE public.error_events DROP CONSTRAINT IF EXISTS ck_error_events_app_version_len;
ALTER TABLE public.error_events ADD CONSTRAINT ck_error_events_app_version_len CHECK (app_version IS NULL OR length(app_version) <= 32);

GRANT UPDATE (app_version) ON public.error_events TO wf_worker;
COMMENT ON COLUMN public.error_events.app_version IS 'Phiên bản ứng dụng lúc lỗi xảy ra (NEXT_PUBLIC_APP_VERSION), cắt tối đa 32 ký tự.';
