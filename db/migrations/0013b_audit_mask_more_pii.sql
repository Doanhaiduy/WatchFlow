-- 0013b — Che thêm PII bên thứ ba trong nhật ký: người bán trên phiếu thu mua (tên/SĐT), SĐT CTV. Mở rộng CQ-007.
-- Thông tin nhân viên (users) giữ nguyên để truy vết quản trị. Idempotent.
BEGIN;
CREATE OR REPLACE FUNCTION app.tg_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE
  masked text[] := ARRAY['password_hash','totp_secret_enc','id_number_enc','id_number_bidx','recovery_codes_hash','token_hash','search_text','id_number_last3']
    || CASE TG_TABLE_NAME
         WHEN 'customers' THEN ARRAY['full_name','phone','phone_norm','email','address','note']
         WHEN 'purchase_receipts' THEN ARRAY['seller_name','seller_phone']
         WHEN 'collaborator_profiles' THEN ARRAY['phone']
         ELSE ARRAY[]::text[] END;
  ignored text[] := coalesce(TG_ARGV::text[], '{}') || ARRAY['updated_at','version','updated_by','search_text'];
  o jsonb; n jsonb; b jsonb := '{}'; a jsonb := '{}'; k text; eid text;
BEGIN
  o := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END;
  n := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END;
  eid := coalesce(n->>'id', o->>'id', n->>'key', o->>'key', n->>'code', o->>'code');
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(n) LOOP
      IF (o->k) IS DISTINCT FROM (n->k) AND NOT (k = ANY(ignored)) THEN
        b := b || jsonb_build_object(k, CASE WHEN k = ANY(masked) THEN to_jsonb('***'::text) ELSE o->k END);
        a := a || jsonb_build_object(k, CASE WHEN k = ANY(masked) THEN to_jsonb('***'::text) ELSE n->k END);
      END IF;
    END LOOP;
    IF a = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSE
    IF o IS NOT NULL THEN b := o - masked; END IF;
    IF n IS NOT NULL THEN a := n - masked; END IF;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, before, after, request_id, ip_hash)
  VALUES (app.current_user_id(), lower(TG_OP), TG_TABLE_NAME, eid,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE b END, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE a END,
          app.request_id(), nullif(current_setting('app.ip_hash', true), ''));
  RETURN NULL;
END $$;
ALTER FUNCTION app.tg_audit() OWNER TO wf_definer;
REVOKE ALL ON FUNCTION app.tg_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_audit() TO wf_app, wf_auth, wf_worker, wf_definer;
COMMIT;
