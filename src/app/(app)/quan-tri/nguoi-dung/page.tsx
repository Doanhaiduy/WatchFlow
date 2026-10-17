"use client";
import { Plus, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { CopyButton } from "@/components/auth/CopyButton";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { initials } from "@/components/layout/MenuSheet";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";
import { formatDateTimeVn } from "@/lib/dates";
import { normalizePhone } from "@/components/ui/PhoneInput";

type UserRow = {
  id: string; email: string; fullName: string; phone: string | null; status: "active" | "disabled";
  mustChangePassword: boolean; mfaEnabled: boolean; lastLoginAt: string | null; version: number; roles: string[];
};
type UsersRes = { items: UserRow[]; total: number; page: number; pageSize: number };
type Role = { id: string; code: string; nameVi: string; isActive: boolean };

const PAGE = 20;

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function RolePicker({ roles, value, onChange, error }: { roles: Role[]; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
      <legend className="wf-fld-label">Vai trò</legend>
      {roles.filter((r) => r.isActive).map((r) => (
        <Checkbox key={r.code} checked={value.includes(r.code)} onChange={(c) => onChange(c ? [...value, r.code] : value.filter((x) => x !== r.code))} label={r.nameVi} />
      ))}
      {error && <span className="wf-fld-err" role="alert">{error}</span>}
    </fieldset>
  );
}

function TempPassword({ title, password, onClose }: { title: string; password: string | null; onClose: () => void }) {
  return (
    <Modal open={!!password} onClose={onClose} title={title} locked footer={<Button variant="primary" onClick={onClose}>Tôi đã lưu</Button>}>
      <p className="wf-confirm-msg">
        Đưa mật khẩu tạm này cho người dùng. <b>Chỉ hiện một lần</b>; họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu.
      </p>
      <p className="wf-mono" style={{ fontSize: 20, textAlign: "center", padding: "14px 0" }}>{password}</p>
      <div style={{ textAlign: "center" }}>{password && <CopyButton text={password} label="Sao chép mật khẩu" sm={false} />}</div>
    </Modal>
  );
}

function CreateUser({ open, roles, onClose, onCreated }: { open: boolean; roles: Role[]; onClose: () => void; onCreated: (pw: string) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef("");
  useEffect(() => {
    if (open) {
      key.current = newIdempotencyKey(); // giữ nguyên khi bấm lại sau lỗi mạng
      setEmail(""); setName(""); setPhone(""); setSel([]); setErrs({});
    }
  }, [open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrs({});
    try {
      const r = await sapi<{ id: string; tempPassword: string }>("/api/v1/users", {
        body: { email, fullName: name, phone: phone || undefined, roles: sel },
        idempotencyKey: key.current,
      });
      onCreated(r.tempPassword);
    } catch (x) {
      const f = fieldErrors(x);
      if (Object.keys(f).length) setErrs(f);
      else toast.error("Không tạo được người dùng", errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Thêm người dùng">
      <form onSubmit={submit} noValidate>
        <Field label="Họ tên" required error={errs.fullName}>
          <TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email đăng nhập" required error={errs.email}>
          <TextInput type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Số điện thoại" error={errs.phone}>
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <RolePicker roles={roles} value={sel} onChange={setSel} error={errs.roles} />
        <p className="wf-mute">Hệ thống sẽ sinh mật khẩu tạm, hiện một lần sau khi tạo.</p>
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!email || !name || sel.length === 0}>Tạo</Button>
        </div>
      </form>
    </Modal>
  );
}

function UserDetail({
  user, roles, onClose, onChanged, onSub, hidden,
}: { user: UserRow; roles: Role[]; onClose: () => void; onChanged: () => Promise<unknown>; onSub: (s: "status" | "reset") => void; hidden: boolean }) {
  const toast = useToast();
  const { withReauth } = useReauth();
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(normalizePhone(user.phone ?? ""));
  const [email, setEmail] = useState(user.email);
  const [selRoles, setSelRoles] = useState(user.roles);
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "info" | "roles">("");
  // Đổi người dùng khác ⇒ nạp lại form
  useEffect(() => {
    setName(user.fullName); setPhone(normalizePhone(user.phone ?? "")); setEmail(user.email); setSelRoles(user.roles); setReason(""); setErrs({});
  }, [user.id, user.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveInfo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("info");
    setErrs({});
    try {
      await sapi(`/api/v1/users/${user.id}`, { method: "PATCH", ifMatch: user.version, body: { fullName: name, phone: phone || undefined, email } });
      await onChanged();
      toast.success("Đã lưu thông tin");
    } catch (x) {
      const f = fieldErrors(x);
      if (Object.keys(f).length) setErrs(f);
      else toast.error("Không lưu được", errMsg(x));
    } finally {
      setBusy("");
    }
  };
  const saveRoles = async () => {
    setBusy("roles");
    try {
      await withReauth(() => sapi(`/api/v1/users/${user.id}/roles`, { method: "PUT", body: { roles: selRoles, reason: reason || undefined } }));
      await onChanged();
      toast.success("Đã cập nhật vai trò");
    } catch (x) {
      if (!isReauthCancelled(x)) toast.error("Không đổi được vai trò", errMsg(x));
    } finally {
      setBusy("");
    }
  };
  const rolesChanged = selRoles.length > 0 && (selRoles.length !== user.roles.length || selRoles.some((r) => !user.roles.includes(r)));
  const disabled = user.status === "disabled";

  return (
    <Modal open={!hidden} onClose={onClose} title={user.fullName}>
      <div className="wf-dev-row" style={{ marginBottom: 10 }}>
        <StatusChip tone={disabled ? "bad" : "ok"}>{disabled ? "Đã khóa" : "Đang hoạt động"}</StatusChip>
        {user.mfaEnabled && <StatusChip tone="info">Bật 2 bước</StatusChip>}
        {user.mustChangePassword && <StatusChip tone="hold">Chờ đổi mật khẩu</StatusChip>}
      </div>
      <KeyValue items={[{ label: "Đăng nhập gần nhất", value: formatDateTimeVn(user.lastLoginAt) }]} />

      <form onSubmit={saveInfo} noValidate style={{ marginTop: 12 }}>
        <Field label="Họ tên" error={errs.fullName}><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" error={errs.email}><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Số điện thoại" error={errs.phone}><PhoneInput value={phone} onChange={setPhone} /></Field>
        <Button type="submit" block loading={busy === "info"} disabled={name === user.fullName && email === user.email && phone === normalizePhone(user.phone ?? "")}>
          Lưu thông tin
        </Button>
      </form>

      <h3 className="wf-sec" style={{ margin: "20px 4px 8px", fontSize: 16, fontWeight: 700 }}>Vai trò</h3>
      <RolePicker roles={roles} value={selRoles} onChange={setSelRoles} />
      {rolesChanged && (
        <Field label="Lý do đổi vai trò (tùy chọn)">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      )}
      <Button block loading={busy === "roles"} disabled={!rolesChanged} onClick={() => void saveRoles()}>
        Lưu vai trò (cần xác nhận lại)
      </Button>

      <h3 className="wf-sec" style={{ margin: "20px 4px 8px", fontSize: 16, fontWeight: 700 }}>Tài khoản</h3>
      <div className="wf-dev-row">
        <Button onClick={() => onSub("reset")}>Đặt lại mật khẩu</Button>
        <Button variant={disabled ? "primary" : "danger"} onClick={() => onSub("status")}>
          {disabled ? "Mở khóa" : "Khóa tài khoản"}
        </Button>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const toast = useToast();
  const { can } = useSession();
  const { withReauth } = useReauth();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq]);
  const { data, error, isLoading, mutate } = useSWR<UsersRes>(`/api/v1/users?page=${page}&pageSize=${PAGE}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`, swrFetcher, { keepPreviousData: true });
  const rolesRes = useSWR<{ items: Role[] }>("/api/v1/roles", swrFetcher);
  const roles = useMemo(() => rolesRes.data?.items ?? [], [rolesRes.data]);
  const roleName = (code: string) => roles.find((r) => r.code === code)?.nameVi ?? code;

  const [creating, setCreating] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [sub, setSub] = useState<"status" | "reset" | null>(null);
  const [temp, setTemp] = useState<{ title: string; pw: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = data?.items.find((u) => u.id === selId) ?? null;

  const doStatus = async (reason?: string) => {
    if (!sel) return;
    setBusy(true);
    try {
      await sapi(`/api/v1/users/${sel.id}/set-status`, { body: { status: sel.status === "active" ? "disabled" : "active", reason }, idempotencyKey: newIdempotencyKey() });
      await mutate();
      toast.success(sel.status === "active" ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
      setSub(null);
    } catch (e) {
      toast.error("Không đổi được trạng thái", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const doReset = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const key = newIdempotencyKey();
      const r = await withReauth(() => sapi<{ tempPassword: string }>(`/api/v1/users/${sel.id}/reset-password`, { method: "POST", idempotencyKey: key }));
      setSub(null);
      setTemp({ title: `Mật khẩu tạm của ${sel.fullName}`, pw: r.tempPassword });
      await mutate();
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không đặt lại được mật khẩu", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tài khoản nhân viên, quản lý kho, cộng tác viên"
        actions={can("user.manage") ? <Button variant="primary" sm icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>Thêm</Button> : undefined}
      />
      <RequirePerm perm="user.manage">
        <AdminTabs />
        <SearchBar value={q} onChange={setQ} placeholder="Tìm tên, email, SĐT…" />
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState
              variant={dq ? "search" : "plain"}
              title={dq ? `Không có người dùng khớp “${dq}”` : "Chưa có người dùng"}
              description={dq ? "Thử từ khóa khác." : "Bắt đầu bằng việc thêm người dùng đầu tiên."}
              icon={<UserRound size={24} aria-hidden="true" />}
              action={dq ? undefined : { label: "Thêm người dùng", onClick: () => setCreating(true) }}
            />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách người dùng">
              {data?.items.map((u) => (
                <InsetRow
                  key={u.id}
                  onClick={() => setSelId(u.id)}
                  icon={<span aria-hidden="true">{initials(u.fullName)}</span>}
                  tone={u.status === "active" ? "info" : "bad"}
                  title={u.fullName}
                  subtitle={`${u.email} · ${u.roles.map(roleName).join(", ") || "Chưa có vai trò"}`}
                  end={<StatusChip tone={u.status === "active" ? "ok" : "bad"}>{u.status === "active" ? "Hoạt động" : "Đã khóa"}</StatusChip>}
                  endSub={u.mfaEnabled ? "2 bước" : undefined}
                />
              ))}
            </InsetList>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}

        <CreateUser
          open={creating}
          roles={roles}
          onClose={() => setCreating(false)}
          onCreated={(pw) => {
            setCreating(false);
            setTemp({ title: "Đã tạo người dùng", pw });
            void mutate();
          }}
        />
        {sel && <UserDetail user={sel} roles={roles} hidden={!!sub || !selId} onClose={() => setSelId(null)} onChanged={() => mutate()} onSub={setSub} />}
        <ConfirmDialog
          open={sub === "status" && !!sel}
          danger={sel?.status === "active"}
          requireReason
          loading={busy}
          title={sel?.status === "active" ? `Khóa tài khoản ${sel?.fullName}?` : `Mở khóa tài khoản ${sel?.fullName}?`}
          message={sel?.status === "active" ? "Người này sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho đến khi mở khóa." : "Người này sẽ đăng nhập lại được bằng mật khẩu hiện có."}
          confirmLabel={sel?.status === "active" ? "Khóa" : "Mở khóa"}
          onCancel={() => setSub(null)}
          onConfirm={(r) => void doStatus(r)}
        />
        <ConfirmDialog
          open={sub === "reset" && !!sel}
          danger
          loading={busy}
          title={`Đặt lại mật khẩu cho ${sel?.fullName}?`}
          message="Mật khẩu cũ mất hiệu lực, người này phải đổi mật khẩu ở lần đăng nhập kế tiếp. Cần xác nhận lại mật khẩu của bạn."
          confirmLabel="Đặt lại"
          onCancel={() => setSub(null)}
          onConfirm={() => void doReset()}
        />
        <TempPassword title={temp?.title ?? ""} password={temp?.pw ?? null} onClose={() => setTemp(null)} />
      </RequirePerm>
    </>
  );
}
