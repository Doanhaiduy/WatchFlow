-- 0020_push.sql — Thông báo đẩy (Web Push / VAPID) trên thiết bị. FR-PLAT-05 (mới). Idempotent, một transaction.
--
-- Thiết kế (mẫu Lưu Xá: push_subscriptions + notification_outbox, đơn giản hóa cho WatchFlow):
--   1. push_subscriptions  — mỗi trình duyệt/thiết bị của một người dùng một dòng (endpoint duy nhất). `p256dh` và `auth` là BÍ MẬT mã hóa
--      tin đẩy: chỉ máy chủ gửi tin (wf_worker) đọc được; wf_app KHÔNG có quyền SELECT hai cột này (grant theo cột). Người dùng chỉ thấy
--      và hủy đăng ký của chính mình (RLS). Đăng ký qua hàm app.fn_register_push_subscription: cùng endpoint đã thuộc người khác (máy dùng
--      chung đổi tài khoản) ⇒ chuyển sang người đăng nhập hiện tại.
--   2. push_preferences    — giờ yên tĩnh theo giờ Việt Nam (phút trong ngày, [bắt đầu, kết thúc) có thể vắt qua nửa đêm). Mặc định tắt.
--   3. push_outbox         — hàng đợi gửi đẩy: trigger AFTER INSERT trên notifications chèn một dòng khi người nhận có thiết bị đang bật
--      (thông báo trong ứng dụng vẫn luôn có). Máy chủ (src/server/push.ts) lấy dòng đến hạn, gửi, ghi kết quả; thử lại tối đa 5 lần,
--      404/410 ⇒ tắt thiết bị (disabled_at). Giờ yên tĩnh ⇒ lùi next_attempt_at, không tính là lần thử.
--   Không lưu nội dung tin trong bảng: tiêu đề/nội dung lấy từ notifications lúc gửi. Bảng kỹ thuật ⇒ không gắn tg_audit (chứa khóa bí mật),
--   hành động đăng ký/hủy ghi audit_logs bằng fn_audit_event (không kèm endpoint/khóa).
BEGIN;

-- ===== push_subscriptions =====
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE CHECK (length(endpoint) <= 1000 AND endpoint LIKE 'https://%'),
  p256dh      text NOT NULL CHECK (length(p256dh) BETWEEN 20 AND 200),
  auth        text NOT NULL CHECK (length(auth) BETWEEN 8 AND 100),
  user_agent  text CHECK (length(user_agent) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_ok_at  timestamptz,
  fail_count  integer NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  disabled_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user ON public.push_subscriptions (user_id) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_all ON public.push_subscriptions (user_id);
COMMENT ON TABLE  public.push_subscriptions IS 'Thiết bị nhận thông báo đẩy của người dùng (Web Push). p256dh/auth là bí mật — chỉ wf_worker đọc.';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'Khóa công khai ECDH của trình duyệt — BÍ MẬT (cùng auth dùng để mã hóa tin đẩy); wf_app không đọc được';
COMMENT ON COLUMN public.push_subscriptions.auth IS 'Bí mật xác thực của đăng ký đẩy — BÍ MẬT; wf_app không đọc được';
COMMENT ON COLUMN public.push_subscriptions.disabled_at IS 'Đẩy tới thiết bị này đã bị tắt (push service trả 404/410 hoặc lỗi liên tiếp)';

-- ===== push_preferences =====
CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  quiet_enabled boolean NOT NULL DEFAULT false,
  quiet_start   smallint NOT NULL DEFAULT 1320 CHECK (quiet_start BETWEEN 0 AND 1439),
  quiet_end     smallint NOT NULL DEFAULT 420  CHECK (quiet_end BETWEEN 0 AND 1439),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE  public.push_preferences IS 'Tùy chọn thông báo đẩy của người dùng: giờ yên tĩnh theo giờ Việt Nam (phút trong ngày; mặc định 22:00–07:00, tắt)';

-- ===== push_outbox =====
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','skipped','failed')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text CHECK (length(last_error) <= 200),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_push_outbox_due ON public.push_outbox (next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS ix_push_outbox_user ON public.push_outbox (user_id);
CREATE INDEX IF NOT EXISTS ix_push_outbox_created ON public.push_outbox (created_at);
COMMENT ON TABLE public.push_outbox IS 'Hàng đợi gửi thông báo đẩy (một dòng cho mỗi notifications có người nhận đang bật thiết bị); chỉ máy chủ gửi tin (wf_worker) đọc/ghi';

-- ===== Sở hữu + RLS + quyền =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['push_subscriptions','push_preferences','push_outbox'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
  END LOOP;
END $$;

-- wf_app: chỉ ĐỌC dòng của mình và KHÔNG gồm hai cột bí mật (p256dh, auth); ghi qua hàm app.fn_*
GRANT SELECT (id, user_id, endpoint, user_agent, created_at, last_ok_at, fail_count, disabled_at) ON public.push_subscriptions TO wf_app;
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT TO wf_app USING (user_id = app.current_user_id());

GRANT SELECT ON public.push_preferences TO wf_app;
DROP POLICY IF EXISTS push_preferences_select ON public.push_preferences;
CREATE POLICY push_preferences_select ON public.push_preferences FOR SELECT TO wf_app USING (user_id = app.current_user_id());

-- wf_worker (máy chủ gửi tin): đọc tất cả (kể cả khóa), cập nhật kết quả gửi, dọn dẹp
GRANT SELECT ON public.push_subscriptions TO wf_worker;
GRANT UPDATE (last_ok_at, fail_count, disabled_at) ON public.push_subscriptions TO wf_worker;
GRANT DELETE ON public.push_subscriptions TO wf_worker;
DROP POLICY IF EXISTS push_subscriptions_worker ON public.push_subscriptions;
CREATE POLICY push_subscriptions_worker ON public.push_subscriptions FOR ALL TO wf_worker USING (true) WITH CHECK (true);

GRANT SELECT ON public.push_preferences TO wf_worker;
DROP POLICY IF EXISTS push_preferences_worker ON public.push_preferences;
CREATE POLICY push_preferences_worker ON public.push_preferences FOR ALL TO wf_worker USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON public.push_outbox TO wf_worker;
GRANT UPDATE (status, attempts, next_attempt_at, last_error, sent_at) ON public.push_outbox TO wf_worker;
DROP POLICY IF EXISTS push_outbox_worker ON public.push_outbox;
CREATE POLICY push_outbox_worker ON public.push_outbox FOR ALL TO wf_worker USING (true) WITH CHECK (true);


-- ===== Hàm đặc quyền =====
-- Đăng ký (hoặc chuyển) một thiết bị cho người dùng hiện tại. Cùng endpoint đã thuộc người khác (máy dùng chung) ⇒ chuyển sang người này.
-- Tối đa 10 thiết bị/người: vượt ⇒ xóa thiết bị cũ nhất.
CREATE OR REPLACE FUNCTION app.fn_register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_uid uuid := app.current_user_id(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN PERFORM app.raise_wf('WF-AUTH-UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc.'); END IF;
  IF p_endpoint IS NULL OR p_endpoint NOT LIKE 'https://%' OR length(p_endpoint) > 1000 THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Địa chỉ nhận thông báo của thiết bị không hợp lệ.');
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
        created_at = CASE WHEN public.push_subscriptions.user_id = EXCLUDED.user_id THEN public.push_subscriptions.created_at ELSE now() END,
        fail_count = 0, disabled_at = NULL
  RETURNING id INTO v_id;
  DELETE FROM public.push_subscriptions WHERE id IN (
    SELECT id FROM public.push_subscriptions WHERE user_id = v_uid ORDER BY created_at DESC OFFSET 10);
  PERFORM app.fn_audit_event('push.subscribed', 'push_subscriptions', v_id::text, NULL,
    jsonb_build_object('userAgent', left(p_user_agent, 120)));
  RETURN v_id;
END $$;

-- Hủy đăng ký thiết bị CỦA MÌNH (theo endpoint). Trả true nếu có xóa.
CREATE OR REPLACE FUNCTION app.fn_remove_push_subscription(p_endpoint text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND user_id = app.current_user_id() RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN false; END IF;
  PERFORM app.fn_audit_event('push.unsubscribed', 'push_subscriptions', v_id::text, NULL, NULL);
  RETURN true;
END $$;

-- Đặt giờ yên tĩnh của chính mình (phút trong ngày, giờ Việt Nam)
CREATE OR REPLACE FUNCTION app.fn_set_push_preferences(p_quiet_enabled boolean, p_quiet_start integer, p_quiet_end integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_uid uuid := app.current_user_id();
BEGIN
  IF v_uid IS NULL THEN PERFORM app.raise_wf('WF-AUTH-UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc.'); END IF;
  IF p_quiet_start NOT BETWEEN 0 AND 1439 OR p_quiet_end NOT BETWEEN 0 AND 1439 THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Giờ yên tĩnh không hợp lệ.');
  END IF;
  INSERT INTO public.push_preferences (user_id, quiet_enabled, quiet_start, quiet_end) VALUES (v_uid, p_quiet_enabled, p_quiet_start, p_quiet_end)
  ON CONFLICT (user_id) DO UPDATE SET quiet_enabled = EXCLUDED.quiet_enabled, quiet_start = EXCLUDED.quiet_start,
                                      quiet_end = EXCLUDED.quiet_end, updated_at = now();
END $$;

-- Trigger: thông báo mới cho người có thiết bị đang bật ⇒ xếp hàng gửi đẩy
CREATE OR REPLACE FUNCTION app.tg_notification_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.user_id AND s.disabled_at IS NULL) THEN
    INSERT INTO public.push_outbox (notification_id, user_id) VALUES (NEW.id, NEW.user_id) ON CONFLICT (notification_id) DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.fn_register_push_subscription(text,text,text,text)','app.fn_remove_push_subscription(text)',
    'app.fn_set_push_preferences(boolean,integer,integer)','app.tg_notification_push()']
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.fn_register_push_subscription(text,text,text,text), app.fn_remove_push_subscription(text),
  app.fn_set_push_preferences(boolean,integer,integer) TO wf_app;
GRANT EXECUTE ON FUNCTION app.tg_notification_push() TO wf_definer, wf_worker, wf_app;

DROP TRIGGER IF EXISTS trg_notifications__push ON public.notifications;
CREATE TRIGGER trg_notifications__push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION app.tg_notification_push();

-- Audit trên push_preferences (không chứa bí mật)
DROP TRIGGER IF EXISTS trg_push_preferences__audit ON public.push_preferences;
CREATE TRIGGER trg_push_preferences__audit AFTER INSERT OR UPDATE OR DELETE ON public.push_preferences FOR EACH ROW EXECUTE FUNCTION app.tg_audit();

COMMIT;
