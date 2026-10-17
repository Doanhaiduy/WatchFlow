"use client";
import { Plus, Tag, Watch } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Brand, Model } from "@/components/catalog/types";
import { useBrands, useModels } from "@/components/catalog/useLists";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Switch } from "@/components/ui/Checkbox";
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";
import { MOVEMENT_LABELS, MOVEMENT_TYPES } from "@/lib/types/catalog";

function BrandModal({ brand, open, onClose, onDone }: { brand: Brand | null; open: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [active, setActive] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setName(brand?.name ?? ""); setCountry(brand?.country ?? ""); setActive(brand?.isActive ?? true); setErrs({}); }
  }, [open, brand]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      if (brand) await sapi(`/api/v1/catalog/brands/${brand.id}`, { method: "PATCH", ifMatch: brand.version, body: { name, country: country || undefined, isActive: active } });
      else await sapi("/api/v1/catalog/brands", { body: { name, country: country || undefined } });
      toast.success(brand ? "Đã lưu thương hiệu" : "Đã thêm thương hiệu");
      await onDone();
    } catch (x) {
      const f = fieldErrors(x);
      setErrs(Object.keys(f).length ? f : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={brand ? "Sửa thương hiệu" : "Thêm thương hiệu"}>
      <form onSubmit={submit} noValidate>
        <Field label="Tên thương hiệu" required error={errs.name}><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Quốc gia" error={errs.country}><TextInput value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
        {brand && <Switch checked={active} onChange={setActive} label="Đang dùng" description="Tắt để ẩn khỏi danh sách chọn" />}
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}

const nullable = (s: string) => (s.trim() === "" ? null : s.trim());
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function ModelModal({ model, brands, defaultBrand, open, onClose, onDone }: { model: Model | null; brands: Brand[]; defaultBrand: string; open: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const m = model;
    setF({
      code: m?.code ?? "", brandId: m?.brandId ?? defaultBrand, name: m?.name ?? "", referenceNo: m?.referenceNo ?? "", caliber: m?.caliber ?? "",
      movementType: m?.movementType ?? "", caseSizeMm: m?.caseSizeMm?.toString() ?? "", caseMaterial: m?.caseMaterial ?? "", strapType: m?.strapType ?? "",
      dialColor: m?.dialColor ?? "", glassType: m?.glassType ?? "", waterResistanceM: m?.waterResistanceM?.toString() ?? "", gender: m?.gender ?? "",
      originCountry: m?.originCountry ?? "", description: m?.description ?? "",
    });
    setActive(m?.isActive ?? true);
    setErrs({});
  }, [open, model, defaultBrand]);
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    const body = {
      name: f.name, referenceNo: nullable(f.referenceNo ?? ""), caliber: nullable(f.caliber ?? ""), movementType: nullable(f.movementType ?? ""),
      caseSizeMm: num(f.caseSizeMm ?? ""), caseMaterial: nullable(f.caseMaterial ?? ""), strapType: nullable(f.strapType ?? ""), dialColor: nullable(f.dialColor ?? ""),
      glassType: nullable(f.glassType ?? ""), waterResistanceM: num(f.waterResistanceM ?? ""), gender: nullable(f.gender ?? ""),
      originCountry: nullable(f.originCountry ?? ""), description: nullable(f.description ?? ""),
    };
    try {
      if (model) await sapi(`/api/v1/catalog/models/${model.id}`, { method: "PATCH", ifMatch: model.version, body: { ...body, isActive: active } });
      else await sapi("/api/v1/catalog/models", { body: { ...body, code: f.code, brandId: f.brandId } });
      toast.success(model ? "Đã lưu loại đồng hồ" : "Đã thêm loại đồng hồ");
      await onDone();
    } catch (x) {
      const er = fieldErrors(x);
      setErrs(Object.keys(er).length ? er : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={model ? "Sửa loại đồng hồ" : "Thêm loại đồng hồ"}>
      <form onSubmit={submit} noValidate>
        {!model && (
          <>
            <Field label="Thương hiệu" required error={errs.brandId}>
              <Select placeholder="Chọn thương hiệu" value={f.brandId ?? ""} onChange={set("brandId")} options={brands.filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))} />
            </Field>
            <Field label="Mã loại" required hint="Chữ, số, . _ / - (vd. SRPD55K1)" error={errs.code}><TextInput value={f.code ?? ""} onChange={set("code")} autoCapitalize="characters" /></Field>
          </>
        )}
        <Field label="Tên loại" required error={errs.name}><TextInput data-autofocus={model ? true : undefined} value={f.name ?? ""} onChange={set("name")} /></Field>
        <Field label="Số tham chiếu (reference)"><TextInput value={f.referenceNo ?? ""} onChange={set("referenceNo")} /></Field>
        <Field label="Bộ máy (caliber)"><TextInput value={f.caliber ?? ""} onChange={set("caliber")} /></Field>
        <Field label="Loại máy"><Select placeholder="Chưa chọn" value={f.movementType ?? ""} onChange={set("movementType")} options={MOVEMENT_TYPES.map((m) => ({ value: m, label: MOVEMENT_LABELS[m] }))} /></Field>
        <Field label="Đường kính vỏ (mm)" error={errs.caseSizeMm}><TextInput inputMode="decimal" value={f.caseSizeMm ?? ""} onChange={set("caseSizeMm")} /></Field>
        <Field label="Chất liệu vỏ"><TextInput value={f.caseMaterial ?? ""} onChange={set("caseMaterial")} /></Field>
        <Field label="Loại dây"><TextInput value={f.strapType ?? ""} onChange={set("strapType")} /></Field>
        <Field label="Màu mặt"><TextInput value={f.dialColor ?? ""} onChange={set("dialColor")} /></Field>
        <Field label="Loại kính"><TextInput value={f.glassType ?? ""} onChange={set("glassType")} /></Field>
        <Field label="Chống nước (m)" error={errs.waterResistanceM}><TextInput inputMode="numeric" value={f.waterResistanceM ?? ""} onChange={set("waterResistanceM")} /></Field>
        <Field label="Dành cho"><Select placeholder="Chưa chọn" value={f.gender ?? ""} onChange={set("gender")} options={[{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }, { value: "unisex", label: "Unisex" }]} /></Field>
        <Field label="Xuất xứ"><TextInput value={f.originCountry ?? ""} onChange={set("originCountry")} /></Field>
        <Field label="Mô tả"><Textarea rows={3} value={f.description ?? ""} onChange={set("description")} /></Field>
        {model && <Switch checked={active} onChange={setActive} label="Đang dùng" />}
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!f.name?.trim() || (!model && (!f.code?.trim() || !f.brandId))}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function BrandsModelsPage() {
  const { can } = useSession();
  const manage = can("catalog.manage");
  const [tab, setTab] = useState<"brands" | "models">("brands");
  const [brandFilter, setBrandFilter] = useState("");
  const brands = useBrands();
  const models = useModels(brandFilter || undefined, tab === "models");
  const [bm, setBm] = useState<{ open: boolean; brand: Brand | null }>({ open: false, brand: null });
  const [mm, setMm] = useState<{ open: boolean; model: Model | null }>({ open: false, model: null });

  return (
    <>
      <PageHeader
        title="Loại & thương hiệu"
        description="Danh mục dùng để nhập và tìm đồng hồ"
        actions={manage ? <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => (tab === "brands" ? setBm({ open: true, brand: null }) : setMm({ open: true, model: null }))}>{tab === "brands" ? "Thêm thương hiệu" : "Thêm loại"}</Button> : undefined}
      />
      <RequirePerm perm={["catalog.view", "part.view"]}>
        <SegmentedControl mode="tabs" ariaLabel="Danh mục" value={tab} onChange={setTab} options={[{ value: "brands", label: "Thương hiệu" }, { value: "models", label: "Loại đồng hồ" }]} />
        <div style={{ height: 12 }} />
        {tab === "brands" ? (
          brands.isLoading ? <SkeletonList rows={5} /> : brands.error ? (
            <div className="g wf-pad"><ErrorState description={errMsg(brands.error)} onRetry={async () => (await brands.mutate()) !== undefined} /></div>
          ) : brands.data && brands.data.items.length > 0 ? (
            <InsetList label="Thương hiệu">
              {brands.data.items.map((b) => (
                <InsetRow key={b.id} icon={<Tag size={20} aria-hidden="true" />} tone={b.isActive ? "info" : "neutral"} title={b.name} subtitle={`${b.country ?? "Chưa rõ quốc gia"} · ${b.modelCount} loại`} end={b.isActive ? undefined : <StatusChip tone="neutral">Đã tắt</StatusChip>} onClick={manage ? () => setBm({ open: true, brand: b }) : undefined} chevron={manage} />
              ))}
            </InsetList>
          ) : (
            <div className="g wf-pad"><EmptyState title="Chưa có thương hiệu" description="Thêm thương hiệu trước, rồi thêm các loại đồng hồ." icon={<Tag size={24} />} action={manage ? { label: "Thêm thương hiệu", onClick: () => setBm({ open: true, brand: null }) } : undefined} /></div>
          )
        ) : (
          <>
            <Field label="Lọc theo thương hiệu">
              <Select placeholder="Tất cả thương hiệu" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} options={(brands.data?.items ?? []).map((b) => ({ value: b.id, label: b.name }))} />
            </Field>
            {models.isLoading ? <SkeletonList rows={5} /> : models.error ? (
              <div className="g wf-pad"><ErrorState description={errMsg(models.error)} onRetry={async () => (await models.mutate()) !== undefined} /></div>
            ) : models.data && models.data.items.length > 0 ? (
              <InsetList label="Loại đồng hồ">
                {models.data.items.map((m) => (
                  <InsetRow key={m.id} icon={<Watch size={20} aria-hidden="true" />} tone={m.isActive ? "check" : "neutral"} title={`${m.brandName} ${m.name}`} subtitle={`${m.code}${m.referenceNo ? ` · ${m.referenceNo}` : ""}`} end={m.stockCount ? `${m.stockCount} tồn` : undefined} endSub={m.isActive ? undefined : "Đã tắt"} onClick={manage ? () => setMm({ open: true, model: m }) : undefined} chevron={manage} />
                ))}
              </InsetList>
            ) : (
              <div className="g wf-pad"><EmptyState title="Chưa có loại đồng hồ" description="Mỗi loại là một mẫu đồng hồ (mã tham chiếu) dùng khi nhập hàng." icon={<Watch size={24} />} action={manage ? { label: "Thêm loại", onClick: () => setMm({ open: true, model: null }) } : undefined} /></div>
            )}
          </>
        )}
        <BrandModal open={bm.open} brand={bm.brand} onClose={() => setBm({ open: false, brand: null })} onDone={async () => { await brands.mutate(); setBm({ open: false, brand: null }); }} />
        <ModelModal open={mm.open} model={mm.model} brands={brands.data?.items ?? []} defaultBrand={brandFilter} onClose={() => setMm({ open: false, model: null })} onDone={async () => { await models.mutate(); await brands.mutate(); setMm({ open: false, model: null }); }} />
      </RequirePerm>
    </>
  );
}
