"use client";
import { ArrowRightLeft, BadgeCheck, Ban, Bookmark, Handshake, Pencil, Printer, RotateCcw, ShoppingBag, Tag } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { isReauthCancelled, useReauth } from "@/components/auth/useReauth";
import { UnitArt } from "@/components/catalog/UnitArt";
import { useLocations } from "@/components/catalog/useLists";
import { unitTitle, type UnitDetail } from "@/components/catalog/types";
import type { RepairListItem } from "@/components/repairs/types";
import type { Warranty } from "@/components/trade/types";
import { warrantyStatus } from "@/components/ui/status";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { ReservationModal } from "@/components/trade/ReservationModal";
import { CopyCodeButton } from "@/components/lucian/CopyCodeButton";
import { ImageUpload } from "@/components/lucian/ImageUpload";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValue, LockNote, Timeline } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import { ZoomableImage } from "@/components/ui/ZoomableImage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { DateInput, DateRange } from "@/components/ui/DateInput";
import { Select, Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { statusInfo } from "@/components/ui/status";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";
import { ACCESSORY_KINDS, ACCESSORY_LABELS, CONDITIONS, CONDITION_LABELS, MOVEMENT_LABELS } from "@/lib/types/catalog";

type Tab = "info" | "photos" | "price" | "cost" | "history" | "warranty";
type History = {
  status: Array<{ id: string; from: string | null; to: string; at: string; reason: string | null; actorName: string | null }>;
  prices: Array<{ id: string; field: string; oldValue: string | null; newValue: string | null; at: string; reason: string | null; actorName: string | null }>;
  movements: Array<{ id: string; fromName: string | null; toName: string | null; at: string; note: string | null; actorName: string | null }>;
};
type Cost = { cycle: number; total: number; entries: Array<{ id: string; cycle: number; kind: string; amount: number; reason: string | null; createdAt: string; actorName: string | null }> };

const SPEC_LABELS: Record<string, string> = {
  caliber: "Bộ máy", movementType: "Loại máy", caseSizeMm: "Đường kính vỏ (mm)", caseMaterial: "Chất liệu vỏ", strapType: "Loại dây", dialColor: "Màu mặt",
  glassType: "Kính", waterResistanceM: "Chống nước (m)", gender: "Dành cho", originCountry: "Xuất xứ",
};
const GENDER: Record<string, string> = { male: "Nam", female: "Nữ", unisex: "Unisex" };
const COST_KIND: Record<string, string> = { purchase: "Giá thu", acquisition: "Giá thu", repair: "Chi phí sửa", repair_cost: "Chi phí sửa", extra: "Chi phí phát sinh", adjustment: "Điều chỉnh", adjust: "Điều chỉnh" };
const PRICE_FIELD: Record<string, string> = { list_price_vnd: "Giá niêm yết", promo_price_vnd: "Giá khuyến mãi", promo_from: "Khuyến mãi từ", promo_to: "Khuyến mãi đến" };
const price = (field: string, v: string | null) => (v === null || v === "" ? "—" : field.endsWith("_vnd") && /^\d+$/.test(v) ? formatVnd(Number(v)) : v);

function ActBtn({ icon, label, onClick, disabled, hint, primary }: { icon: ReactNode; label: string; onClick?: () => void; disabled?: boolean; hint?: string; primary?: boolean }) {
  return (
    <button type="button" className={primary ? "pri" : undefined} onClick={onClick} disabled={disabled} title={hint}>
      {icon}
      <span>{label}</span>
      {hint && disabled && <small style={{ fontSize: 11, lineHeight: 1.2, opacity: 0.9 }}>{hint}</small>}
    </button>
  );
}

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>("info");
  const detail = useSWR<UnitDetail>(can("catalog.view") ? `/api/v1/catalog/units/${id}` : null, swrFetcher);
  const u = detail.data;
  const showCost = can("cost.view"); // KHÔNG gọi /cost và không render nếu thiếu quyền (BR-SEC-02)
  const hist = useSWR<History>(u && (tab === "price" || tab === "history") ? `/api/v1/catalog/units/${id}/history` : null, swrFetcher);
  const cost = useSWR<Cost>(u && showCost && tab === "cost" ? `/api/v1/catalog/units/${id}/cost` : null, swrFetcher);

  const tabs = useMemo(
    () => [
      { value: "info", label: "Thông tin" }, { value: "photos", label: "Ảnh" }, { value: "price", label: "Giá" },
      ...(showCost ? [{ value: "cost", label: "Giá thu" }] : []),
      { value: "history", label: "Lịch sử" }, { value: "warranty", label: "Bảo hành" },
    ],
    [showCost],
  );

  return (
    <>
      <PageHeader title={u ? unitTitle(u) : "Chi tiết đồng hồ"} context={u?.assetCode} description={u ? `${u.model.code}${u.model.referenceNo ? ` · ${u.model.referenceNo}` : ""}` : undefined} />
      <RequirePerm perm="catalog.view">
        {detail.isLoading ? (
          <SkeletonGroup className="wf-stack">
            <Skeleton h={300} radius={32} />
            <Skeleton h={120} radius={26} />
          </SkeletonGroup>
        ) : detail.error || !u ? (
          <div className="g wf-pad">
            <ErrorState title="Không mở được chiếc này" description={errMsg(detail.error)} onRetry={async () => (await detail.mutate()) !== undefined} />
          </div>
        ) : (
          <UnitBody u={u} tab={tab} setTab={(t) => setTab(t)} tabs={tabs} refresh={() => detail.mutate()} hist={hist} cost={cost} />
        )}
      </RequirePerm>
    </>
  );
}

function UnitBody({
  u, tab, setTab, tabs, refresh, hist, cost,
}: {
  u: UnitDetail; tab: Tab; setTab: (t: Tab) => void; tabs: Array<{ value: string; label: string }>; refresh: () => Promise<unknown>;
  hist: ReturnType<typeof useSWR<History>>; cost: ReturnType<typeof useSWR<Cost>>;
}) {
  const { can } = useSession();
  const toast = useToast();
  const { withReauth } = useReauth();
  const [dlg, setDlg] = useState<"" | "price" | "move" | "release" | "writeoff" | "restore" | "edit" | "reserve" | "costadj">("");
  const [busy, setBusy] = useState(false);
  const live = !["sold", "written_off", "cancelled"].includes(u.status);
  const photo = u.photos.find((p) => p.kind === "product") ?? u.photos[0];

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(ok);
      setDlg("");
    } catch (e) {
      if (!isReauthCancelled(e)) toast.error(fail, errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wf-stack">
      <div className="wf-unit">
        <div className="wf-uimg g">
          {photo ? (
            <ZoomableImage src={photo.url} alt={`Ảnh ${unitTitle(u)}`} viewer={u.photos.map((p) => ({ src: p.url, alt: `Ảnh ${unitTitle(u)}` }))} index={Math.max(0, u.photos.indexOf(photo))} />
          ) : (
            <div className="wf-art"><UnitArt u={u} /></div>
          )}
          <span className="st">
            <StatusChip kind="unit" status={u.status} />
          </span>
        </div>
        <section className="g wf-pad" aria-label="Tóm tắt">
          <div className="wf-dev-row" style={{ margin: "0 0 8px", gap: 4 }}>
            <span className="wf-mono" style={{ margin: 0 }}>{u.assetCode}</span>
            <CopyCodeButton text={u.assetCode} label="Sao chép mã nội bộ" />
          </div>
          <div className="wf-uprice">
            {u.effectivePrice > 0 ? formatVnd(u.effectivePrice) : "Chưa đặt giá"}
            {u.effectivePrice > 0 && u.effectivePrice !== u.listPrice && <span className="wf-uprice-old">{formatVnd(u.listPrice)}</span>}
          </div>
          {u.promoPrice !== null && (
            <p className="wf-mute" style={{ marginTop: 2 }}>
              Khuyến mãi {formatVnd(u.promoPrice)}
              {u.promoFrom || u.promoTo ? ` (${u.promoFrom ? formatDateVn(u.promoFrom) : "…"} – ${u.promoTo ? formatDateVn(u.promoTo) : "…"})` : ""}
            </p>
          )}
          <p style={{ marginTop: 8 }}>
            <b>Vị trí:</b> {u.status === "with_collaborator" ? `Đang ở CTV: ${u.heldBy?.name ?? "chưa rõ"}` : (u.location?.name ?? "Chưa đặt vị trí")}
          </p>
          {u.daysInStock !== null && <p className="wf-mute">Tồn kho {u.daysInStock} ngày</p>}

          <div className="wf-acts" role="group" aria-label="Hành động">
            {can("unit.price.edit") && live && <ActBtn icon={<Tag size={20} />} label="Sửa giá" onClick={() => setDlg("price")} />}
            {can("location.manage") && live && u.status !== "with_collaborator" && <ActBtn icon={<ArrowRightLeft size={20} />} label="Đổi vị trí" onClick={() => setDlg("move")} />}
            <ActBtn icon={<Printer size={20} />} label="In tem" onClick={() => (window.location.href = `/dong-ho/${u.id}/tem`)} />
            {can("unit.release") && u.status === "inspecting" && <ActBtn primary icon={<BadgeCheck size={20} />} label="Kiểm tra đạt" onClick={() => setDlg("release")} />}
            {can("stock.writeoff") && live && <ActBtn icon={<Ban size={20} />} label="Ghi mất" onClick={() => setDlg("writeoff")} />}
            {can("stock.writeoff") && u.status === "written_off" && <ActBtn icon={<RotateCcw size={20} />} label="Khôi phục" onClick={() => setDlg("restore")} />}
            {can("sale.create_draft") && <ActBtn primary={u.status === "in_stock"} icon={<ShoppingBag size={20} />} label="Bán" disabled={u.status !== "in_stock"} hint="Chưa sẵn sàng bán" onClick={() => (window.location.href = `/ban-hang/moi?unit=${u.id}`)} />}
            {can("reservation.manage") && <ActBtn icon={<Bookmark size={20} />} label="Giữ hàng" disabled={u.status !== "in_stock"} hint="Chưa sẵn sàng bán" onClick={() => setDlg("reserve")} />}
            {can("collab.manage") && <ActBtn icon={<Handshake size={20} />} label="Giao CTV" disabled={u.status !== "in_stock"} hint="Chưa sẵn sàng bán" onClick={() => (window.location.href = "/cong-tac-vien/giao-hang/moi")} />}
          </div>
        </section>
      </div>

      <SegmentedControl mode="tabs" ariaLabel="Mục chi tiết" value={tab} onChange={(v) => setTab(v as Tab)} options={tabs} />

      {tab === "info" && <InfoTab u={u} onEdit={can("catalog.manage") ? () => setDlg("edit") : undefined} />}
      {tab === "photos" && <PhotosTab u={u} refresh={refresh} canEdit={can("catalog.manage")} />}
      {tab === "price" && <PriceTab u={u} hist={hist} />}
      {tab === "cost" && can("cost.view") && <CostTab cost={cost} onAdjust={can("cost.adjust") && live && u.status !== "sold" ? () => setDlg("costadj") : undefined} />}
      {tab === "history" && <HistoryTab hist={hist} />}
      {tab === "warranty" && <WarrantyTab u={u} />}

      <PriceModal open={dlg === "price"} u={u} onClose={() => setDlg("")} onDone={async () => (await refresh(), setDlg(""))} />
      <MoveModal open={dlg === "move"} u={u} busy={busy} onClose={() => setDlg("")} onSubmit={(locationId, note) => void run(() => sapi(`/api/v1/catalog/units/${u.id}/move`, { body: { locationId, note: note || undefined }, idempotencyKey: newIdempotencyKey() }), "Đã đổi vị trí", "Không đổi được vị trí")} />
      <RestoreModal open={dlg === "restore"} busy={busy} onClose={() => setDlg("")} onSubmit={(locationId, reason) => { const key = newIdempotencyKey(); void run(() => withReauth(() => sapi(`/api/v1/catalog/units/${u.id}/restore`, { body: { locationId, reason }, idempotencyKey: key })), "Đã khôi phục chiếc về kho", "Không khôi phục được"); }} />
      <EditModal open={dlg === "edit"} u={u} onClose={() => setDlg("")} onDone={async () => (await refresh(), setDlg(""))} />
      <ReservationModal open={dlg === "reserve"} unit={u} onClose={() => setDlg("")} onDone={async () => { await refresh(); setDlg(""); }} />
      <CostAdjustModal open={dlg === "costadj"} u={u} onClose={() => setDlg("")} onDone={async () => { await Promise.all([refresh(), cost.mutate()]); setDlg(""); }} />
      <ConfirmDialog
        open={dlg === "release"}
        title="Xác nhận kiểm tra đạt?"
        message="Chiếc sẽ chuyển sang “Sẵn sàng bán” và hiện trong danh sách bán hàng."
        confirmLabel="Kiểm tra đạt"
        loading={busy}
        onCancel={() => setDlg("")}
        onConfirm={() => void run(() => sapi(`/api/v1/catalog/units/${u.id}/release`, { body: {}, idempotencyKey: newIdempotencyKey() }), "Chiếc đã sẵn sàng bán", "Không chuyển được trạng thái")}
      />
      <ConfirmDialog
        open={dlg === "writeoff"}
        danger
        requireReason
        title={`Ghi mất / thanh lý ${u.assetCode}?`}
        message={`Chiếc sẽ rời khỏi tồn kho${u.cost != null ? `, ghi nhận tổn thất theo giá thu ${formatVnd(u.cost)}` : ""}. Cần xác nhận lại mật khẩu; có thể khôi phục sau.`}
        confirmLabel="Ghi mất"
        loading={busy}
        onCancel={() => setDlg("")}
        onConfirm={(reason) => {
          const key = newIdempotencyKey();
          void run(() => withReauth(() => sapi(`/api/v1/catalog/units/${u.id}/writeoff`, { body: { reason }, idempotencyKey: key })), "Đã ghi mất chiếc", "Không ghi mất được");
        }}
      />
    </div>
  );
}

function InfoTab({ u, onEdit }: { u: UnitDetail; onEdit?: () => void }) {
  const specs = Object.entries(u.specs ?? {}).filter(([, v]) => v !== null && v !== "");
  return (
    <div className="wf-stack">
      <section className="g wf-pad" aria-label="Thông tin chiếc">
        <KeyValue
          items={[
            { label: "Mã nội bộ", value: u.assetCode },
            { label: "Serial", value: u.hasSerial ? (u.serialNo ?? "—") : "Không có serial" },
            { label: "Tình trạng", value: `${CONDITION_LABELS[u.condition as keyof typeof CONDITION_LABELS] ?? u.condition}${u.conditionGrade ? ` · ${u.conditionGrade}` : ""}` },
            { label: "Ghi chú tình trạng", value: u.conditionNote || "—" },
            { label: "Bảo hành hãng đến", value: u.manufacturerWarrantyUntil ? formatDateVn(u.manufacturerWarrantyUntil) : "—" },
            { label: "Phụ kiện", value: u.accessories.length ? u.accessories.map((a) => `${ACCESSORY_LABELS[a.kind as keyof typeof ACCESSORY_LABELS] ?? a.kind}${a.present ? "" : " (thiếu)"}`).join(", ") : "—" },
            { label: "Ghi chú", value: u.note || "—" },
            { label: "Nhập kho", value: u.stockSince ? formatDateVn(u.stockSince) : "—" },
          ]}
        />
        {onEdit && (
          <Button block style={{ marginTop: 10 }} icon={<Pencil size={16} aria-hidden="true" />} onClick={onEdit}>
            Sửa thông tin
          </Button>
        )}
      </section>
      {specs.length > 0 && (
        <section className="g wf-pad" aria-label="Thông số loại đồng hồ">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Thông số ({u.model.name})</h3>
          <KeyValue
            items={specs.map(([k, v]) => ({
              label: SPEC_LABELS[k] ?? k,
              value: k === "movementType" ? (MOVEMENT_LABELS[v as keyof typeof MOVEMENT_LABELS] ?? String(v)) : k === "gender" ? (GENDER[String(v)] ?? String(v)) : String(v),
            }))}
          />
        </section>
      )}
    </div>
  );
}

function PhotosTab({ u, refresh, canEdit }: { u: UnitDetail; refresh: () => Promise<unknown>; canEdit: boolean }) {
  const [kind, setKind] = useState<"product" | "condition">("product");
  const groups: Array<["product" | "condition", string]> = [["product", "Ảnh sản phẩm"], ["condition", "Ảnh tình trạng"]];
  return (
    <div className="wf-stack">
      {groups.map(([k, label]) => {
        const list = u.photos.filter((p) => p.kind === k);
        return (
          <section key={k} className="g wf-pad" aria-label={label}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{label} ({list.length})</h3>
            {list.length === 0 ? (
              <p className="wf-mute">Chưa có ảnh.</p>
            ) : (
              <PhotoGrid photos={list} label={label.toLowerCase()} />
            )}
          </section>
        );
      })}
      {canEdit && (
        <section className="g wf-pad" aria-label="Tải ảnh lên">
          <SegmentedControl ariaLabel="Loại ảnh tải lên" value={kind} onChange={setKind} options={[{ value: "product", label: "Ảnh sản phẩm" }, { value: "condition", label: "Ảnh tình trạng" }]} />
          <div style={{ marginTop: 12 }}>
            <ImageUpload kind={kind} entityTable="watch_units" entityId={u.id} onUploaded={() => void refresh()} />
          </div>
        </section>
      )}
    </div>
  );
}

function PriceTab({ u, hist }: { u: UnitDetail; hist: ReturnType<typeof useSWR<History>> }) {
  return (
    <div className="wf-stack">
      <section className="g wf-pad">
        <KeyValue
          items={[
            { label: "Giá niêm yết", value: formatVnd(u.listPrice) },
            { label: "Giá khuyến mãi", value: u.promoPrice !== null ? formatVnd(u.promoPrice) : "—" },
            { label: "Thời gian khuyến mãi", value: u.promoFrom || u.promoTo ? `${u.promoFrom ? formatDateVn(u.promoFrom) : "…"} – ${u.promoTo ? formatDateVn(u.promoTo) : "…"}` : "—" },
            { label: "Giá đang áp dụng", value: <b>{formatVnd(u.effectivePrice)}</b> },
          ]}
        />
      </section>
      <section className="g wf-pad" aria-label="Lịch sử giá">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Lịch sử giá</h3>
        {hist.isLoading ? (
          <Skeleton h={60} />
        ) : hist.error ? (
          <p className="wf-fld-err">{errMsg(hist.error)}</p>
        ) : hist.data && hist.data.prices.length > 0 ? (
          <Timeline items={hist.data.prices.map((p) => ({ title: `${PRICE_FIELD[p.field] ?? p.field}: ${price(p.field, p.oldValue)} → ${price(p.field, p.newValue)}`, meta: `${formatDateTimeVn(p.at)} · ${p.actorName ?? "Hệ thống"}${p.reason ? ` · ${p.reason}` : ""}` }))} />
        ) : (
          <p className="wf-mute">Chưa có thay đổi giá.</p>
        )}
      </section>
    </div>
  );
}

function CostTab({ cost, onAdjust }: { cost: ReturnType<typeof useSWR<Cost>>; onAdjust?: () => void }) {
  return (
    <section className="g wf-pad" aria-label="Giá thu">
      {cost.isLoading ? (
        <Skeleton h={90} />
      ) : cost.error || !cost.data ? (
        <p className="wf-fld-err">{errMsg(cost.error)}</p>
      ) : (
        <>
          <p className="wf-mute">Giá thu hiện tại (chu kỳ {cost.data.cycle})</p>
          <div className="wf-uprice" style={{ margin: "2px 0 10px" }}>{formatVnd(cost.data.total)}</div>
          <Timeline items={cost.data.entries.map((e) => ({ title: `${COST_KIND[e.kind] ?? e.kind}: ${formatVnd(e.amount)}${e.cycle !== cost.data!.cycle ? ` (chu kỳ ${e.cycle})` : ""}`, meta: `${formatDateTimeVn(e.createdAt)} · ${e.actorName ?? "Hệ thống"}${e.reason ? ` · ${e.reason}` : ""}` }))} />
        </>
      )}
      {onAdjust && <Button block style={{ marginTop: 10 }} onClick={onAdjust}>Điều chỉnh giá vốn</Button>}
      <LockNote />
    </section>
  );
}

function HistoryTab({ hist }: { hist: ReturnType<typeof useSWR<History>> }) {
  if (hist.isLoading) return <Skeleton h={120} />;
  if (hist.error || !hist.data) return <div className="g wf-pad"><p className="wf-fld-err">{errMsg(hist.error)}</p></div>;
  const lbl = (s: string | null) => (s ? statusInfo("unit", s).label : "—");
  return (
    <div className="wf-stack">
      <section className="g wf-pad" aria-label="Lịch sử trạng thái">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Trạng thái</h3>
        {hist.data.status.length === 0 ? <p className="wf-mute">Chưa có lịch sử.</p> : <Timeline items={hist.data.status.map((s) => ({ title: s.from ? `${lbl(s.from)} → ${lbl(s.to)}` : lbl(s.to), meta: `${formatDateTimeVn(s.at)} · ${s.actorName ?? "Hệ thống"}${s.reason ? ` · ${s.reason}` : ""}` }))} />}
      </section>
      <section className="g wf-pad" aria-label="Lịch sử vị trí">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Vị trí</h3>
        {hist.data.movements.length === 0 ? <p className="wf-mute">Chưa di chuyển lần nào.</p> : <Timeline items={hist.data.movements.map((m) => ({ title: `${m.fromName ?? "—"} → ${m.toName ?? "—"}`, meta: `${formatDateTimeVn(m.at)} · ${m.actorName ?? "Hệ thống"}${m.note ? ` · ${m.note}` : ""}` }))} />}
      </section>
    </div>
  );
}

function PriceModal({ open, u, onClose, onDone }: { open: boolean; u: UnitDetail; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [list, setList] = useState<number | null>(u.listPrice);
  const [promo, setPromo] = useState<number | null>(u.promoPrice);
  const [from, setFrom] = useState(u.promoFrom ?? "");
  const [to, setTo] = useState(u.promoTo ?? "");
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setList(u.listPrice); setPromo(u.promoPrice); setFrom(u.promoFrom ?? ""); setTo(u.promoTo ?? ""); setReason(""); setErrs({}); }
  }, [open, u]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (list === null) return setErrs({ listPrice: "Nhập giá niêm yết" });
    if (promo !== null && promo >= list) return setErrs({ promo: "Giá khuyến mãi phải thấp hơn giá niêm yết" });
    if (promo !== null && (!from || !to)) return setErrs({ dates: "Chọn khoảng ngày khuyến mãi" });
    setBusy(true);
    setErrs({});
    try {
      await sapi(`/api/v1/catalog/units/${u.id}/price`, { body: { listPrice: list, promoPrice: promo, promoFrom: promo !== null ? from : null, promoTo: promo !== null ? to : null, reason: reason || undefined, version: u.version }, idempotencyKey: newIdempotencyKey() });
      toast.success("Đã lưu giá");
      await onDone();
    } catch (x) {
      const f = fieldErrors(x);
      setErrs(Object.keys(f).length ? f : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Sửa giá bán">
      <form onSubmit={submit} noValidate>
        <Field label="Giá niêm yết" required error={errs.listPrice}><MoneyInput data-autofocus value={list} onChange={setList} /></Field>
        <Field label="Giá khuyến mãi (để trống nếu không có)" error={errs.promo}><MoneyInput value={promo} onChange={setPromo} /></Field>
        {promo !== null && (
          <Field label="Khuyến mãi từ ngày – đến ngày" error={errs.dates}>
            <DateRange from={from} to={to} onChange={(r) => { setFrom(r.from); setTo(r.to); }} />
          </Field>
        )}
        <Field label="Lý do (tùy chọn)" hint="Ghi vào lịch sử giá"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy}>Lưu giá</Button>
        </div>
      </form>
    </Modal>
  );
}

function MoveModal({ open, u, busy, onClose, onSubmit }: { open: boolean; u: UnitDetail; busy: boolean; onClose: () => void; onSubmit: (locationId: string, note: string) => void }) {
  const locs = useLocations(open);
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) { setLoc(""); setNote(""); }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Đổi vị trí" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!loc || loc === u.location?.id} onClick={() => onSubmit(loc, note)}>Chuyển</Button></>}>
      <p className="wf-mute" style={{ marginBottom: 8 }}>Hiện ở: {u.location?.name ?? "chưa đặt"}</p>
      <Field label="Vị trí mới"><Select data-autofocus placeholder="Chọn vị trí" value={loc} onChange={(e) => setLoc(e.target.value)} options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} /></Field>
      <Field label="Ghi chú (tùy chọn)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
    </Modal>
  );
}

function RestoreModal({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (locationId: string, reason: string) => void }) {
  const locs = useLocations(open);
  const [loc, setLoc] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) { setLoc(""); setReason(""); }
  }, [open]);
  const missing = Math.max(0, 10 - reason.trim().length);
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Khôi phục chiếc về kho" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!loc || missing > 0} onClick={() => onSubmit(loc, reason.trim())}>Khôi phục</Button></>}>
      <Field label="Đặt vào vị trí" required><Select placeholder="Chọn vị trí" value={loc} onChange={(e) => setLoc(e.target.value)} options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} /></Field>
      <Field label="Lý do" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
      <p className="wf-mute">Cần xác nhận lại mật khẩu.</p>
    </Modal>
  );
}

function EditModal({ open, u, onClose, onDone }: { open: boolean; u: UnitDetail; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const [cond, setCond] = useState(u.condition);
  const [grade, setGrade] = useState(u.conditionGrade ?? "");
  const [cnote, setCnote] = useState(u.conditionNote ?? "");
  const [note, setNote] = useState(u.note ?? "");
  const [war, setWar] = useState(u.manufacturerWarrantyUntil ?? "");
  const [acc, setAcc] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCond(u.condition); setGrade(u.conditionGrade ?? ""); setCnote(u.conditionNote ?? ""); setNote(u.note ?? ""); setWar(u.manufacturerWarrantyUntil ?? "");
      setAcc(u.accessories.filter((a) => a.present).map((a) => a.kind)); setErrs({});
    }
  }, [open, u]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      await sapi(`/api/v1/catalog/units/${u.id}`, {
        method: "PATCH", ifMatch: u.version,
        body: {
          condition: cond, conditionGrade: grade.trim() || null, conditionNote: cnote.trim() || null, note: note.trim() || null,
          manufacturerWarrantyUntil: war || null,
          accessories: ACCESSORY_KINDS.filter((k) => acc.includes(k) || u.accessories.some((a) => a.kind === k)).map((k) => ({ kind: k, present: acc.includes(k) })),
        },
      });
      toast.success("Đã lưu thông tin");
      await onDone();
    } catch (x) {
      const f = fieldErrors(x);
      setErrs(Object.keys(f).length ? f : { form: errMsg(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Sửa thông tin chiếc">
      <form onSubmit={submit} noValidate>
        <Field label="Tình trạng máy"><Select value={cond} onChange={(e) => setCond(e.target.value)} options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c] }))} /></Field>
        <Field label="Hạng / % mới" hint="A, B, C hoặc phần trăm, ví dụ 95%" error={errs.conditionGrade}><TextInput value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} maxLength={5} /></Field>
        <Field label="Ghi chú tình trạng"><Textarea rows={2} value={cnote} onChange={(e) => setCnote(e.target.value)} /></Field>
        <Field label="Bảo hành hãng đến ngày"><DateInput value={war} onChange={(v) => setWar(v)} /></Field>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
          <legend className="wf-fld-label">Phụ kiện đi kèm</legend>
          {ACCESSORY_KINDS.map((k) => (
            <Checkbox key={k} checked={acc.includes(k)} onChange={(c) => setAcc(c ? [...acc, k] : acc.filter((x) => x !== k))} label={ACCESSORY_LABELS[k]} />
          ))}
        </fieldset>
        <Field label="Ghi chú"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
        <div className="wf-modal-f">
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy}>Lưu</Button>
        </div>
      </form>
    </Modal>
  );
}

function CostAdjustModal({ open, u, onClose, onDone }: { open: boolean; u: UnitDetail; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast();
  const { withReauth } = useReauth();
  const [dir, setDir] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setDir("up"); setAmount(null); setReason(""); setErr(null); }
  }, [open]);
  const missing = Math.max(0, 10 - reason.trim().length);
  const submit = async () => {
    if (!amount) return;
    setBusy(true);
    setErr(null);
    try {
      const key = newIdempotencyKey();
      await withReauth(() => sapi(`/api/v1/catalog/units/${u.id}/cost-adjust`, { body: { amount: dir === "up" ? amount : -amount, reason: reason.trim() }, idempotencyKey: key }));
      toast.success("Đã điều chỉnh giá vốn");
      await onDone();
    } catch (x) {
      if (!isReauthCancelled(x)) setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Điều chỉnh giá vốn" footer={<><Button onClick={onClose} disabled={busy}>Hủy</Button><Button variant="primary" loading={busy} disabled={!amount || missing > 0} onClick={() => void submit()}>Ghi bút toán</Button></>}>
      <p className="wf-confirm-msg">Giá vốn hiện tại {u.cost != null ? formatVnd(u.cost) : "—"}. Bút toán được ghi lại vĩnh viễn kèm lý do; cần xác nhận lại mật khẩu.</p>
      <SegmentedControl ariaLabel="Hướng điều chỉnh" value={dir} onChange={setDir} options={[{ value: "up", label: "Tăng giá vốn" }, { value: "down", label: "Giảm giá vốn" }]} />
      <div style={{ height: 12 }} />
      <Field label="Số tiền điều chỉnh" required><MoneyInput data-autofocus value={amount} onChange={setAmount} /></Field>
      <Field label="Lý do" required hint={missing > 0 ? `Nhập thêm ít nhất ${missing} ký tự` : undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
      {err && <p className="wf-fld-err" role="alert">{err}</p>}
    </Modal>
  );
}

function WarrantyTab({ u }: { u: UnitDetail }) {
  const { can } = useSession();
  const key = u.serialNo ?? u.assetCode;
  const rep = useSWR<{ items: RepairListItem[] }>(can("repair.view") ? `/api/v1/repairs/by-serial?serial=${encodeURIComponent(key)}` : null, swrFetcher);
  const war = useSWR<{ items: Warranty[] }>(can(["warranty.view", "repair.view"]) ? `/api/v1/warranties?q=${encodeURIComponent(u.assetCode)}&pageSize=10` : null, swrFetcher);
  return (
    <div className="wf-stack">
      <section aria-label="Bảo hành"><div className="wf-sec"><h3>Bảo hành</h3></div>
        {war.data && war.data.items.length > 0 ? (
          <InsetList>{war.data.items.map((w) => <InsetRow key={w.id} title={w.code} subtitle={`${formatDateVn(w.startDate)} – ${formatDateVn(w.endDate)} · ${w.customerName ?? ""}`} end={<StatusChip kind="warranty" status={w.effectiveStatus === "active" ? warrantyStatus(w.daysLeft) : w.effectiveStatus} />} />)}</InsetList>
        ) : <div className="g wf-pad"><p className="wf-mute">Chưa có bảo hành (cấp khi bán).</p></div>}
      </section>
      <section aria-label="Lịch sử sửa chữa"><div className="wf-sec"><h3>Lịch sử sửa chữa theo serial</h3></div>
        {rep.data && rep.data.items.length > 0 ? (
          <InsetList>{rep.data.items.map((r) => <InsetRow key={r.id} href={`/sua-chua/${r.id}`} title={r.code} subtitle={`${formatDateVn(r.receivedAt)} · ${r.complaint ?? ""}`} end={<StatusChip kind="repair" status={r.status} />} />)}</InsetList>
        ) : <div className="g wf-pad"><p className="wf-mute">{can("repair.view") ? "Máy chưa từng sửa." : "Bạn không xem được lịch sử sửa chữa."}</p></div>}
      </section>
    </div>
  );
}
