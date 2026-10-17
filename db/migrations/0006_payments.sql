-- 0006_payments.sql — Tiền & thanh toán tối giản (CF-07, money-and-payments): app.round_vnd, app.allocate_vnd (khớp src/lib/money.ts),
-- bảng payments (bất biến trừ cột hủy), app.doc_payment_state (bộ điều phối "phải thu/đã trả" theo loại chứng từ — mốc sau bổ sung nhánh),
-- fn_record_payment, fn_void_payment. BR-PAY-01…07, BR-GEN-01/06, SC-11, CT-05. Không quỹ/sổ cái/kỳ. Idempotent.
BEGIN;

-- ===== Làm tròn & phân bổ (costing-and-profit §5) =====
CREATE OR REPLACE FUNCTION app.round_vnd(x numeric) RETURNS bigint LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN x >= 0 THEN floor(x + 0.5) ELSE -floor(-x + 0.5) END::bigint
$$;

-- base_i = floor(total*w_i/Σw) (hoặc floor(total/n) khi 'equal' hoặc Σw=0); dư cộng vào trọng số lớn nhất, hòa ⇒ dòng đầu
CREATE OR REPLACE FUNCTION app.allocate_vnd(p_total bigint, p_weights bigint[], p_method text DEFAULT 'by_value') RETURNS bigint[]
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE n int := coalesce(array_length(p_weights, 1), 0); s numeric := 0; res bigint[] := '{}'; i int; maxi int := 1; rem bigint;
BEGIN
  IF p_total IS NULL OR p_total < 0 THEN RAISE EXCEPTION 'allocate_vnd: tổng không hợp lệ'; END IF;
  IF n = 0 THEN
    IF p_total <> 0 THEN RAISE EXCEPTION 'allocate_vnd: không có dòng'; END IF;
    RETURN res;
  END IF;
  FOR i IN 1..n LOOP
    IF p_weights[i] IS NULL OR p_weights[i] < 0 THEN RAISE EXCEPTION 'allocate_vnd: trọng số âm'; END IF;
    s := s + p_weights[i];
    IF p_weights[i] > p_weights[maxi] THEN maxi := i; END IF;
  END LOOP;
  FOR i IN 1..n LOOP
    res := res || CASE WHEN p_method = 'equal' OR s = 0 THEN floor(p_total::numeric / n) ELSE floor(p_total::numeric * p_weights[i] / s) END::bigint;
  END LOOP;
  rem := p_total - (SELECT sum(x) FROM unnest(res) x);
  res[maxi] := res[maxi] + rem;
  RETURN res;
END $$;

-- ===== payments =====
CREATE TABLE IF NOT EXISTS public.payments (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code          text NOT NULL UNIQUE,
  direction     text NOT NULL CHECK (direction IN ('in','out')),
  purpose       text NOT NULL CHECK (purpose IN ('sale_receipt','repair_receipt','deposit_receipt','collab_settlement','deposit_refund','repair_deposit_refund')),
  method        text NOT NULL CHECK (method IN ('cash','bank_transfer')),
  amount_vnd    bigint NOT NULL CHECK (amount_vnd > 0),
  doc_date      date NOT NULL,
  doc_type      text NOT NULL CHECK (doc_type IN ('sale','repair','reservation','settlement')),
  doc_id        uuid NOT NULL,
  customer_id   uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  note          text,
  cash_tendered_vnd bigint CHECK (cash_tendered_vnd IS NULL OR cash_tendered_vnd >= amount_vnd),
  status        text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  voided_at     timestamptz,
  voided_by     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  void_reason   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  -- purpose ↔ doc_type ↔ direction (I1)
  CONSTRAINT payments_purpose_doc CHECK (
    (purpose = 'sale_receipt' AND doc_type = 'sale' AND direction = 'in') OR
    (purpose = 'repair_receipt' AND doc_type = 'repair' AND direction = 'in') OR
    (purpose = 'deposit_receipt' AND doc_type = 'reservation' AND direction = 'in') OR
    (purpose = 'collab_settlement' AND doc_type = 'settlement' AND direction = 'in') OR
    (purpose = 'deposit_refund' AND doc_type = 'reservation' AND direction = 'out') OR
    (purpose = 'repair_deposit_refund' AND doc_type = 'repair' AND direction = 'out')),
  CONSTRAINT payments_void_fields CHECK ((status = 'voided') = (voided_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_payments_doc ON public.payments (doc_type, doc_id);
CREATE INDEX IF NOT EXISTS ix_payments_date ON public.payments (doc_date);
CREATE INDEX IF NOT EXISTS ix_payments_customer ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS ix_payments_created_by ON public.payments (created_by);
CREATE INDEX IF NOT EXISTS ix_payments_voided_by ON public.payments (voided_by);

ALTER TABLE public.payments OWNER TO wf_owner;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api;
GRANT SELECT, INSERT, UPDATE ON public.payments TO wf_definer;
GRANT SELECT ON public.payments TO wf_worker, wf_backup, wf_app;

-- Đọc: debt.view/payment.create ⇒ tất cả; CTV chỉ thanh toán quyết toán của mình (nhánh thêm ở M5b qua app.payment_visible)
CREATE OR REPLACE FUNCTION app.payment_visible(p_doc_type text, p_doc_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  RETURN app.has_any_permission(ARRAY['debt.view','payment.create','payment.void']);
END $$;
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO wf_app USING (app.payment_visible(doc_type, doc_id));

-- Bất biến (B7): chỉ được chuyển posted → voided (cột hủy); không xóa/không sửa số tiền
CREATE OR REPLACE FUNCTION app.tg_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM app.raise_wf('WF-IMMUTABLE', 'Không được xóa thanh toán — hãy hủy có lý do.'); END IF;
  IF (to_jsonb(NEW) - ARRAY['status','voided_at','voided_by','void_reason']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','voided_at','voided_by','void_reason'])
     OR OLD.status = 'voided' OR NEW.status <> 'voided' THEN
    PERFORM app.raise_wf('WF-IMMUTABLE', 'Thanh toán đã ghi không được sửa — hãy hủy rồi ghi lại.');
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION app.tg_payment_guard() OWNER TO wf_owner;
DROP TRIGGER IF EXISTS trg_payments__guard ON public.payments;
CREATE TRIGGER trg_payments__guard BEFORE UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION app.tg_payment_guard();
DROP TRIGGER IF EXISTS trg_payments__no_truncate ON public.payments;
CREATE TRIGGER trg_payments__no_truncate BEFORE TRUNCATE ON public.payments FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate();
DROP TRIGGER IF EXISTS trg_payments__audit ON public.payments;
CREATE TRIGGER trg_payments__audit AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION app.tg_audit();

-- ===== Kiểm ngày chứng từ (BR-GEN-08) =====
CREATE OR REPLACE FUNCTION app.check_doc_date(p_date date, p_reason text DEFAULT NULL) RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE d date := coalesce(p_date, app.today_vn()); maxd int := app.setting_int('doc.max_backdate_days', 7);
BEGIN
  IF d > app.today_vn() THEN PERFORM app.raise_wf('WF-DOC-FUTURE', 'Ngày chứng từ không được ở tương lai.'); END IF;
  IF app.today_vn() - d > maxd THEN
    IF NOT app.has_permission('doc.backdate') THEN
      PERFORM app.raise_wf('WF-DOC-BACKDATE', format('Chỉ được ghi lùi ngày tối đa %s ngày. Người có quyền ghi lùi phải nhập lý do.', maxd));
    END IF;
    PERFORM app.require_reason(p_reason);
  END IF;
  RETURN d;
END $$;

-- ===== Trạng thái tiền của chứng từ (khóa dòng chứng từ khi p_lock) =====
-- Trả {exists, open (nhận thanh toán được), customer_id, payable, paid_net, refundable}. Mốc M5a/M5b/M6 thay hàm này bổ sung nhánh.
CREATE OR REPLACE FUNCTION app.doc_payment_state(p_doc_type text, p_doc_id uuid, p_lock boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  RETURN jsonb_build_object('exists', false);
END $$;

-- Ghi thanh toán (BR-PAY-01/03): khóa chứng từ → tính lại phải thu/đã trả từ dữ liệu → không vượt → chèn. CT-05.
CREATE OR REPLACE FUNCTION app.fn_record_payment(p_doc_type text, p_doc_id uuid, p_purpose text, p_method text, p_amount bigint,
                                                 p_doc_date date DEFAULT NULL, p_note text DEFAULT NULL, p_cash_tendered bigint DEFAULT NULL,
                                                 p_backdate_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE st jsonb; v_dir text; v_code text; v_id uuid; v_date date; v_room bigint;
BEGIN
  IF p_purpose = 'collab_settlement' THEN PERFORM app.require_permission('collab.manage'); ELSE PERFORM app.require_permission('payment.create'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Số tiền phải lớn hơn 0.'); END IF;
  IF p_method NOT IN ('cash','bank_transfer') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Phương thức thanh toán không hợp lệ.'); END IF;
  v_dir := CASE WHEN p_purpose IN ('deposit_refund','repair_deposit_refund') THEN 'out' ELSE 'in' END;
  v_date := app.check_doc_date(p_doc_date, p_backdate_reason);
  SET LOCAL lock_timeout = '5s';
  st := app.doc_payment_state(p_doc_type, p_doc_id, true);
  IF NOT coalesce((st->>'exists')::boolean, false) THEN PERFORM app.raise_wf('WF-PAY-DOC-INVALID', 'Chứng từ không tồn tại hoặc không nhận thanh toán.'); END IF;
  IF NOT coalesce((st->>'open')::boolean, false) THEN PERFORM app.raise_wf('WF-PAY-DOC-INVALID', 'Chứng từ ở trạng thái không nhận thanh toán.'); END IF;
  IF v_dir = 'in' THEN
    v_room := (st->>'payable')::bigint - (st->>'paid_net')::bigint;
    IF p_amount > v_room THEN
      PERFORM app.raise_wf('WF-PAY-OVERPAY', format('Số tiền vượt số còn phải thu (%s ₫).', to_char(greatest(v_room, 0), 'FM999G999G999G999')));
    END IF;
  ELSE
    IF p_amount > coalesce((st->>'refundable')::bigint, 0) THEN
      PERFORM app.raise_wf('WF-PAY-OVERPAY', 'Số tiền hoàn vượt số tiền đang giữ.');
    END IF;
  END IF;
  IF p_cash_tendered IS NOT NULL AND (p_method <> 'cash' OR p_cash_tendered < p_amount) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Tiền khách đưa chỉ áp dụng cho tiền mặt và phải ≥ số tiền thu.');
  END IF;
  v_code := app.fn_next_number('PT');
  INSERT INTO public.payments (code, direction, purpose, method, amount_vnd, doc_date, doc_type, doc_id, customer_id, note, cash_tendered_vnd, created_by)
  VALUES (v_code, v_dir, p_purpose, p_method, p_amount, v_date, p_doc_type, p_doc_id, nullif(st->>'customer_id', '')::uuid, p_note, p_cash_tendered, app.current_user_id())
  RETURNING id INTO v_id;
  PERFORM app.fn_emit_event('payment.posted', jsonb_build_object('paymentId', v_id, 'docType', p_doc_type, 'docId', p_doc_id, 'amount', p_amount));
  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'amount', p_amount, 'change', CASE WHEN p_cash_tendered IS NOT NULL THEN p_cash_tendered - p_amount ELSE 0 END);
END $$;

-- Hủy thanh toán (lý do ≥ 10, payment.void). Chứng từ tự tính lại còn nợ.
CREATE OR REPLACE FUNCTION app.fn_void_payment(p_payment uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE p record; v_reason text; st jsonb;
BEGIN
  PERFORM app.require_permission('payment.void');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  SELECT * INTO p FROM public.payments WHERE id = p_payment;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy thanh toán.'); END IF;
  st := app.doc_payment_state(p.doc_type, p.doc_id, true);       -- khóa chứng từ trước (thứ tự khóa §2)
  SELECT * INTO p FROM public.payments WHERE id = p_payment FOR UPDATE;
  IF p.status = 'voided' THEN PERFORM app.raise_wf('WF-PAY-VOIDED', 'Thanh toán này đã bị hủy.'); END IF;
  IF p.direction = 'in' AND coalesce((st->>'locked_payments')::boolean, false) THEN
    PERFORM app.raise_wf('WF-PAY-DOC-INVALID', 'Thanh toán của chứng từ này không hủy riêng được (hãy hủy chứng từ).');
  END IF;
  -- Hủy khoản thu không được làm "đã trả" âm so với phần đã hoàn/áp dụng
  IF p.direction = 'in' AND coalesce((st->>'refundable')::bigint, (st->>'paid_net')::bigint) < p.amount_vnd AND p.doc_type IN ('reservation','repair') THEN
    PERFORM app.raise_wf('WF-PAY-DOC-INVALID', 'Không thể hủy: phần tiền này đã được hoàn hoặc trừ vào chứng từ khác.');
  END IF;
  UPDATE public.payments SET status = 'voided', voided_at = now(), voided_by = app.current_user_id(), void_reason = v_reason WHERE id = p_payment;
  PERFORM app.fn_audit_event('payment.voided', 'payments', p_payment::text, jsonb_build_object('status', 'posted'), jsonb_build_object('status', 'voided'), v_reason, 'high');
  PERFORM app.fn_emit_event('payment.voided', jsonb_build_object('paymentId', p_payment));
  RETURN jsonb_build_object('id', p_payment, 'status', 'voided');
END $$;

-- ===== Sở hữu / EXECUTE =====
ALTER FUNCTION app.round_vnd(numeric) OWNER TO wf_owner;
ALTER FUNCTION app.allocate_vnd(bigint, bigint[], text) OWNER TO wf_owner;
REVOKE ALL ON FUNCTION app.round_vnd(numeric), app.allocate_vnd(bigint, bigint[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.round_vnd(numeric), app.allocate_vnd(bigint, bigint[], text) TO wf_app, wf_worker, wf_definer;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.payment_visible(text,uuid)','app.check_doc_date(date,text)','app.doc_payment_state(text,uuid,boolean)',
    'app.fn_record_payment(text,uuid,text,text,bigint,date,text,bigint,text)','app.fn_void_payment(uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION app.tg_payment_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.tg_payment_guard() TO wf_app, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.payment_visible(text,uuid), app.check_doc_date(date,text) TO wf_app, wf_definer;
GRANT EXECUTE ON FUNCTION app.doc_payment_state(text,uuid,boolean) TO wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_record_payment(text,uuid,text,text,bigint,date,text,bigint,text), app.fn_void_payment(uuid,text) TO wf_app;

COMMIT;
