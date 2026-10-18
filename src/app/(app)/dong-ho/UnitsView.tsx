"use client";
import { Bookmark, ClipboardCheck, FileSpreadsheet, Handshake, Layers, PackageCheck, PackagePlus, Watch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ScanDialog } from "@/components/catalog/ScanDialog";
import { useBrands, useLocations, useModels } from "@/components/catalog/useLists";
import { UnitArt } from "@/components/catalog/UnitArt";
import { unitTitle, type UnitList } from "@/components/catalog/types";
import { ActiveFilterChips, FilterButton, FilterDrawer, FilterSection } from "@/components/lucian/FilterDrawer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductCard } from "@/components/ui/ProductCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatStrip } from "@/components/ui/StatStrip";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/TextInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { swrFetcher } from "@/lib/api-client";
import { CONDITION_LABELS } from "@/lib/types/catalog";
import { useSession } from "@/lib/session";

type Filters = { status: string; brandId: string; modelId: string; locationId: string; condition: string; aging: boolean; sort: string };
const DEFAULT: Filters = { status: "stock", brandId: "", modelId: "", locationId: "", condition: "", aging: false, sort: "-created_at" };
const STOCK = ["in_stock", "reserved", "with_collaborator", "in_repair", "inspecting"];
const STATUS_CHIPS: Array<{ value: string; label: string }> = [
  { value: "stock", label: "Tất cả tồn kho" }, { value: "in_stock", label: "Sẵn sàng bán" }, { value: "reserved", label: "Đã giữ" },
  { value: "with_collaborator", label: "Đang ở CTV" }, { value: "in_repair", label: "Đang sửa" }, { value: "inspecting", label: "Chờ kiểm tra" },
  { value: "sold", label: "Đã bán" }, { value: "written_off", label: "Thanh lý/mất" },
];
const SORTS = [
  { value: "-created_at", label: "Mới nhập nhất" }, { value: "price", label: "Giá thấp → cao" }, { value: "-price", label: "Giá cao → thấp" },
  { value: "asset_code", label: "Theo mã nội bộ" }, { value: "-stock_since", label: "Mới vào kho" }, { value: "stock_since", label: "Tồn lâu nhất" },
];
const PAGE = 24;

function qs(q: string, f: Filters, page: number, pageSize: number) {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: f.sort });
  if (q.trim()) p.set("q", q.trim());
  if (f.status) p.set("status", f.status);
  if (f.brandId) p.set("brandId", f.brandId);
  if (f.modelId) p.set("modelId", f.modelId);
  if (f.locationId) p.set("locationId", f.locationId);
  if (f.condition) p.set("condition", f.condition);
  if (f.aging) p.set("aging", "1");
  return p.toString();
}

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function UnitsView() {
  const { can } = useSession();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const [f, setF] = useState<Filters>(DEFAULT);
  const [draft, setDraft] = useState<Filters>(DEFAULT);
  const [drawer, setDrawer] = useState(false);
  const [scan, setScan] = useState(sp.get("quet") === "1");
  const allowed = can("catalog.view");

  // Chiếc: tải nối tiếp theo trang ("Xem thêm")
  const getKey = (i: number, prev: UnitList | null) => (!allowed || (prev && prev.items.length < PAGE) ? null : `/api/v1/catalog/units?${qs(dq, f, i + 1, PAGE)}`);
  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<UnitList>(getKey, swrFetcher, { revalidateFirstPage: false });
  const items = data?.flatMap((d) => d.items) ?? [];
  const total = data?.[0]?.total ?? 0;
  const counts = data?.[0]?.counts ?? {};

  // Số kết quả của bộ lọc nháp (cho nút "Xem N kết quả")
  const { data: draftRes } = useSWR<UnitList>(drawer ? `/api/v1/catalog/units?${qs(dq, draft, 1, 1)}` : null, swrFetcher, { keepPreviousData: true });

  const brands = useBrands(drawer || !!f.brandId);
  const models = useModels((drawer ? draft.brandId : f.brandId) || undefined, (drawer && !!draft.brandId) || !!f.modelId);
  const locations = useLocations(drawer || !!f.locationId);

  const chipCount = (v: string) => (v === "stock" ? STOCK.reduce((a, s) => a + (counts[s] ?? 0), 0) : (counts[v] ?? 0));
  const activeChips = useMemo(() => {
    const out: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (f.brandId) out.push({ id: "b", label: `Hãng: ${brands.data?.items.find((b) => b.id === f.brandId)?.name ?? "đã chọn"}`, onRemove: () => setF({ ...f, brandId: "", modelId: "" }) });
    if (f.modelId) out.push({ id: "m", label: `Loại: ${models.data?.items.find((m) => m.id === f.modelId)?.name ?? "đã chọn"}`, onRemove: () => setF({ ...f, modelId: "" }) });
    if (f.locationId) out.push({ id: "l", label: `Vị trí: ${locations.data?.items.find((l) => l.id === f.locationId)?.name ?? "đã chọn"}`, onRemove: () => setF({ ...f, locationId: "" }) });
    if (f.condition) out.push({ id: "c", label: CONDITION_LABELS[f.condition as keyof typeof CONDITION_LABELS] ?? f.condition, onRemove: () => setF({ ...f, condition: "" }) });
    if (f.aging) out.push({ id: "a", label: "Tồn lâu", onRemove: () => setF({ ...f, aging: false }) });
    if (f.sort !== DEFAULT.sort) out.push({ id: "s", label: SORTS.find((s) => s.value === f.sort)?.label ?? f.sort, onRemove: () => setF({ ...f, sort: DEFAULT.sort }) });
    return out;
  }, [f, brands.data, models.data, locations.data]);
  useEffect(() => {
    void setSize(1);
  }, [dq, f, setSize]);

  const resetAll = () => {
    setF(DEFAULT);
    setQ("");
  };

  return (
    <>
      <PageHeader
        title="Đồng hồ"
        context={total ? `${total} chiếc` : undefined}
        description="Kho đồng hồ của cửa hàng"
        onScan={() => setScan(true)}
        actions={
          <>
            {can("catalog.manage") && (
              <Button sm variant="primary" href="/dong-ho/moi" icon={<PackagePlus size={16} aria-hidden="true" />}>
                Thêm đồng hồ
              </Button>
            )}
            <Button sm href="/dong-ho/loai" icon={<Layers size={16} aria-hidden="true" />}>
              Loại & hãng
            </Button>
            {can(["purchase.create"]) && can(["purchase.confirm"]) && (
              <Button sm href="/nhap-excel?loai=dong-ho" icon={<FileSpreadsheet size={16} aria-hidden="true" />}>
                Nhập Excel
              </Button>
            )}
          </>
        }
      />
      <RequirePerm perm="catalog.view">
        {data && (
          <StatStrip
            items={[
              { label: "Sẵn sàng bán", value: counts.in_stock ?? 0, icon: <PackageCheck size={16} />, tone: "ok", hint: "có thể bán ngay", onClick: () => setF({ ...f, status: "in_stock" }), active: f.status === "in_stock" },
              { label: "Đã giữ", value: counts.reserved ?? 0, icon: <Bookmark size={16} />, tone: "hold", hint: "khách đã cọc", onClick: () => setF({ ...f, status: "reserved" }), active: f.status === "reserved" },
              { label: "Đang ở CTV", value: counts.with_collaborator ?? 0, icon: <Handshake size={16} />, tone: "info", hint: "cộng tác viên giữ", onClick: () => setF({ ...f, status: "with_collaborator" }), active: f.status === "with_collaborator" },
              { label: "Chờ kiểm tra", value: counts.inspecting ?? 0, icon: <ClipboardCheck size={16} />, tone: "check", hint: "hàng cũ / thu cũ", onClick: () => setF({ ...f, status: "inspecting" }), active: f.status === "inspecting" },
            ]}
          />
        )}
        <SearchBar value={q} onChange={setQ} placeholder="Tìm mã nội bộ, serial, tên đồng hồ…" autoFocus={sp.get("tim") === "1"} />
        <FilterChips
          ariaLabel="Lọc theo trạng thái"
          value={[f.status]}
          onChange={(v) => setF({ ...f, status: v[0] ?? "" })}
          options={STATUS_CHIPS.map((c) => ({ ...c, count: data ? chipCount(c.value) : undefined }))}
        />
        <div className="wf-dev-row" style={{ marginBottom: 10 }}>
          <FilterButton
            count={activeChips.length}
            expanded={drawer}
            onClick={() => {
              setDraft(f);
              setDrawer(true);
            }}
          />
          <ActiveFilterChips chips={activeChips} />
        </div>

        {isLoading ? (
          <SkeletonGroup className="wf-pgrid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="wf-pc g" style={{ gap: 8, display: "grid" }}>
                <Skeleton h={150} radius={18} />
                <Skeleton w="80%" h={13} />
                <Skeleton w="50%" h={11} />
              </div>
            ))}
          </SkeletonGroup>
        ) : error ? (
          <div className="g wf-pad">
            <ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} />
          </div>
        ) : items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState
              variant={dq || activeChips.length || f.status !== "stock" ? "search" : "plain"}
              icon={<Watch size={24} aria-hidden="true" />}
              title={dq || activeChips.length || f.status !== "stock" ? "Không có chiếc nào khớp" : "Kho chưa có đồng hồ"}
              description={dq || activeChips.length || f.status !== "stock" ? "Thử bỏ bớt bộ lọc hoặc đổi từ khóa." : "Bắt đầu bằng việc nhập hàng để có chiếc đầu tiên."}
              suggestions={dq || activeChips.length || f.status !== "stock" ? [{ removed: "Tất cả bộ lọc", count: chipCount("stock"), onClick: resetAll }] : undefined}
              action={!dq && !activeChips.length && f.status === "stock" && can("catalog.manage") ? { label: "Thêm đồng hồ", href: "/dong-ho/moi" } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="wf-pgrid">
              {items.map((u) => (
                <ProductCard
                  key={u.id}
                  href={`/dong-ho/${u.id}`}
                  name={unitTitle(u)}
                  code={u.assetCode}
                  price={u.effectivePrice > 0 ? u.effectivePrice : null}
                  status={u.status}
                  imageSrc={u.thumbUrl ?? undefined}
                  placeholder={<UnitArt u={u} />}
                />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }} aria-live="polite">
              <p className="wf-mute" style={{ marginBottom: 8 }}>
                Đang hiển thị {items.length}/{total}
              </p>
              {items.length < total && (
                <Button loading={isValidating} onClick={() => void setSize(size + 1)}>
                  Xem thêm
                </Button>
              )}
            </div>
          </>
        )}

        <FilterDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          onReset={() => setDraft({ ...DEFAULT, status: draft.status })}
          onApply={() => {
            setF(draft);
            setDrawer(false);
          }}
          resultCount={draftRes ? draftRes.total : null}
        >
          <FilterSection title="Thương hiệu & loại">
            <Field label="Thương hiệu">
              <Select placeholder="Tất cả thương hiệu" value={draft.brandId} onChange={(e) => setDraft({ ...draft, brandId: e.target.value, modelId: "" })} options={(brands.data?.items ?? []).filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))} />
            </Field>
            <Field label="Loại đồng hồ">
              <Select placeholder={draft.brandId ? "Tất cả loại" : "Chọn thương hiệu trước"} disabled={!draft.brandId} value={draft.modelId} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} options={(models.data?.items ?? []).map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          </FilterSection>
          <FilterSection title="Vị trí & tình trạng">
            <Field label="Vị trí lưu kho">
              <Select placeholder="Mọi vị trí" value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })} options={(locations.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            <Field label="Tình trạng máy">
              <Select placeholder="Mọi tình trạng" value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })} options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Checkbox checked={draft.aging} onChange={(c) => setDraft({ ...draft, aging: c })} label="Chỉ chiếc tồn lâu (sẵn sàng bán quá hạn tồn)" />
          </FilterSection>
          <FilterSection title="Sắp xếp">
            <Select value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })} options={SORTS} aria-label="Sắp xếp" />
          </FilterSection>
        </FilterDrawer>
        <ScanDialog open={scan} onClose={() => setScan(false)} />
      </RequirePerm>
    </>
  );
}
