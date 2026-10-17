"use client";
import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { TextInput } from "../ui/TextInput";
import { errMsg, fieldErrors, sapi } from "./helpers";

/** Đổi mật khẩu: mật khẩu hiện tại + mới + nhập lại. Lỗi chính sách (quá yếu/trùng cũ) hiện ngay dưới ô mới. */
export function ChangePasswordForm({ onDone, submitLabel = "Đổi mật khẩu", onCancel }: { onDone: () => void; submitLabel?: string; onCancel?: () => void }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [again, setAgain] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (nw !== again) {
      setErrs({ again: "Hai lần nhập mật khẩu mới chưa giống nhau." });
      return;
    }
    setBusy(true);
    setErrs({});
    try {
      await sapi("/api/v1/auth/change-password", { body: { currentPassword: cur, newPassword: nw } });
      onDone();
    } catch (x) {
      const f = fieldErrors(x);
      setErrs(Object.keys(f).length ? f : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Mật khẩu hiện tại" required error={errs.currentPassword}>
        <TextInput data-autofocus type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới" required error={errs.newPassword} hint="Dài, khó đoán, không dùng lại mật khẩu cũ">
        <TextInput type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
      </Field>
      <Field label="Nhập lại mật khẩu mới" required error={errs.again}>
        <TextInput type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      {errs.form && (
        <p className="wf-fld-err" role="alert">
          {errs.form}
        </p>
      )}
      <div className="wf-modal-f">
        {onCancel && <Button onClick={onCancel}>Hủy</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={!cur || !nw || !again}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
