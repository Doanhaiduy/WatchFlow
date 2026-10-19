"use client";
import { Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { Button } from "@/components/ui/Button";
import { Checkbox, Switch } from "@/components/ui/Checkbox";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { MODULE_LABELS, RETIRED_PERMISSIONS } from "@/lib/permissions";
import { useSession } from "@/lib/session";

type Role = { id: string; code: string; nameVi: string; description: string | null; isSystem: boolean; maxDiscountPct: number; isActive: boolean; version: number; permissions: string[] };
type Perm = { code: string; module: string; nameVi: string; isSensitive: boolean };

/** Vai trò chủ: không cho tắt hai quyền giữ khóa hệ thống (tránh tự khóa mình ra ngoài) */
const OWNER_LOCKED = ["user.manage", "role.manage"];

function CreateRole({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const { withReauth } = useReauth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [pct, setPct] = useState("0");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setCode(""); setName(""); setDesc(""); setPct("0"); setErrs({}); }
  }, [open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      const r = await withReauth(() => sapi<{ id: string }>("/api/v1/roles", { body: { code, nameVi: name, description: desc || undefined, maxDiscountPct: Number(pct) || 0 } }));
      toast.success("Đã tạo vai trò");
      onCreated(r.id);
    } catch (x) {
      if (isReauthCancelled(x)) return;
      const f = fieldErrors(x);
      if (Object.keys(f).length) setErrs(f);
      else toast.error("Không tạo được vai trò", errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Thêm vai trò">
      <form onSubmit={submit} noValidate>
        <Field label="Tên vai trò" required error={errs.nameVi}><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Mã vai trò" required hint="Chữ thường, số, gạch dưới. Không đổi được sau này." error={errs.code}>
          <TextInput value={code} autoCapitalize="none" onChange={(e) => setCode(e.target.value.toLowerCase())} />
        </Field>
        <Field label="Mô tả"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="Giảm giá tối đa (%)" error={errs.maxDiscountPct}><TextInput inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} suffix="%" /></Field>
        <p className="wf-mute">Tạo xong, chọn các quyền cho vai trò ở bảng bên dưới. Cần xác nhận lại mật khẩu.</p>
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!code || !name}>Tạo</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RolesPage() {
  const toast = useToast();
  const { can } = useSession();
  const { withReauth } = useReauth();
  const manage = can("role.manage");
  const roles = useSWR<{ items: Role[] }>("/api/v1/roles", swrFetcher);
  const perms = useSWR<{ items: Perm[] }>("/api/v1/permissions", swrFetcher);
  const [selId, setSelId] = useState<string | null>(null);
  const role = useMemo(() => roles.data?.items.find((r) => r.id === selId) ?? roles.data?.items[0] ?? null, [roles.data, selId]);

  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [pct, setPct] = useState("0");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState<"" | "perms" | "meta">("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!role) return;
    setDraft(new Set(role.permissions));
    setName(role.nameVi);
    setDesc(role.description ?? "");
    setPct(String(role.maxDiscountPct));
    setActive(role.isActive);
  }, [role?.id, role?.version, role?.permissions.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const m = new Map<string, Perm[]>();
    for (const p of (perms.data?.items ?? []).filter((x) => !RETIRED_PERMISSIONS.has(x.code))) m.set(p.module, [...(m.get(p.module) ?? []), p]);
    const order = Object.keys(MODULE_LABELS);
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 100) % 100 - (order.indexOf(b[0]) + 100) % 100);
  }, [perms.data]);

  const isOwner = role?.code === "owner";
  const permDirty = !!role && (draft.size !== role.permissions.length || role.permissions.some((c) => !draft.has(c)));
  const pctNum = Number(pct.replace(",", "."));
  const metaDirty = !!role && (name !== role.nameVi || desc !== (role.description ?? "") || pctNum !== role.maxDiscountPct || active !== role.isActive);
  const pctBad = !Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100;

  const savePerms = async () => {
    if (!role) return;
    setBusy("perms");
    try {
      await withReauth(() => sapi(`/api/v1/roles/${role.id}/permissions`, { method: "PUT", body: { permissions: [...draft].sort() } }));
      await roles.mutate();
      toast.success("Đã lưu quyền của vai trò", "Người dùng áp dụng ở lần đăng nhập/làm mới kế tiếp");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không lưu được quyền", errMsg(e));
    } finally {
      setBusy("");
    }
  };
  const saveMeta = async () => {
    if (!role) return;
    setBusy("meta");
    try {
      await withReauth(() => sapi(`/api/v1/roles/${role.id}`, { method: "PATCH", body: { nameVi: name, description: desc, maxDiscountPct: pctNum, isActive: active } }));
      await roles.mutate();
      toast.success("Đã lưu thông tin vai trò");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error("Không lưu được", errMsg(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <PageHeader
        title="Vai trò & quyền"
        description="Quyền kiểm theo từng chức năng, không theo tên vai trò"
        actions={manage ? <Button variant="primary" sm icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>Thêm</Button> : undefined}
      />
      <RequirePerm perm={["role.manage", "user.manage", "settings.view", "audit.view", "system.health"]}>
        <AdminTabs />
        {roles.isLoading || perms.isLoading ? (
          <SkeletonGroup className="wf-stack"><Skeleton h={44} radius={22} /><Skeleton h={220} radius={26} /></SkeletonGroup>
        ) : roles.error || perms.error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(roles.error ?? perms.error)} onRetry={async () => (await Promise.all([roles.mutate(), perms.mutate()]), true)} /></div>
        ) : role ? (
          <>
            <FilterChips ariaLabel="Chọn vai trò" value={[role.id]} onChange={(v) => v[0] && setSelId(v[0])} options={(roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.isActive ? r.nameVi : `${r.nameVi} (tắt)` }))} />

            <section className="g wf-pad" aria-label="Thông tin vai trò">
              <div className="wf-dev-row" style={{ marginBottom: 8 }}>
                {role.isSystem && <StatusChip tone="info">Vai trò hệ thống</StatusChip>}
                <StatusChip tone={role.isActive ? "ok" : "neutral"}>{role.isActive ? "Đang dùng" : "Đã tắt"}</StatusChip>
                <span className="wf-mute">mã: {role.code}</span>
              </div>
              <Field label="Tên vai trò"><TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!manage} /></Field>
              <Field label="Mô tả"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!manage} /></Field>
              <Field label="Giảm giá tối đa khi bán (%)" error={pctBad ? "Nhập số từ 0 đến 100" : undefined}>
                <TextInput inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} suffix="%" disabled={!manage} />
              </Field>
              <Switch checked={active} onChange={setActive} label="Đang sử dụng" description="Tắt để không gán vai trò này cho người mới" disabled={!manage || role.isSystem} />
              {manage && (
                <Button block style={{ marginTop: 10 }} loading={busy === "meta"} disabled={!metaDirty || pctBad || !name.trim()} onClick={() => void saveMeta()}>
                  Lưu thông tin (cần xác nhận lại)
                </Button>
              )}
            </section>

            <div className="wf-sec"><h3>Quyền ({draft.size})</h3></div>
            {isOwner && <p className="wf-mute" style={{ margin: "0 8px 10px" }}>Vai trò Chủ cửa hàng luôn giữ quyền quản lý người dùng và vai trò để không tự khóa mình.</p>}
            <div className="wf-stack">
              {groups.map(([mod, list]) => (
                <section key={mod} className="g wf-pad" aria-label={MODULE_LABELS[mod] ?? mod}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{MODULE_LABELS[mod] ?? mod}</h4>
                  {list.map((p) => {
                    const locked = isOwner && OWNER_LOCKED.includes(p.code);
                    return (
                      <div key={p.code} className="wf-perm">
                        <Checkbox
                          checked={draft.has(p.code)}
                          disabled={!manage || locked}
                          onChange={(c) =>
                            setDraft((d) => {
                              const n = new Set(d);
                              if (c) n.add(p.code); else n.delete(p.code);
                              return n;
                            })
                          }
                          label={<span>{p.nameVi}<small className="wf-mute" style={{ display: "block", fontSize: 11 }}>{p.code}</small></span>}
                        />
                        {locked && <Lock size={16} aria-label="Không tắt được" />}
                        {p.isSensitive && <StatusChip tone="hold">Nhạy cảm</StatusChip>}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
            {manage && permDirty && (
              <div className="wf-sticky-save g" role="region" aria-label="Lưu thay đổi quyền">
                <span style={{ fontWeight: 600 }}>Có thay đổi chưa lưu</span>
                <span className="wf-dev-row">
                  <Button sm onClick={() => setDraft(new Set(role.permissions))} disabled={busy === "perms"}>Hoàn tác</Button>
                  <Button sm variant="primary" loading={busy === "perms"} onClick={() => void savePerms()}>Lưu quyền</Button>
                </span>
              </div>
            )}
          </>
        ) : null}
        <CreateRole open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelId(id); void roles.mutate(); }} />
      </RequirePerm>
    </>
  );
}
