"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { RETIRED_SETTINGS } from "@/lib/settings-catalog";

type Item = { key: string; value: unknown; label: string; group: string; updatedAt: string };

const LONG = /(terms|footer|address)$/;
/** Thứ tự hiển thị trong nhóm (khóa chưa liệt kê giữ thứ tự theo khóa) */
const rank = (_k: string) => 999;
const toText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));

function SettingRow({ item, canEdit, onSave }: { item: Item; canEdit: boolean; onSave: (key: string, value: unknown) => Promise<void> }) {
  const orig = toText(item.value);
  const [text, setText] = useState(orig);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = item.value;

  if (typeof v === "boolean") {
    return <Switch checked={v} onChange={(c) => void onSave(item.key, c).catch(() => {})} label={item.label} disabled={!canEdit} />;
  }
  if (v === null) return null; // chưa hỗ trợ (vd. logo — có ở bản sau)

  const dirty = text !== orig;
  const save = async () => {
    let value: unknown = text;
    if (typeof v === "number") {
      const n = Number(text.replace(",", "."));
      if (text.trim() === "" || !Number.isFinite(n)) return setErr("Nhập một số hợp lệ");
      value = n;
    } else if (Array.isArray(v)) {
      value = text.split(",").map((s) => s.trim()).filter(Boolean);
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(item.key, value);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  let control;
  if (typeof v === "string" && LONG.test(item.key)) control = <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={!canEdit} />;
  else control = <TextInput value={text} inputMode={typeof v === "number" ? "decimal" : undefined} onChange={(e) => setText(e.target.value)} disabled={!canEdit} />;

  return (
    <Field label={item.label} error={err} hint={Array.isArray(v) ? "Nhập các giá trị cách nhau bằng dấu phẩy" : `Cập nhật ${formatDateTimeVn(item.updatedAt)}`}>
      {control}
      {canEdit && dirty && (
        <div className="wf-dev-row" style={{ marginTop: 8 }}>
          <Button sm onClick={() => { setText(orig); setErr(null); }} disabled={busy}>Hoàn tác</Button>
          <Button sm variant="primary" loading={busy} onClick={() => void save()}>Lưu</Button>
        </div>
      )}
    </Field>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { can } = useSession();
  const { withReauth } = useReauth();
  const canEdit = can("settings.manage");
  const { data, error, isLoading, mutate } = useSWR<{ items: Item[] }>(can("settings.view") ? "/api/v1/settings" : null, swrFetcher);

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of (data?.items ?? []).filter((x) => !RETIRED_SETTINGS.has(x.key))) m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return [...m.entries()].map(([g, items]) => [g, [...items].sort((a, b) => rank(a.key) - rank(b.key))] as [string, Item[]]);
  }, [data]);

  const save = async (key: string, value: unknown) => {
    try {
      await withReauth(() => sapi("/api/v1/settings", { method: "PATCH", body: { key, value } }));
      await mutate();
      toast.success("Đã lưu cài đặt");
    } catch (e) {
      if (isReauthCancelled(e)) return;
      toast.error("Không lưu được cài đặt", errMsg(e));
      throw e;
    }
  };

  return (
    <>
      <PageHeader title="Cài đặt" description={canEdit ? "Thay đổi có hiệu lực ngay" : "Bạn chỉ được xem"} />
      <RequirePerm perm="settings.view">
        <AdminTabs />
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : (
          <div className="wf-stack">
            {groups.map(([group, items]) => (
              <section key={group} className="g wf-pad" aria-label={group}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{group}</h2>
                {items.map((it) => (
                  <SettingRow key={`${it.key}:${it.updatedAt}`} item={it} canEdit={canEdit} onSave={save} />
                ))}
              </section>
            ))}
          </div>
        )}
      </RequirePerm>
    </>
  );
}
