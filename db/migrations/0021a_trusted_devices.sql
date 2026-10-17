-- 0021a — "Tin cậy thiết bị này N ngày" ở bước xác thực 2 bước (security-model §7). Áp lại nhiều lần không lỗi.
--
--   • Người dùng tick ở bước nhập mã 2FA ⇒ máy chủ cấp token ngẫu nhiên 256-bit nằm trong cookie httpOnly của thiết bị đó;
--     DB CHỈ giữ SHA-256 của token (token_hash). Trong N ngày (security.trusted_device_days, 0 = tắt) đăng nhập lại trên đúng thiết bị đó
--     vẫn phải ĐÚNG MẬT KHẨU nhưng không hỏi mã 6 số. Xác thực lại (reauth) cho thao tác nhạy cảm KHÔNG bao giờ bị bỏ qua.
--   • Gắn với MỘT tài khoản; hết hạn cố định (không gia hạn khi dùng); nhãn thiết bị (trình duyệt · hệ điều hành) phải trùng lúc tin cậy.
--   • Thu hồi tự động bằng trigger trên users: đổi/đặt lại mật khẩu, tài khoản bị khóa/vô hiệu, tắt/gỡ 2FA — mọi đường (người dùng tự làm,
--     chủ cửa hàng đặt lại, hàm fn_*) đều đi qua trigger này nên không thể sót. Người dùng tự thu hồi ở /cai-dat.
--   • Chỉ wf_auth (đường đăng nhập), wf_worker (dọn), wf_definer đụng bảng; wf_app KHÔNG đọc/ghi được.
--   • Không dùng tg_audit (UPDATE last_used_at mỗi lần dùng sẽ ồn): tầng ứng dụng ghi audit auth.device_trusted / auth.login_trusted /
--     auth.trusted_device_revoked; trigger thu hồi hàng loạt ghi auth.trusted_devices_revoked.

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id             uuid        PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  token_hash     text        NOT NULL,
  device_label   text,
  ip_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  revoked_reason text,
  CONSTRAINT ux_trusted_devices_token UNIQUE (token_hash),
  CONSTRAINT ck_trusted_devices_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_trusted_devices_ttl CHECK (expires_at > created_at AND expires_at <= created_at + interval '91 days'),
  CONSTRAINT ck_trusted_devices_revoke CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
COMMENT ON TABLE public.trusted_devices IS
  'Thiết bị được tin cậy ở bước 2FA: đăng nhập lại bằng mật khẩu trên thiết bị này không hỏi mã. token_hash = SHA-256 của token trong cookie httpOnly (DB không giữ token thô). Chỉ wf_auth/worker/definer truy cập.';
COMMENT ON COLUMN public.trusted_devices.device_label IS 'Nhãn trình duyệt · hệ điều hành lúc tin cậy; chỉ bỏ qua 2FA khi nhãn thiết bị đang dùng trùng nhãn này (chống mang cookie sang máy khác).';
CREATE INDEX IF NOT EXISTS ix_trusted_devices_user ON public.trusted_devices (user_id, expires_at) WHERE revoked_at IS NULL;

ALTER TABLE public.trusted_devices OWNER TO wf_owner;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_devices FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api, wf_definer;
GRANT SELECT, INSERT, DELETE ON public.trusted_devices TO wf_auth;
GRANT UPDATE (last_used_at, ip_hash, revoked_at, revoked_reason) ON public.trusted_devices TO wf_auth;
GRANT SELECT, DELETE ON public.trusted_devices TO wf_worker;
GRANT SELECT, UPDATE (revoked_at, revoked_reason) ON public.trusted_devices TO wf_definer;

DROP POLICY IF EXISTS trusted_devices_auth ON public.trusted_devices;
CREATE POLICY trusted_devices_auth ON public.trusted_devices FOR ALL TO wf_auth USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS trusted_devices_worker ON public.trusted_devices;
CREATE POLICY trusted_devices_worker ON public.trusted_devices FOR ALL TO wf_worker USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS trusted_devices_definer ON public.trusted_devices;
CREATE POLICY trusted_devices_definer ON public.trusted_devices FOR ALL TO wf_definer USING (true) WITH CHECK (true);

-- ===== Thu hồi tự động khi mật khẩu đổi / tài khoản không còn active / tắt 2FA =====
CREATE OR REPLACE FUNCTION app.tg_users_revoke_trusted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_reason text; v_n integer;
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN v_reason := 'password_changed';
  ELSIF OLD.status = 'active' AND NEW.status <> 'active' THEN v_reason := 'account_disabled';
  ELSIF OLD.mfa_enabled AND NOT NEW.mfa_enabled THEN v_reason := 'mfa_disabled';
  ELSE RETURN NULL;
  END IF;
  UPDATE public.trusted_devices SET revoked_at = now(), revoked_reason = v_reason WHERE user_id = NEW.id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, after, request_id, ip_hash, level)
    VALUES (coalesce(app.current_user_id(), NEW.id), 'auth.trusted_devices_revoked', 'users', NEW.id::text,
            jsonb_build_object('reason', v_reason, 'count', v_n), app.request_id(), nullif(current_setting('app.ip_hash', true), ''), 'high');
  END IF;
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_users_revoke_trusted() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_users_revoke_trusted() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_users__revoke_trusted ON public.users;
CREATE TRIGGER trg_users__revoke_trusted AFTER UPDATE OF password_hash, status, mfa_enabled ON public.users
  FOR EACH ROW WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.status IS DISTINCT FROM NEW.status OR OLD.mfa_enabled IS DISTINCT FROM NEW.mfa_enabled)
  EXECUTE FUNCTION app.tg_users_revoke_trusted();
