"use client";
import { Check, Handshake, Phone, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import { CollabTabs } from "@/components/collab/CollabTabs";
import type { ClaimRow } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, todayVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useSession } from "@/lib/session";

const PAGE = 30;
type Res = { items: ClaimRow[]; total: number };
const WARRANTY = [{ value: "", label: "Mặc định (mới 12 tháng, cũ 3 tháng)" }, { value: "0", label: "Không bảo hành" }, { value: "3", label: "3 tháng" }, { value: "6", label: "6 tháng" }, { value: "12", label: "12 tháng" }, { value: "24", label: "24 tháng" }];

// Báo đã bán của CTV: xác nhận ⇒ tạo đơn bán (giá mặc định = giá niêm yết, sửa được) và các CTV khác mất quyền; hoặc từ chối.
export default function ClaimsPage() {
  const { can } = useSession();
  const toast = useToast();
  const [f, setF] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const status = f[0] === "done" ? "decided" : "pending";
  const { data, error, isLoading, mutate } = useSWR<Res>(can(["sale.confirm", "collab.view"]) ? `/api/v1/collab/claims?status=${status}&page=${page}&pageSize=${PAGE}` : null, swrFetcher, { keepPreviousData: true });
  const [ok, setOk] = useState<ClaimRow | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [date, setDate] = useState(todayVn());
  const [warranty, setWarranty] = useState("");
  const [rej, setRej] = useState<ClaimRow | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const manage = can("sale.confirm");

  const open = (c: ClaimRow) => { setOk(c); setPrice(c.listPrice || null); setDate(todayVn()); setWarranty(""); key.current = newIdempotencyKey(); };
  const confirm = async () => {
    if (!ok || !price) return;
    setBusy(true);
    try {
      const r = await sapi<{ code: string }>(`/api/v1/collab/claims/${ok.id}/confirm`, {
        body: { price, docDate: date, warrantyMonths: warranty === "" ? null : Number(warranty) }, idempotencyKey: key.current,
      });
      toast.success(`Đã xác nhận — đơn ${r.code}`);
      setOk(null);
      await mutate();
    } catch (e) {
      key.current = newIdempotencyKey();
      toast.error("Không xác nhận được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const reject = async (reason?: string) => {
    if (!rej) return;
    setBusy(true);
    try {
      await sapi(`/api/v1/collab/claims/${rej.id}/reject`, { body: { reason } });
      toast.success("Đã từ chối báo bán");
      setRej(null);
      await mutate();
    } catch (e) {
      toast.error("Không từ chối được", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Báo bán của CTV" description="Cộng tác viên báo đã bán — bạn xác nhận hoặc từ chối" />
      <RequirePerm perm={["sale.confirm", "collab.view"]}>
        <CollabTabs />
        <FilterChips ariaLabel="Lọc báo bán" value={f} onChange={(v) => { setF(v); setPage(1); }} options={[{ value: "done", label: "Đã xử lý" }]} />
        {isLoading ? <SkeletonList rows={4} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Handshake size={24} />} title={status === "pending" ? "Không có báo bán nào đang chờ" : "Chưa có báo bán nào được xử lý"} description={status === "pending" ? "Khi CTV bấm “Đã bán” ở chiếc được giao, báo bán hiện ở đây và bạn nhận thông báo." : undefined} /></div>
        ) : (
          <>
            <ul className="wf-rcards" aria-label="Báo bán">
              {data?.items.map((c) => (
                <li key={c.id} className="wf-rcard">
                  <div className="wf-dev-row" style={{ gap: 12, alignItems: "flex-start" }}>
                    <span className="wf-th">{c.thumbUrl ? <img src={c.thumbUrl} alt="" loading="lazy" width={48} height={48} /> : <WatchArt crop="head" seed={artSeed(c.brandName, c.modelName)} brand={c.brandName} model={c.modelName} />}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b className="wf-rcard-h" style={{ display: "block" }}>{joinTitle(c.brandName, c.modelName)}</b>
                      <span className="wf-mute" style={{ fontSize: 13 }}>{c.assetCode} · niêm yết {formatVnd(c.listPrice)}</span>
                    </span>
                    <StatusChip kind="claim" status={c.status} />
                  </div>
                  <dl className="wf-kv" style={{ marginTop: 8 }}>
                    <div><dt>CTV</dt><dd>{c.collaboratorName ?? "—"}</dd></div>
                    <div><dt>Khách</dt><dd>{c.customerName} · <a href={`tel:${c.customerPhone}`} style={{ color: "var(--wf-accent-text)" }}><Phone size={12} aria-hidden="true" /> {c.customerPhone}</a></dd></div>
                    {c.note && <div><dt>Ghi chú</dt><dd>{c.note}</dd></div>}
                    <div><dt>Báo lúc</dt><dd>{formatDateTimeVn(c.createdAt)}</dd></div>
                    {c.status === "confirmed" && c.saleId && <div><dt>Đơn bán</dt><dd><Link href={`/ban-hang/${c.saleId}`} style={{ color: "var(--wf-accent-text)", fontWeight: 600 }}>{c.saleCode}</Link>{can("report.sales") && c.salePrice ? ` · ${formatVnd(c.salePrice)}` : ""}</dd></div>}
                    {c.status === "rejected" && <div><dt>Lý do từ chối</dt><dd>{c.rejectReason}</dd></div>}
                  </dl>
                  {c.status === "pending" && manage && (
                    <div className="wf-dev-row" style={{ marginTop: 10 }}>
                      <Button variant="primary" icon={<Check size={16} aria-hidden="true" />} onClick={() => open(c)}>Xác nhận đã bán</Button>
                      <Button icon={<X size={16} aria-hidden="true" />} onClick={() => setRej(c)}>Từ chối</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}

        <Modal open={!!ok} onClose={() => setOk(null)} busy={busy} dirty={!!ok && price !== ok.listPrice} title={ok ? `Xác nhận bán ${ok.assetCode}` : ""}>
          {ok && (
            <div className="wf-stack">
              <p className="wf-mute">{joinTitle(ok.brandName, ok.modelName)} — CTV {ok.collaboratorName}, khách {ok.customerName}. Xác nhận sẽ tạo đơn bán, chiếc chuyển “Đã bán” và các CTV khác không còn thấy chiếc này.</p>
              <Field label="Giá bán (doanh thu cửa hàng)" required hint={`Mặc định là giá niêm yết ${formatVnd(ok.listPrice)}. CTV bán giá nào không cần ghi.`}>
                <MoneyInput value={price} onChange={setPrice} />
              </Field>
              <Field label="Ngày bán"><DateInput value={date} max={todayVn()} clearable={false} onChange={setDate} /></Field>
              <Field label="Bảo hành"><Select value={warranty} onChange={(e) => setWarranty(e.target.value)} options={WARRANTY} /></Field>
              <div className="wf-modal-f">
                <ModalClose disabled={busy}>Hủy</ModalClose>
                <Button variant="primary" loading={busy} disabled={!price || !date} onClick={() => void confirm()}>Xác nhận đã bán</Button>
              </div>
            </div>
          )}
        </Modal>
        <ConfirmDialog
          open={!!rej}
          requireReason
          loading={busy}
          title={`Từ chối báo bán ${rej?.assetCode ?? ""}?`}
          message="Chiếc quay lại cho các CTV được giao; CTV nhận thông báo kèm lý do của bạn."
          confirmLabel="Từ chối"
          onCancel={() => setRej(null)}
          onConfirm={(r) => void reject(r)}
        />
      </RequirePerm>
    </>
  );
}
