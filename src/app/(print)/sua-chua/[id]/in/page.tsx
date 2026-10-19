"use client";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import type { RepairDetail } from "@/components/repairs/types";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PdfButtons } from "@/components/pdf/PdfButtons";
import { statusInfo } from "@/components/ui/status";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn, formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { useStoreInfo, type StoreInfo } from "@/lib/store-info";

const storeVal = (s: StoreInfo["store"] | undefined, k: string): string =>
  s ? ({ "store.name": s.name, "store.address": s.address, "store.phone": s.phone, "store.receipt_footer": s.receiptFooter, "store.repair_terms": s.repairTerms } as Record<string, string>)[k] ?? "" : "";

function View() {
  const { id } = useParams<{ id: string }>();
  const giao = useSearchParams().get("loai") === "giao";
  const { data: r, error, isLoading, mutate } = useSWR<RepairDetail>(`/api/v1/repairs/${id}`, swrFetcher);
  const info = useStoreInfo();
  const st = (k: string) => storeVal(info.data?.store, k);
  const buildPdf = async () => {
    if (!r) throw new Error("Phiếu chưa tải xong.");
    const { buildRepairPdf } = await import("@/lib/pdf/repair");
    return buildRepairPdf(r, info.data?.store ?? { name: "", address: "", phone: "", taxCode: "", receiptFooter: "", warrantyTerms: "", repairTerms: "" }, giao);
  };
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <style>{"@page{size:80mm auto;margin:0}"}</style>
      <div className="wf-no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }}>{giao ? "In phiếu giao máy" : "In phiếu nhận máy"}</h1>
        <p className="wf-mute">Khổ 80mm (máy in nhiệt).</p>
      </div>
      {isLoading ? <Skeleton w="80mm" h={300} radius={6} /> : error || !r ? (
        <div className="g wf-pad wf-no-print"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
      ) : (
        <>
          <div className="wf-receipt" aria-label={`Phiếu ${r.code}`}>
            <h1>{st("store.name") || "WatchFlow"}</h1>
            {st("store.address") && <p style={{ textAlign: "center", fontSize: "9pt" }}>{st("store.address")}</p>}
            {st("store.phone") && <p style={{ textAlign: "center", fontSize: "9pt" }}>ĐT: {st("store.phone")}</p>}
            <hr />
            <p style={{ textAlign: "center", fontWeight: 700 }}>{giao ? "PHIẾU GIAO MÁY SỬA" : "PHIẾU NHẬN MÁY SỬA"}</p>
            <div className="rl"><span>Mã phiếu</span><b>{r.code}</b></div>
            <div className="rl"><span>Ngày nhận</span><span>{formatDateTimeVn(r.receivedAt)}</span></div>
            {giao && r.deliveredAt && <div className="rl"><span>Ngày giao</span><span>{formatDateTimeVn(r.deliveredAt)}</span></div>}
            <div className="rl"><span>Khách</span><span>{r.customerName ?? "—"}</span></div>
            {r.customerPhone && <div className="rl"><span>SĐT</span><span>{r.customerPhone}</span></div>}
            <hr />
            <div>Máy: {r.watchLabel ?? "—"}{r.serialNo ? ` · SN ${r.serialNo}` : ""}</div>
            <div style={{ fontSize: "9.5pt" }}>Lỗi: {r.complaint ?? "—"}</div>
            <div style={{ fontSize: "9.5pt" }}>Tình trạng nhận: {r.intakeCondition ?? "—"}</div>
            {r.expectedDate && !giao && <div className="rl"><span>Hẹn trả</span><span>{formatDateVn(r.expectedDate)}</span></div>}
            {giao && (
              <>
                <hr />
                {r.lines.map((l) => (
                  <div key={l.id} className="rl" style={{ fontSize: "9.5pt" }}><span>{l.lineType === "service" ? l.serviceName : l.description}</span><span>{formatVnd(l.lineTotal)}</span></div>
                ))}
                <div className="rl" style={{ fontWeight: 800 }}><span>Tổng</span><span>{r.chargeMode === "warranty_free" ? "Miễn phí (bảo hành)" : formatVnd(r.finalTotal ?? r.linesTotal)}</span></div>
                {r.warranty && <div style={{ fontSize: "9pt", marginTop: "2mm" }}>Bảo hành sau sửa đến {formatDateVn(r.warranty.endDate)}</div>}
              </>
            )}
            <hr />
            <p style={{ fontSize: "9pt" }}>Trạng thái: {statusInfo("repair", r.status).label}</p>
            {!giao && st("store.repair_terms") && <p style={{ fontSize: "8.5pt" }}>{st("store.repair_terms")}</p>}
            {giao && st("store.receipt_footer") && <p style={{ textAlign: "center", fontSize: "9pt" }}>{st("store.receipt_footer")}</p>}
          </div>
          <div className="wf-no-print wf-dev-row" style={{ marginTop: 16 }}>
            <Button variant="primary" icon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>In phiếu</Button>
            <PdfButtons build={buildPdf} disabled={info.isLoading} />
            <Link href={`/sua-chua/${id}`} className="wf-btn" style={{ textDecoration: "none" }}><ArrowLeft size={18} aria-hidden="true" /> Quay lại phiếu</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function RepairReceiptPage() {
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  );
}
