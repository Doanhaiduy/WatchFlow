"use client";
import { CheckCircle2, Package } from "lucide-react";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { errMsg, fieldErrors, sapi } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { joinTitle } from "@/components/catalog/types";
import type { MyOffer } from "@/components/collab/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { ProductCard } from "@/components/ui/ProductCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { Textarea, TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { WatchArt, artSeed } from "@/components/ui/WatchArt";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Màn của CTV (CF-10…CF-12): các chiếc cửa hàng giao cho bạn (kèm giá niêm yết tham khảo) + nút “Đã bán”. KHÔNG doanh thu/giá vốn. */
function CtvHomeView() {
  const { can } = useSession();
  const toast = useToast();
  const focusSearch = useSearchParams().get("tim") === "1";
  const [q, setQ] = useState("");
  const { data, error, isLoading, mutate } = useSWR<{ items: MyOffer[] }>(can("collab.view_own") ? "/api/v1/collab/me/units" : null, swrFetcher, { refreshInterval: 60_000 });
  const items = (data?.items ?? []).filter((u) => !q.trim() || norm(`${joinTitle(u.brandName, u.modelName)} ${u.assetCode} ${u.serialNo ?? ""}`).includes(norm(q.trim())));
  const [sel, setSel] = useState<MyOffer | null>(null);
  const [f, setF] = useState({ name: "", phone: "", note: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  const open = (u: MyOffer) => { setSel(u); setF({ name: "", phone: "", note: "" }); setErrs({}); key.current = newIdempotencyKey(); };
  const submit = async () => {
    if (!sel) return;
    setBusy(true);
    setErrs({});
    try {
      await sapi("/api/v1/collab/me/claims", { body: { unitId: sel.id, customerName: f.name.trim(), customerPhone: f.phone, note: f.note.trim() || null }, idempotencyKey: key.current });
      toast.success("Đã báo bán", "Cửa hàng sẽ xác nhận. Bạn nhận thông báo khi có kết quả.");
      setSel(null);
      await mutate();
    } catch (e) {
      key.current = newIdempotencyKey();
      const fe = fieldErrors(e);
      setErrs(Object.keys(fe).length ? { name: fe.customerName ?? "", phone: fe.customerPhone ?? "" } : { form: errMsg(e) });
      if (!Object.keys(fe).length) await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Hàng của tôi" description="Cửa hàng giao cho bạn bán — bán được thì bấm “Đã bán”" />
      <RequirePerm perm="collab.view_own">
        {data && data.items.length > 0 && (data.items.length > 3 || focusSearch) && <SearchBar value={q} onChange={setQ} autoFocus={focusSearch} placeholder="Tìm theo tên, mã hoặc serial…" />}
        {isLoading ? (
          <SkeletonGroup className="wf-pgrid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="wf-pc g"><Skeleton h={150} radius={18} /></div>)}</SkeletonGroup>
        ) : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad"><EmptyState icon={<Package size={24} />} title="Chưa có đồng hồ nào được giao cho bạn" description="Khi cửa hàng giao đồng hồ, danh sách hiện ở đây và bạn nhận thông báo." /></div>
        ) : items.length === 0 ? (
          <div className="g wf-pad"><EmptyState variant="search" icon={<Package size={24} />} title="Không có chiếc khớp" description="Thử tên hoặc mã khác." /></div>
        ) : (
          <div className="wf-pgrid">
            {items.map((u) => (
              <ProductCard
                key={u.id}
                name={joinTitle(u.brandName, u.modelName)}
                code={u.assetCode}
                action={u.claimId ? { label: "Đã báo bán — chờ xác nhận", disabled: true } : u.taken ? { label: "CTV khác đã báo bán", disabled: true, hint: "Ai báo trước thì được giữ chiếc" } : { label: "Đã bán", onClick: () => open(u) }}
                price={u.listPrice}
                imageSrc={u.thumbUrl ?? undefined}
                placeholder={<WatchArt seed={artSeed(u.brandName, u.modelName)} brand={u.brandName} model={u.modelName} />}
              />
            ))}
          </div>
        )}
        {data && data.items.length > 0 && <p className="wf-mute" style={{ marginTop: 10 }}>Giá hiển thị là giá niêm yết tham khảo. Một chiếc có thể được giao cho nhiều CTV: ai báo “Đã bán” trước thì được giữ chiếc đó.</p>}

        <Modal open={!!sel} onClose={() => setSel(null)} busy={busy} dirty={!!sel && (!!f.name || !!f.phone || !!f.note)} title={sel ? `Đã bán ${sel.assetCode}` : ""}>
          {sel && (
            <form className="wf-stack" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
              <p className="wf-mute">{joinTitle(sel.brandName, sel.modelName)}. Nhập thông tin khách đã mua để cửa hàng lập đơn và bảo hành.</p>
              <Field label="Họ tên khách" required error={errs.name}><TextInput data-autofocus value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} autoComplete="off" /></Field>
              <Field label="Số điện thoại khách" required error={errs.phone}><PhoneInput value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} /></Field>
              <Field label="Ghi chú (tùy chọn)"><Textarea rows={2} value={f.note} maxLength={500} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></Field>
              {errs.form && <p className="wf-fld-err" role="alert">{errs.form}</p>}
              <div className="wf-modal-f">
                <ModalClose disabled={busy}>Hủy</ModalClose>
                <Button type="submit" variant="primary" loading={busy} disabled={!f.name.trim() || f.phone.length < 8} icon={<CheckCircle2 size={16} aria-hidden="true" />}>Báo đã bán</Button>
              </div>
            </form>
          )}
        </Modal>
      </RequirePerm>
    </>
  );
}

export default function CtvHome() {
  return (
    <Suspense fallback={null}>
      <CtvHomeView />
    </Suspense>
  );
}
