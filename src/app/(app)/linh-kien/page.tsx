"use client";
import { Boxes, FileSpreadsheet, Plus, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { PartModal } from "@/components/catalog/PartModal";
import type { Part, PartCategory } from "@/components/catalog/types";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { LockNote } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChips } from "@/components/ui/FilterChips";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

type Res = { items: Part[]; total: number; page: number; pageSize: number };
const PAGE = 30;

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const cats = useSWR<{ items: PartCategory[] }>(open ? "/api/v1/part-categories" : null, swrFetcher);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      await cats.mutate();
      toast.success(ok);
    } catch (e) {
      toast.error("Không lưu được", errMsg(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Loại linh kiện">
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
        <TextInput aria-label="Tên loại mới" placeholder="Tên loại mới (vd. Pin, Dây da)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="primary" loading={busy === "new"} disabled={!name.trim()} onClick={() => void act("new", async () => { await sapi("/api/v1/part-categories", { body: { name: name.trim() } }); setName(""); }, "Đã thêm loại")}>Thêm</Button>
      </div>
      {cats.isLoading ? <SkeletonList rows={3} /> : (cats.data?.items ?? []).map((c) => {
        const v = edit[c.id] ?? c.name;
        return (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <TextInput aria-label={`Tên loại ${c.name}`} value={v} onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })} />
              <Button disabled={v.trim() === c.name || !v.trim()} loading={busy === c.id} onClick={() => void act(c.id, () => sapi(`/api/v1/part-categories/${c.id}`, { method: "PATCH", body: { name: v.trim() } }), "Đã đổi tên")}>Lưu</Button>
            </div>
            <Switch checked={c.isActive} label={`${c.partCount} linh kiện`} onChange={(a) => void act(c.id + "a", () => sapi(`/api/v1/part-categories/${c.id}`, { method: "PATCH", body: { isActive: a } }), a ? "Đã bật loại" : "Đã tắt loại")} />
          </div>
        );
      })}
    </Modal>
  );
}

export default function PartsPage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [cat, setCat] = useState("");
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq, cat, low]);
  const allowed = can("part.view");
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  if (cat) p.set("categoryId", cat);
  if (low) p.set("low", "1");
  const { data, error, isLoading, mutate } = useSWR<Res>(allowed ? `/api/v1/parts?${p}` : null, swrFetcher, { keepPreviousData: true });
  const cats = useSWR<{ items: PartCategory[] }>(allowed ? "/api/v1/part-categories" : null, swrFetcher);
  const [form, setForm] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const manage = can("part.manage");
  const hasCost = data?.items.some((x) => x.avgCost !== undefined);

  return (
    <>
      <PageHeader
        title="Linh kiện"
        description="Pin, dây, kính, bộ máy… dùng cho sửa chữa"
        actions={manage ? (<>{can("purchase.create") && can("purchase.confirm") && <Button sm href="/nhap-excel?loai=linh-kien" icon={<FileSpreadsheet size={16} aria-hidden="true" />}>Nhập Excel</Button>}<Button sm icon={<Tags size={16} aria-hidden="true" />} onClick={() => setCatsOpen(true)}>Loại</Button><Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setForm(true)}>Thêm</Button></>) : undefined}
      />
      <RequirePerm perm="part.view">
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã hoặc tên linh kiện…" />
        <div className="wf-dev-row" style={{ marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Select aria-label="Lọc theo loại" placeholder="Mọi loại linh kiện" value={cat} onChange={(e) => setCat(e.target.value)} options={(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <FilterChips ariaLabel="Lọc tồn kho" value={low ? ["low"] : []} onChange={(v) => setLow(v.includes("low"))} options={[{ value: "low", label: "Sắp hết" }]} />
        </div>
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={dq || cat || low ? "search" : "plain"} icon={<Boxes size={24} />} title={dq || cat || low ? "Không có linh kiện khớp" : "Chưa có linh kiện"} description={dq || cat || low ? "Thử đổi từ khóa hoặc bỏ lọc." : "Thêm linh kiện để theo dõi tồn kho cho sửa chữa."} action={!dq && !cat && !low && manage ? { label: "Thêm linh kiện", onClick: () => setForm(true) } : undefined} />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách linh kiện">
              {data?.items.map((x) => (
                <InsetRow
                  key={x.id}
                  href={`/linh-kien/${x.id}`}
                  icon={<Boxes size={20} aria-hidden="true" />}
                  tone={!x.isActive ? "neutral" : x.isLow ? "hold" : "repair"}
                  title={x.name}
                  subtitle={`${x.code} · ${x.categoryName}${x.avgCost !== undefined && x.avgCost !== null ? ` · Giá vốn TB ${formatVnd(Math.round(Number(x.avgCost)))}` : ""}`}
                  end={`${x.qtyOnHand} ${x.uom}`}
                  endSub={x.isLow && x.isActive ? <StatusChip tone="hold">Sắp hết</StatusChip> : !x.isActive ? <StatusChip tone="neutral">Đã tắt</StatusChip> : formatVnd(x.salePrice)}
                />
              ))}
            </InsetList>
            {hasCost && <LockNote />}
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
        <PartModal part={null} open={form} onClose={() => setForm(false)} onDone={async () => { await mutate(); setForm(false); }} />
        <CategoriesModal open={catsOpen} onClose={() => { setCatsOpen(false); void cats.mutate(); }} />
      </RequirePerm>
    </>
  );
}
