"use client";
import { joinTitle } from "@/components/catalog/types";
import { Boxes, Check, ClipboardList, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Part, UnitDto } from "@/components/catalog/types";
import { unitTitle } from "@/components/catalog/types";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { DetentSheet, type Detent } from "@/components/lucian/DetentSheet";
import { PaymentSheet, type PaymentLineInput } from "@/components/payments";
import { TradeInModal, type TradeInValue } from "@/components/trade/TradeInModal";
import { UnitSearch } from "@/components/trade/UnitSearch";
import { useDebounced } from "@/components/trade/useDebounced";
import { useIsDesktop } from "@/components/trade/useIsDesktop";
import { watchBody } from "@/components/trade/WatchFields";
import type { Reservation, SaleConfirmResult, SaleDetail } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { detectProfile } from "@/components/layout/nav";
import { LockNote } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { TextInput } from "@/components/ui/TextInput";
import { useDirtyGuard } from "@/components/ui/useDirtyGuard";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, api, newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

/** `art` = hãng/loại để vẽ ảnh đồng hồ khi chưa có ảnh thật (chỉ để hiển thị, không gửi lên máy chủ) */
type Line = { key: string; kind: "watch" | "part"; unitId?: string; partId?: string; label: string; code: string; qty: number; unitPrice: number | null; art?: { brand: string; model: string } };
let seq = 0;
const nk = () => `c${++seq}`;

/** Phần nội dung phiếu nháp người dùng sửa (state của màn hình) */
type Draft = { lines: Line[]; customer: PickedCustomer | null; orderDiscount: number | null; dueDate: string; note: string; reservationId: string | null; tradeIns: TradeInValue[] };

/** Nội dung gửi lên máy chủ khi lưu nháp — MỘT hàm duy nhất để so sánh "đã lưu chưa" luôn nhất quán */
function toBody(s: Draft) {
  return {
    customerId: s.customer?.id ?? null,
    reservationId: s.reservationId,
    orderDiscount: s.orderDiscount ?? 0,
    dueDate: s.dueDate || null,
    note: s.note.trim() || null,
    lines: s.lines.map((l) => (l.kind === "watch" ? { lineType: "watch" as const, unitId: l.unitId!, unitPrice: l.unitPrice ?? 0 } : { lineType: "part" as const, partId: l.partId!, qty: l.qty, unitPrice: l.unitPrice ?? 0 })),
    tradeIns: s.tradeIns.map((t) => ({ credit: t.credit ?? 0, ...watchBody(t.v), modelId: t.v.modelId, locationId: t.v.locationId, listPrice: t.v.listPrice ?? null })),
  };
}

/** Dựng lại state màn hình từ phiếu nháp máy chủ trả về */
function draftFromDetail(d: SaleDetail): Draft {
  return {
    lines: d.lines.map((l) => ({ key: nk(), kind: l.lineType, unitId: l.unitId ?? undefined, partId: l.partId ?? undefined, label: l.lineType === "watch" ? joinTitle(l.brandName, l.modelName) : (l.partName ?? "Linh kiện"), code: l.assetCode ?? l.partCode ?? "", qty: l.qty, unitPrice: l.unitPrice, art: l.lineType === "watch" ? { brand: l.brandName ?? "", model: l.modelName ?? "" } : undefined })),
    customer: d.customerId ? { id: d.customerId, fullName: d.customerName ?? "Khách", phone: d.customerPhone } : null,
    orderDiscount: d.orderDiscount,
    dueDate: d.dueDate ?? "",
    note: d.note ?? "",
    reservationId: d.reservationId,
    tradeIns: d.tradeIns.filter((t) => t.draftLine).map((t) => ({ key: nk(), credit: t.credit, v: { modelId: t.draftLine!.modelId, serialNo: t.draftLine!.serialNo ?? "", hasSerial: t.draftLine!.hasSerial, condition: t.draftLine!.condition, conditionGrade: t.draftLine!.conditionGrade ?? "", conditionNote: t.draftLine!.conditionNote ?? "", initialStatus: t.draftLine!.initialStatus, locationId: t.draftLine!.locationId, listPrice: t.draftLine!.listPrice ?? null } })),
  };
}

/** Dạng chuẩn của nội dung một phiếu máy chủ — để biết nội dung có thật sự khác với lần lưu gần nhất không */
const canon = (d: SaleDetail) => JSON.stringify(toBody(draftFromDetail(d)));

function PartPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: Part) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const res = useSWR<{ items: Part[] }>(open ? `/api/v1/parts?pageSize=10${dq ? `&q=${encodeURIComponent(dq)}` : ""}` : null, swrFetcher);
  return (
    <Modal open={open} onClose={onClose} title="Thêm linh kiện lẻ">
      <SearchBar value={q} onChange={setQ} placeholder="Tìm mã hoặc tên linh kiện…" />
      <InsetList>
        {(res.data?.items ?? []).filter((p) => p.isActive && p.qtyOnHand > 0).map((p) => (
          <InsetRow key={p.id} onClick={() => onPick(p)} title={p.name} subtitle={`${p.code} · còn ${p.qtyOnHand} ${p.uom}`} end={formatVnd(p.salePrice)} />
        ))}
      </InsetList>
    </Modal>
  );
}

export function PosView() {
  const { can, user: me } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const desktop = useIsDesktop();
  const toast = useToast();

  const [saleId, setSaleId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [orderDiscount, setOrderDiscount] = useState<number | null>(0);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [tradeIns, setTradeIns] = useState<TradeInValue[]>([]);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [detent, setDetent] = useState<Detent>(0);
  const [err, setErr] = useState<string | null>(null);
  /** Nội dung phiếu trên máy chủ đã bị đổi ở nơi khác ⇒ không tự ghi đè, hỏi người dùng tải lại */
  const [conflict, setConflict] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const [partOpen, setPartOpen] = useState(false);
  const [tiOpen, setTiOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ r: SaleConfirmResult; sale: SaleDetail } | null>(null);
  const [loading, setLoading] = useState(false);
  const confirmKey = useRef(newIdempotencyKey());
  const createKey = useRef(newIdempotencyKey());
  /** Nội dung đã dùng khóa tạo phiếu — thử lại cùng nội dung thì giữ khóa (chống tạo trùng), nội dung khác thì đổi khóa */
  const createJson = useRef("");
  const versionRef = useRef<number | undefined>(undefined);
  const hydrated = useRef(false);
  const saleIdRef = useRef<string | null>(null);
  const doneRef = useRef(false);
  /** Vòng lưu đang chạy (một lúc chỉ MỘT yêu cầu ghi nháp bay) + cờ "còn thay đổi cần lưu" */
  const running = useRef<Promise<boolean> | null>(null);
  const needSave = useRef(false);
  /** Nội dung (dạng chuẩn) máy chủ có ở lần đồng bộ gần nhất — để phân biệt "chỉ lệch số phiên bản" với "người khác đã sửa" */
  const syncedCanon = useRef("");

  const body = useMemo(() => toBody({ customer, reservationId, orderDiscount, dueDate, note, lines, tradeIns }), [customer, reservationId, orderDiscount, dueDate, note, lines, tradeIns]);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const refresh = useCallback(async (id: string) => {
    const d = await sapi<SaleDetail>(`/api/v1/sales/${id}`);
    setDetail(d);
    versionRef.current = d.version;
    return d;
  }, []);

  const lastSent = useRef("");
  // Ghi nháp có kiểm phiên bản (If-Match). 412 mà nội dung máy chủ không đổi (chỉ lệch số phiên bản: mất phản hồi lần trước, thao tác hai nơi…)
  // ⇒ lấy lại phiên bản rồi lưu lại một lần; nội dung máy chủ đã khác ⇒ KHÔNG ghi đè, báo xung đột.
  const patchDraft = useCallback(
    async (id: string, b: ReturnType<typeof toBody>, json: string) => {
      try {
        await sapi(`/api/v1/sales/${id}`, { method: "PATCH", ifMatch: versionRef.current, body: b });
      } catch (e) {
        if (!(e instanceof ApiClientError) || e.status !== 412) throw e;
        const d = await sapi<SaleDetail>(`/api/v1/sales/${id}`);
        if (d.status !== "draft") {
          doneRef.current = true;
          router.replace(`/ban-hang/${id}`);
          throw new ApiClientError(409, "WF-DOC-NOT-DRAFT", "Phiếu này đã được xác nhận hoặc hủy ở nơi khác.");
        }
        const dc = canon(d);
        if (dc !== syncedCanon.current && dc !== json) {
          setConflict(true);
          throw new ApiClientError(412, "WF-CONFLICT-VERSION", "Phiếu này vừa được người khác sửa nên chưa lưu được thay đổi của bạn. Tải lại phiếu để thấy bản mới nhất.");
        }
        versionRef.current = d.version;
        await sapi(`/api/v1/sales/${id}`, { method: "PATCH", ifMatch: d.version, body: b });
      }
    },
    [router],
  );

  // Lưu một lần nội dung MỚI NHẤT (POST lần đầu, sau đó PATCH); xong thì lấy lại GET để có số do máy chủ tính
  const saveOnce = useCallback(async (): Promise<boolean> => {
    if (doneRef.current) return true;
    const b = bodyRef.current;
    const json = JSON.stringify(b);
    if (json === lastSent.current) return true;
    const known = saleIdRef.current;
    if (!known && b.lines.length === 0 && b.tradeIns.length === 0) return true;
    setSaveState("saving");
    lastSent.current = json;
    try {
      let id = known;
      if (!id) {
        if (createJson.current !== json) {
          createKey.current = newIdempotencyKey();
          createJson.current = json;
        }
        id = (await sapi<{ id: string }>("/api/v1/sales", { body: b, idempotencyKey: createKey.current })).id;
        saleIdRef.current = id;
        setSaleId(id);
        window.history.replaceState(null, "", `/ban-hang/moi?sale=${id}`);
      } else {
        await patchDraft(id, b, json);
      }
      const d = await refresh(id);
      syncedCanon.current = canon(d);
      setErr(null);
      setConflict(false);
      setSaveState("saved");
      return true;
    } catch (e) {
      lastSent.current = "";
      if (!doneRef.current) {
        setErr(errMsg(e));
        setSaveState("error");
      }
      return false;
    }
  }, [patchDraft, refresh]);

  /** Chạy vòng lưu cho tới khi hết thay đổi; gọi lúc đang lưu ⇒ chờ vòng hiện tại rồi lưu nốt phần mới (không bao giờ hai yêu cầu cùng lúc) */
  const runSave = useCallback((): Promise<boolean> => {
    needSave.current = true;
    if (running.current) return running.current;
    const p = (async () => {
      try {
        let ok = true;
        while (needSave.current) {
          needSave.current = false;
          ok = await saveOnce();
          if (!ok) break;
        }
        return ok;
      } finally {
        running.current = null;
      }
    })();
    running.current = p;
    return p;
  }, [saveOnce]);

  const dbody = useDebounced(JSON.stringify(body), 700);
  useEffect(() => {
    if (!hydrated.current || done) return;
    if (dbody === lastSent.current) return;
    void runSave();
  }, [dbody, done, runSave]);

  // Giỏ chưa kịp lưu nháp (chưa tạo phiếu, đang chờ/đang/lỗi lưu) mà rời trang ⇒ hỏi "Bỏ thay đổi chưa lưu?"
  const unsaved = !done && (lines.length > 0 || tradeIns.length > 0) && (!saleId || saveState === "saving" || saveState === "error" || JSON.stringify(body) !== dbody);
  const guard = useDirtyGuard(unsaved);

  // Nạp nháp có sẵn (?sale=) hoặc thêm chiếc từ ?unit=. Nạp xong coi như ĐÃ ĐỒNG BỘ: không ghi lại lên máy chủ nếu người dùng chưa sửa gì.
  const loadSale = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const d = await sapi<SaleDetail>(`/api/v1/sales/${id}`);
        if (d.status !== "draft") return void router.replace(`/ban-hang/${id}`);
        const s = draftFromDetail(d);
        saleIdRef.current = id;
        setSaleId(id);
        setDetail(d);
        versionRef.current = d.version;
        setLines(s.lines);
        setCustomer(s.customer);
        setOrderDiscount(s.orderDiscount);
        setDueDate(s.dueDate);
        setNote(s.note);
        setReservationId(s.reservationId);
        setTradeIns(s.tradeIns);
        syncedCanon.current = JSON.stringify(toBody(s));
        lastSent.current = syncedCanon.current;
        setErr(null);
        setConflict(false);
        setSaveState("");
      } catch (e) {
        setErr(errMsg(e));
      } finally {
        setLoading(false);
        hydrated.current = true;
      }
    },
    [router],
  );
  // Cộng tác viên bán qua màn riêng (/ctv/tao-don), không dùng POS của cửa hàng
  const isCtv = detectProfile(can) === "ctv";
  useEffect(() => {
    if (isCtv) router.replace("/ctv/tao-don");
  }, [isCtv, router]);
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const sale = sp.get("sale");
    const unit = sp.get("unit");
    if (sale) void loadSale(sale);
    else {
      hydrated.current = true;
      if (unit) void api<UnitDto>(`/api/v1/catalog/units/${unit}`, { noRedirect: true }).then((u) => (u.status === "in_stock" ? addUnit(u) : setErr(`Chiếc ${u.assetCode} hiện không sẵn sàng bán.`))).catch((e) => setErr(errMsg(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = () => {
    confirmKey.current = newIdempotencyKey();
  };
  const addUnit = (u: UnitDto) => {
    touch();
    setLines((l) => (l.some((x) => x.unitId === u.id) ? l : [...l, { key: nk(), kind: "watch", unitId: u.id, label: unitTitle(u), code: u.assetCode, qty: 1, unitPrice: u.effectivePrice, art: { brand: u.brand.name, model: u.model.name } }]));
    if (!desktop) setDetent((d) => (d === 0 ? 1 : d));
  };
  const addPart = (p: Part) => {
    touch();
    setLines((l) => (l.some((x) => x.partId === p.id) ? l.map((x) => (x.partId === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...l, { key: nk(), kind: "part", partId: p.id, label: p.name, code: p.code, qty: 1, unitPrice: p.salePrice }]));
    setPartOpen(false);
  };
  const setLine = (key: string, p: Partial<Line>) => {
    touch();
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));
  };

  // Chiếc khách đang giữ (cọc)
  const held = useSWR<{ items: Reservation[] }>(customer && can("reservation.manage") ? `/api/v1/reservations?customerId=${customer.id}&status=active,expired` : null, swrFetcher);
  const myHold = held.data?.items.find((r) => r.id === reservationId);
  const convert = async (r: Reservation) => {
    try {
      const x = await sapi<{ saleId: string }>(`/api/v1/reservations/${r.id}/convert`, { method: "POST", idempotencyKey: newIdempotencyKey() });
      hydrated.current = false; // đang chuyển sang phiếu mới: đừng tự lưu cái giỏ tạm rỗng này
      setLines([]); setTradeIns([]);
      await loadSale(x.saleId);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  // Số cần thu: máy chủ tính sẵn (payablePreview đã trừ thu cũ và cọc áp dụng)
  const grand = detail?.grandTotal ?? 0;
  const trade = detail?.tradeInTotal ?? 0;
  const depositUse = detail?.depositApplied ?? 0;
  const payable = detail ? Math.max(0, detail.payablePreview ?? grand - trade - depositUse) : 0;
  // "Mới": đã lưu xong đúng nội dung đang hiển thị và đã lấy lại số do máy chủ tính (sửa giá xong chờ ~1 giây mới thanh toán được)
  const fresh = !!detail && saveState !== "saving" && JSON.stringify(body) === lastSent.current;
  const needCustomer = tradeIns.length > 0 && !customer;
  // Giảm vượt hạn mức của mình ⇒ khóa sớm kèm lý do (máy chủ vẫn kiểm WF-SALE-DISCOUNT-LIMIT khi xác nhận)
  const overLimit = me?.maxDiscountPct !== undefined && (detail?.discountPct ?? 0) > me.maxDiscountPct;
  const canPay = lines.length > 0 && fresh && can("sale.confirm") && !needCustomer && !overLimit;

  const confirm = async (pl: PaymentLineInput[]) => {
    const id = saleIdRef.current;
    if (!id) return;
    setPaying(true);
    setErr(null);
    try {
      // Chờ lưu xong mọi thay đổi (kể cả đang bay) rồi mới xác nhận trên đúng nội dung đó
      if (!(await runSave())) {
        setPayOpen(false);
        toast.error("Chưa lưu được nháp", "Xem thông báo phía trên phiếu rồi thử lại.");
        return;
      }
      const cash = pl.find((x) => x.method === "cash");
      const r = await sapi<SaleConfirmResult>(`/api/v1/sales/${id}/confirm`, {
        body: { payments: pl.map((x) => ({ method: x.method, amount: x.amount })), cashTendered: cash?.cashTendered ?? null },
        idempotencyKey: confirmKey.current,
      });
      doneRef.current = true;
      const sale = await sapi<SaleDetail>(`/api/v1/sales/${id}`);
      setPayOpen(false);
      setDetent(0);
      setDone({ r, sale });
    } catch (e) {
      confirmKey.current = newIdempotencyKey();
      const m = errMsg(e);
      setErr(m);
      toast.error("Chưa xác nhận được phiếu", m);
      setPayOpen(false);
    } finally {
      setPaying(false);
    }
  };

  const discard = async () => {
    setDiscarding(true);
    doneRef.current = true; // đang bỏ phiếu: dừng tự lưu để không tạo/ghi lại nháp vừa xóa
    if (saleId) await sapi(`/api/v1/sales/${saleId}`, { method: "DELETE" }).catch(() => undefined);
    window.location.assign("/ban-hang/moi");
  };

  const payBtn = (
    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
      <Button variant="primary" block disabled={!canPay} onClick={() => (payable === 0 ? void confirm([]) : setPayOpen(true))}>{payable === 0 ? "Xác nhận phiếu (không thu thêm)" : "Thanh toán"}</Button>
    </div>
  );

  const reloadSale = () => {
    const id = saleIdRef.current;
    if (id) void loadSale(id);
  };
  const retrySave = () => {
    lastSent.current = "";
    setErr(null);
    void runSave();
  };
  const errBanner = err ? (
    <div className="wf-lock" role="alert" style={{ background: "var(--wf-bad-t)", marginBottom: 12, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 180 }}>{err}</span>
      {conflict && saleId && <Button sm onClick={reloadSale}>Tải lại phiếu</Button>}
      {!conflict && saveState === "error" && <Button sm onClick={retrySave}>Thử lưu lại</Button>}
    </div>
  ) : null;
  const cart = (
    <div>
      {!desktop && detent > 0 && errBanner}
      {lines.length === 0 && tradeIns.length === 0 ? (
        <p className="wf-mute" style={{ padding: "12px 0" }}>Phiếu trống. Tìm và chạm chiếc để thêm vào.</p>
      ) : (
        lines.map((l, i) => {
          const sv = detail?.lines[i];
          return (
            <div key={l.key} className="wf-cart-line">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {l.art ? <span className="wf-th" aria-hidden="true"><WatchArt crop="head" seed={artSeed(l.art.brand, l.art.model)} brand={l.art.brand} model={l.art.model} /></span> : <span className="wf-ib" data-tone="repair" aria-hidden="true"><Boxes size={20} /></span>}
                <span style={{ minWidth: 0, flex: 1 }}><b style={{ display: "block" }}>{l.label}</b><span className="wf-mute" style={{ fontSize: 12 }}>{l.code}{sv && sv.listPrice !== l.unitPrice ? ` · niêm yết ${formatVnd(sv.listPrice)}` : ""}</span></span>
                <Button sm iconOnly aria-label={`Bỏ ${l.label} khỏi phiếu`} onClick={() => { touch(); setLines((a) => a.filter((x) => x.key !== l.key)); }}><Trash2 size={16} aria-hidden="true" /></Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: l.kind === "part" ? "90px 1fr" : "1fr", gap: 8, marginTop: 6 }}>
                {l.kind === "part" && <TextInput aria-label="Số lượng" inputMode="numeric" value={String(l.qty)} onChange={(e) => setLine(l.key, { qty: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />}
                <MoneyInput aria-label={`Giá bán ${l.label}`} value={l.unitPrice} onChange={(v) => setLine(l.key, { unitPrice: v })} />
              </div>
              {sv && (sv.lineDiscount > 0 || sv.allocDiscount > 0) && <p className="wf-mute" style={{ fontSize: 12, marginTop: 4 }}>Giảm {formatVnd(sv.lineDiscount + sv.allocDiscount)} · thành tiền {formatVnd(sv.lineTotal)}</p>}
              {sv?.cost !== undefined && sv.cost !== null && <p style={{ fontSize: 12, marginTop: 2, color: "var(--wf-nav)" }}>Giá thu {formatVnd(sv.cost)} · lãi {formatVnd(sv.lineTotal - sv.cost)}</p>}
            </div>
          );
        })
      )}
      {tradeIns.map((t) => (
        <div key={t.key} className="wf-cart-line" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span><b style={{ display: "block" }}>Máy cũ thu về</b><span className="wf-mute" style={{ fontSize: 12 }}>{t.v.serialNo || "không serial"} · trừ {formatVnd(t.credit ?? 0)}</span></span>
          <Button sm iconOnly aria-label="Bỏ máy cũ" onClick={() => { touch(); setTradeIns((a) => a.filter((x) => x.key !== t.key)); }}><X size={16} aria-hidden="true" /></Button>
        </div>
      ))}
      {lines.some((_, i) => detail?.lines[i]?.cost !== undefined) && <LockNote />}

      <div style={{ marginTop: 12 }}>
        <Field label="Giảm giá tổng phiếu"><MoneyInput value={orderDiscount} onChange={(v) => { touch(); setOrderDiscount(v); }} /></Field>
        <Field label="Hẹn trả (nếu còn nợ)"><DateInput value={dueDate} onChange={(v) => setDueDate(v)} /></Field>
      </div>

      {needCustomer && <p className="wf-fld-err" role="status" style={{ marginTop: 8 }}>Thu cũ đổi mới cần chọn khách (người bán máy cũ) trước khi thanh toán.</p>}
      {overLimit && <p className="wf-fld-err" role="status" style={{ marginTop: 8 }}>Giảm {detail?.discountPct}% vượt hạn mức {me?.maxDiscountPct}% của bạn — giảm bớt hoặc nhờ người có hạn mức cao hơn xác nhận.</p>}
      <div className="wf-sum" aria-live="polite">
        <div><span>Tiền hàng (niêm yết)</span><b>{formatVnd(detail?.subtotalList ?? 0)}</b></div>
        {(detail?.discountTotal ?? 0) > 0 && <div><span>Giảm giá ({detail?.discountPct}%)</span><b>−{formatVnd(detail!.discountTotal)}</b></div>}
        {trade > 0 && <div><span>Thu cũ</span><b>−{formatVnd(trade)}</b></div>}
        {depositUse > 0 && <div><span>Cọc đã nhận</span><b>−{formatVnd(depositUse)}</b></div>}
        {detail?.grossProfit !== undefined && <div><span>Lãi gộp</span><b>{formatVnd(detail.grossProfit)}</b></div>}
        <div className="tot"><span>Còn phải thu</span><b>{formatVnd(payable)}</b></div>
      </div>
      {desktop && payBtn}
      {saveState === "saving" && <p className="wf-mute" style={{ fontSize: 12, marginTop: 6 }}>Đang lưu nháp…</p>}
      {saveState === "saved" && <p className="wf-mute" style={{ fontSize: 12, marginTop: 6 }}>Đã lưu nháp tự động</p>}
      {(lines.length > 0 || saleId) && <button type="button" className="wf-mute" style={{ fontSize: 12, textDecoration: "underline", marginTop: 6, minHeight: 44 }} onClick={() => setDiscardOpen(true)}>Hủy phiếu nháp này</button>}
    </div>
  );

  if (isCtv) return null;
  if (done) {
    const { r, sale } = done;
    return (
      <>
        <PageHeader title="Đã bán" description={`Phiếu ${r.code}`} />
        <div className="wf-stack">
          <section className="g wf-pad" style={{ textAlign: "center" }} aria-label="Kết quả bán hàng">
            <span className="wf-ib" data-tone="ok" style={{ margin: "0 auto 8px", width: 56, height: 56, borderRadius: 20 }}><Check size={28} aria-hidden="true" /></span>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Phiếu {r.code}</h2>
            {sale.customerName && <p className="wf-mute">Khách: {sale.customerName}</p>}
            <div className="wf-uprice" style={{ margin: "6px 0" }}>{formatVnd(r.grandTotal)}</div>
            <div className="wf-sum" style={{ textAlign: "left" }}>
              {r.tradeIn > 0 && <div><span>Thu cũ</span><b>{formatVnd(r.tradeIn)}</b></div>}
              {r.depositApplied > 0 && <div><span>Cọc đã trừ</span><b>{formatVnd(r.depositApplied)}</b></div>}
              <div><span>Đã thu</span><b>{formatVnd(r.paid)}</b></div>
              {r.change > 0 && <div style={{ color: "var(--wf-ok-text)" }}><span>Tiền thừa trả khách</span><b>{formatVnd(r.change)}</b></div>}
              {r.due > 0 && <div style={{ color: "var(--wf-hold-text)" }}><span>Còn nợ{sale.dueDate ? ` · hẹn ${formatDateVn(sale.dueDate)}` : ""}</span><b>{formatVnd(r.due)}</b></div>}
            </div>
          </section>
          {sale.warranties.length > 0 && (
            <section aria-label="Bảo hành"><div className="wf-sec"><h3>Bảo hành đã cấp</h3></div>
              <InsetList>{sale.warranties.map((w) => <InsetRow key={w.id} title={w.code} subtitle={`Từ ${formatDateVn(w.startDate)} đến ${formatDateVn(w.endDate)}`} end={<StatusChip kind="warranty" status={w.status} />} />)}</InsetList>
            </section>
          )}
          <div className="wf-stack" style={{ gap: 10 }}>
            <Button variant="primary" block onClick={() => window.location.assign("/ban-hang/moi")}>Bán tiếp</Button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Button block href={`/ban-hang/${r.id}/in`}>In phiếu</Button>
              <Button block href={`/ban-hang/${r.id}`}>Xem phiếu</Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const heldList = (held.data?.items ?? []).filter((r) => r.id !== reservationId);
  return (
    <>
      <PageHeader title="Bán hàng" context={detail?.code ?? "Phiếu nháp"} description="Tìm hoặc quét chiếc, chọn khách, thanh toán" actions={can(["sale.view", "sale.view_own"]) ? <Button sm href="/ban-hang" icon={<ClipboardList size={16} aria-hidden="true" />}>Phiếu đã bán</Button> : undefined} />
      <RequirePerm perm="sale.create_draft">
        {(desktop || detent === 0) && errBanner}
        {loading ? <p className="wf-mute">Đang tải phiếu…</p> : (
          <div className="wf-pos">
            <div className="wf-stack">
              <section aria-label="Thêm chiếc">
                <UnitSearch onPick={addUnit} exclude={lines.filter((l) => l.unitId).map((l) => l.unitId!)} />
                <div className="wf-dev-row" style={{ marginTop: 10 }}>
                  {can("part.view") && <Button sm icon={<Plus size={14} aria-hidden="true" />} onClick={() => setPartOpen(true)}>Linh kiện lẻ</Button>}
                  {can("sale.create_draft") && <Button sm icon={<Plus size={14} aria-hidden="true" />} onClick={() => setTiOpen(true)}>Thêm máy cũ</Button>}
                </div>
              </section>
              <section className="g wf-pad" aria-label="Khách hàng">
                <CustomerPicker value={customer} onChange={(c) => { touch(); setCustomer(c); }} optional />
                {customer && !customer.phone && <p className="wf-mute" style={{ marginTop: 6 }}>Khách chưa có số điện thoại — chưa ghi nợ được.</p>}
                {heldList.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p className="wf-fld-label">Chiếc khách đang giữ (đã đặt cọc)</p>
                    <InsetList>
                      {heldList.map((r) => <InsetRow key={r.id} icon={<ShoppingBag size={18} />} tone={r.overdue ? "bad" : "hold"} title={r.modelName} subtitle={`${r.assetCode} · cọc ${formatVnd(r.held ?? 0)} · giữ đến ${formatDateVn(r.holdUntil)}`} end={<Button sm onClick={() => void convert(r)}>Bán chiếc này</Button>} />)}
                    </InsetList>
                  </div>
                )}
                {myHold && <p style={{ marginTop: 8 }}><StatusChip tone="hold">Có cọc {formatVnd(myHold.held ?? 0)} từ phiếu giữ {myHold.code}</StatusChip></p>}
              </section>
              {lines.length === 0 && tradeIns.length === 0 && (
                <div className="g wf-pad"><EmptyState title="Phiếu bán đang trống" description="Tìm chiếc theo mã, serial hoặc tên rồi chạm để thêm vào phiếu." icon={<ShoppingBag size={24} />} /></div>
              )}
            </div>
            {desktop && (
              <aside className="g wf-pad wf-pos-cart" aria-label="Phiếu bán">
                <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Phiếu bán</h2>
                {cart}
              </aside>
            )}
          </div>
        )}
        {!desktop && (
          <>
            <div className="wf-cartbar g" style={{ display: lines.length || tradeIns.length ? "flex" : "none" }}>
              <span style={{ flex: 1 }}><small>{lines.length} món · nháp</small><b>{fresh ? formatVnd(payable) : "Đang tính…"}</b></span>
              <Button variant="primary" onClick={() => setDetent(1)}>Xem phiếu</Button>
            </div>
            <DetentSheet detent={detent} onDetent={setDetent} busy={paying || discarding} title="Phiếu bán" subtitle={`${lines.length} món`} footer={<div className="wf-dev-row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><span><small className="wf-mute" style={{ display: "block" }}>Còn phải thu</small><b className="wf-num" style={{ fontSize: 20 }}>{formatVnd(payable)}</b></span><Button variant="primary" guard disabled={!canPay} onClick={() => (payable === 0 ? void confirm([]) : setPayOpen(true))}>{payable === 0 ? "Xác nhận" : "Thanh toán"}</Button></div>}>
              {cart}
            </DetentSheet>
          </>
        )}
        <ConfirmDialog open={discardOpen} danger loading={discarding} title="Hủy phiếu nháp này?" message="Phiếu nháp và các dòng đã chọn sẽ bị xóa. Chiếc chưa bị giữ nên không ảnh hưởng kho." confirmLabel="Hủy phiếu nháp" cancelLabel="Giữ lại" onCancel={() => setDiscardOpen(false)} onConfirm={() => void discard()} />
        {guard.dialog}
        <PartPicker open={partOpen} onClose={() => setPartOpen(false)} onPick={addPart} />
        <TradeInModal open={tiOpen} saleId={saleId} onClose={() => setTiOpen(false)} onSave={(t) => { touch(); setTradeIns((a) => [...a, t]); setTiOpen(false); }} />
        <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} payable={payable} allowDebt={!!customer?.phone} submitting={paying} onSubmit={(pl) => void confirm(pl)} title="Thanh toán phiếu bán" reference={detail?.code} fallbackRef={`BAN HANG ${(saleId ?? "").replace(/-/g, "").slice(0, 6)}`} />
      </RequirePerm>
    </>
  );
}
