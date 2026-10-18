"use client";
import { Bookmark, FileSpreadsheet, Plus, Receipt, Tags, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Customer, CustomerGroup } from "@/components/catalog/types";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatStrip } from "@/components/ui/StatStrip";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { formatVndShort } from "@/lib/money";
import { hasKpi, useDashKpis } from "@/lib/use-dashboard";
import { useSession } from "@/lib/session";

type Res = { items: Customer[]; total: number; page: number; pageSize: number };
const PAGE = 25;

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function GroupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const groups = useSWR<{ items: CustomerGroup[] }>(open ? "/api/v1/customer-groups" : null, swrFetcher);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      await groups.mutate();
      toast.success(ok);
    } catch (e) {
      toast.error("Không lưu được", errMsg(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nhóm khách">
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
        <TextInput aria-label="Tên nhóm mới" placeholder="Tên nhóm mới (vd. Khách quen, VIP)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="primary" loading={busy === "new"} disabled={!name.trim()} onClick={() => void act("new", async () => { await sapi("/api/v1/customer-groups", { body: { name: name.trim() } }); setName(""); }, "Đã thêm nhóm")}>Thêm</Button>
      </div>
      {groups.isLoading ? <SkeletonList rows={3} /> : (groups.data?.items ?? []).map((g) => {
        const v = edit[g.id] ?? g.name;
        return (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <TextInput aria-label={`Tên nhóm ${g.name}`} value={v} onChange={(e) => setEdit({ ...edit, [g.id]: e.target.value })} />
              <Button disabled={v.trim() === g.name || !v.trim()} loading={busy === g.id} onClick={() => void act(g.id, () => sapi(`/api/v1/customer-groups/${g.id}`, { method: "PATCH", body: { name: v.trim() } }), "Đã đổi tên nhóm")}>Lưu</Button>
            </div>
            <Switch checked={g.isActive} label={`${g.customerCount} khách`} onChange={(a) => void act(g.id + "a", () => sapi(`/api/v1/customer-groups/${g.id}`, { method: "PATCH", body: { isActive: a } }), a ? "Đã bật nhóm" : "Đã tắt nhóm")} />
          </div>
        );
      })}
    </Modal>
  );
}

export default function CustomersPage() {
  const { can } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, group]);
  const allowed = can(["customer.view", "customer.view_own"]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (group) p.set("groupId", group);
  const { data, error, isLoading, mutate } = useSWR<Res>(allowed ? `/api/v1/customers?${p}` : null, swrFetcher, { keepPreviousData: true });
  const groups = useSWR<{ items: CustomerGroup[] }>(allowed ? "/api/v1/customer-groups" : null, swrFetcher);
  const [form, setForm] = useState(false);
  const [gm, setGm] = useState(false);
  const { kpis } = useDashKpis(allowed);

  // Mở sẵn form khi vào từ nút "+" (?moi=1)
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("moi") === "1" && can("customer.create")) setForm(true);
  }, [can]);

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Thông tin liên hệ, đồng hồ của khách, lịch sử mua"
        actions={(<>{can("customer.manage") && <Button sm icon={<Tags size={16} aria-hidden="true" />} onClick={() => setGm(true)}>Nhóm</Button>}{can("customer.create") && <Button sm href="/nhap-excel?loai=khach" icon={<FileSpreadsheet size={16} aria-hidden="true" />}>Nhập Excel</Button>}{can("customer.create") && <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setForm(true)}>Thêm</Button>}</>)}
      />
      <RequirePerm perm={["customer.view", "customer.view_own"]}>
        <StatStrip
          items={[
            data && { label: "Khách hàng", value: data.total, icon: <Users size={16} />, tone: "info", hint: dq || group ? "khớp bộ lọc" : "đang quản lý" },
            hasKpi(kpis, "customerDue") && { label: "Khách còn nợ", value: formatVndShort(kpis.customerDue!), icon: <Receipt size={16} />, tone: "hold", hint: "tổng các phiếu nợ", href: can("sale.view") ? "/ban-hang" : undefined },
            hasKpi(kpis, "depositsHeld") && { label: "Cọc đang giữ", value: formatVndShort(kpis.depositsHeld!), icon: <Bookmark size={16} />, tone: "check", hint: "giữ hàng cho khách", href: can("reservation.manage") ? "/giu-hang" : undefined },
            groups.data && { label: "Nhóm khách", value: groups.data.items.length, icon: <Tags size={16} />, tone: "repair", hint: "VIP, khách quen…" },
          ]}
        />
        <SearchBar value={q} onChange={setQ} placeholder="Tìm tên hoặc số điện thoại…" />
        <div style={{ marginBottom: 12 }}>
          <Select aria-label="Lọc theo nhóm" placeholder="Mọi nhóm khách" value={group} onChange={(e) => setGroup(e.target.value)} options={(groups.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        </div>
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={dq || group ? "search" : "plain"} icon={<Users size={24} />} title={dq || group ? "Không có khách khớp" : "Bạn chưa có khách hàng"} description={dq || group ? "Thử số điện thoại khác hoặc bỏ lọc nhóm." : "Bắt đầu bằng việc thêm khách đầu tiên."} action={!dq && !group && can("customer.create") ? { label: "Thêm khách", onClick: () => setForm(true) } : undefined} />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách khách hàng">
              {data?.items.map((c) => (
                <InsetRow
                  key={c.id}
                  href={`/khach-hang/${c.id}`}
                  lead={<Avatar name={c.fullName} tone={c.isActive ? undefined : "neutral"} />}
                  title={c.fullName}
                  subtitle={`${c.phone ?? "Chưa có SĐT"}${c.groupName ? ` · ${c.groupName}` : ""}`}
                  end={c.anonymizedAt ? <StatusChip tone="neutral">Đã ẩn danh</StatusChip> : c.code}
                />
              ))}
            </InsetList>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
        <CustomerModal customer={null} open={form} onClose={() => setForm(false)} onDone={async (id) => { await mutate(); setForm(false); if (id) router.push(`/khach-hang/${id}`); }} />
        <GroupsModal open={gm} onClose={() => { setGm(false); void groups.mutate(); }} />
      </RequirePerm>
    </>
  );
}
