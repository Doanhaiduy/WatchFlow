"use client";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";

type Label = { assetCode: string; modelName: string; brandName: string; serialNo: string | null; price: number; qrSvg: string };

/** Tem QR 50×30mm. `qrSvg` do máy chủ sinh từ thư viện qrcode (không phải dữ liệu người dùng) nên render trực tiếp. */
export default function UnitLabelPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, mutate } = useSWR<Label>(`/api/v1/catalog/units/${id}/label`, swrFetcher);
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <style>{"@page{size:50mm 30mm;margin:0}"}</style>
      <div className="wf-no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }}>In tem QR</h1>
        <p className="wf-mute">Khổ giấy 50 × 30 mm. Chọn đúng khổ tem trong hộp thoại in của trình duyệt.</p>
      </div>
      {isLoading ? (
        <Skeleton w="50mm" h="30mm" radius={4} />
      ) : error || !data ? (
        <div className="g wf-pad wf-no-print"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
      ) : (
        <>
          <div className="wf-label-prev" aria-label={`Tem ${data.assetCode}`}>
            <div dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
            <div>
              <b>{data.assetCode}</b>
              <span>{data.modelName.toLowerCase().startsWith(data.brandName.toLowerCase()) ? data.modelName : `${data.brandName} ${data.modelName}`}</span>
              {data.serialNo && <span>SN {data.serialNo}</span>}
              {data.price > 0 && <b style={{ marginTop: 2, fontSize: "8pt", whiteSpace: "nowrap" }}>{formatVnd(data.price)}</b>}
            </div>
          </div>
          <div className="wf-no-print wf-dev-row" style={{ marginTop: 16 }}>
            <Button variant="primary" icon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>In tem</Button>
            <Link href={`/dong-ho/${id}`} className="wf-btn" style={{ textDecoration: "none" }}><ArrowLeft size={18} aria-hidden="true" /> Quay lại chiếc</Link>
          </div>
        </>
      )}
    </div>
  );
}
