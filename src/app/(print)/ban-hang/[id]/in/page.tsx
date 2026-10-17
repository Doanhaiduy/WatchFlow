"use client";
import { joinTitle } from "@/components/catalog/types";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import type { SaleDetail } from "@/components/trade/types";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PdfButtons } from "@/components/pdf/PdfButtons";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useStoreInfo, type StoreInfo } from "@/lib/store-info";
import { METHOD_LABELS } from "@/lib/types/payments";

const storeVal = (s: StoreInfo["store"] | undefined, k: string): string =>
  s ? ({ "store.name": s.name, "store.address": s.address, "store.phone": s.phone, "store.receipt_footer": s.receiptFooter } as Record<string, string>)[k] ?? "" : "";

/** Phiếu bán 80mm (nhiệt). Thông tin cửa hàng lấy từ cài đặt nếu người in có quyền xem cài đặt; không thì dùng tên mặc định. */
export default function SaleReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, isLoading, mutate } = useSWR<SaleDetail>(`/api/v1/sales/${id}`, swrFetcher);
  const info = useStoreInfo();
  const [reprint, setReprint] = useState<{ n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Mỗi lượt in (nút hoặc Ctrl+P/menu trình duyệt) ghi nhận đúng MỘT lần (BR-SALE-11)
  const marked = useRef(false);
  const reprintRef = useRef<{ n: number } | null>(null);
  const mark = async () => {
    if (marked.current) return;
    marked.current = true;
    const r = await sapi<{ printCount: number; reprint: boolean }>(`/api/v1/sales/${id}/print`, { method: "POST", body: {} });
    reprintRef.current = r.reprint ? { n: r.printCount } : null;
    setReprint(reprintRef.current);
  };
  // Phiếu đã in trước đó ⇒ hiện "BẢN IN LẠI" ngay (kể cả khi in bằng Ctrl+P — lúc đó không kịp chờ máy chủ)
  useEffect(() => {
    if (s && s.printCount > 0 && !marked.current) setReprint({ n: s.printCount + 1 });
  }, [s]);
  const markRef = useRef(mark);
  markRef.current = mark;
  useEffect(() => {
    const before = () => void markRef.current().catch(() => {});
    const after = () => { marked.current = false; void mutate(); };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, [mutate]);
  const printNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await mark();
    } catch {
      /* không chặn việc in nếu ghi nhận lỗi */
    }
    setTimeout(() => { window.print(); setBusy(false); }, 150);
  };
  const st = (k: string) => storeVal(info.data?.store, k);
  // PDF: cũng là một lần phát hành phiếu ⇒ ghi nhận in (lần đầu: bản gốc; sau đó: BẢN IN LẠI) rồi dựng bằng chính số lần đó
  const buildPdf = async () => {
    if (!s) throw new Error("Phiếu chưa tải xong.");
    try {
      await mark();
    } catch {
      /* không chặn việc tạo PDF nếu ghi nhận lỗi */
    }
    const prior = s.printCount > 0 && !reprintRef.current ? { n: s.printCount + 1 } : reprintRef.current;
    const [{ buildSalePdf }] = await Promise.all([import("@/lib/pdf/sale")]);
    const out = await buildSalePdf(s, info.data?.store ?? { name: "", address: "", phone: "", taxCode: "", receiptFooter: "", warrantyTerms: "", repairTerms: "" }, prior);
    marked.current = false;
    void mutate();
    return out;
  };
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <style>{"@page{size:80mm auto;margin:0}"}</style>
      <div className="wf-no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }}>In phiếu bán</h1>
        <p className="wf-mute">Khổ 80mm (máy in nhiệt). Với A5 chọn khổ giấy trong hộp thoại in.</p>
      </div>
      {isLoading ? <Skeleton w="80mm" h={300} radius={6} /> : error || !s ? (
        <div className="g wf-pad wf-no-print"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
      ) : (
        <>
          <div className="wf-receipt" aria-label={`Phiếu ${s.code}`}>
            {reprint && <p style={{ textAlign: "center", fontWeight: 800, border: "1.5px solid currentColor", padding: "1mm 0", margin: "0 0 2mm" }}>BẢN IN LẠI (lần {reprint.n})</p>}
            <h1>{st("store.name") || "WatchFlow"}</h1>
            {st("store.address") && <p style={{ textAlign: "center", fontSize: "9pt" }}>{st("store.address")}</p>}
            {st("store.phone") && <p style={{ textAlign: "center", fontSize: "9pt" }}>ĐT: {st("store.phone")}</p>}
            <hr />
            <div className="rl"><span>Phiếu</span><b>{s.code}</b></div>
            <div className="rl"><span>Ngày</span><span>{formatDateVn(s.docDate)}</span></div>
            <div className="rl"><span>Khách</span><span>{s.customerName ?? "Khách lẻ"}</span></div>
            <hr />
            {s.lines.map((l) => (
              <div key={l.id} style={{ marginBottom: "2mm" }}>
                <div>{l.lineType === "watch" ? joinTitle(l.brandName, l.modelName) : `${l.partName} × ${l.qty}`}</div>
                <div className="rl" style={{ fontSize: "9pt" }}><span>{l.assetCode ?? l.partCode}{l.serialNo ? ` · SN ${l.serialNo}` : ""}</span><b>{formatVnd(l.lineTotal)}</b></div>
              </div>
            ))}
            <hr />
            {s.discountTotal > 0 && <div className="rl"><span>Giảm giá</span><span>−{formatVnd(s.discountTotal)}</span></div>}
            {s.tradeInTotal > 0 && <div className="rl"><span>Thu cũ</span><span>−{formatVnd(s.tradeInTotal)}</span></div>}
            {s.depositApplied > 0 && <div className="rl"><span>Cọc đã trừ</span><span>−{formatVnd(s.depositApplied)}</span></div>}
            <div className="rl" style={{ fontSize: "13pt", fontWeight: 800 }}><span>Phải thu</span><span>{formatVnd(s.balance?.payable ?? s.grandTotal)}</span></div>
            {s.payments.filter((p) => p.status === "posted").map((p) => <div key={p.id} className="rl"><span>{METHOD_LABELS[p.method]}</span><span>{formatVnd(p.amount)}</span></div>)}
            {s.cashTendered && s.payments.some((p) => p.method === "cash") && <div className="rl"><span>Khách đưa</span><span>{formatVnd(s.cashTendered)}</span></div>}
            {(s.balance?.due ?? 0) > 0 && <div className="rl"><b>Còn nợ{s.dueDate ? ` (hẹn ${formatDateVn(s.dueDate)})` : ""}</b><b>{formatVnd(s.balance!.due)}</b></div>}
            {s.warranties.length > 0 && (<><hr /><div style={{ fontSize: "9pt" }}>Bảo hành: {s.warranties.map((w) => `${w.code} đến ${formatDateVn(w.endDate)}`).join("; ")}</div></>)}
            {st("store.receipt_footer") && (<><hr /><p style={{ textAlign: "center", fontSize: "9pt" }}>{st("store.receipt_footer")}</p></>)}
          </div>
          <div className="wf-no-print wf-dev-row" style={{ marginTop: 16 }}>
            <Button variant="primary" icon={<Printer size={18} aria-hidden="true" />} onClick={() => void printNow()} disabled={busy}>In phiếu</Button>
            <PdfButtons build={buildPdf} disabled={busy || info.isLoading} />
            <Link href={`/ban-hang/${id}`} className="wf-btn" style={{ textDecoration: "none" }}><ArrowLeft size={18} aria-hidden="true" /> Quay lại phiếu</Link>
          </div>
        </>
      )}
    </div>
  );
}
