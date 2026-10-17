"use client";
// Nút "Tải PDF" + "Chia sẻ" (chỉ hiện khi trình duyệt chia sẻ được tệp — điện thoại). PDF vector dựng ngay trên trình duyệt (pdfmake nạp khi bấm).
import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { canSharePdf, saveBlob, sharePdfBlob } from "@/lib/pdf/core";

export type PdfResult = { blob: Blob; filename: string; title: string };

type Props = {
  /** Dựng PDF (gọi dynamic import bên trong). Có thể ghi nhận "đã in" (vd. bản in lại) trước khi dựng. */
  build: () => Promise<PdfResult>;
  /** Sau khi tải/chia sẻ xong */
  onDone?: () => void;
  disabled?: boolean;
  sm?: boolean;
  /** Nhãn nút tải */
  label?: string;
};

export function PdfButtons({ build, onDone, disabled, sm, label = "Tải PDF" }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<"" | "save" | "share">("");
  const [share, setShare] = useState(false);
  useEffect(() => setShare(canSharePdf()), []);

  const run = async (kind: "save" | "share") => {
    if (busy) return;
    setBusy(kind);
    try {
      const r = await build();
      if (kind === "save") {
        saveBlob(r.blob, r.filename);
        toast.success("Đã tạo PDF", r.filename);
      } else {
        await sharePdfBlob(r.blob, r.filename, r.title);
      }
      onDone?.();
    } catch (e) {
      toast.error("Không tạo được PDF", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <Button sm={sm} icon={<Download size={18} aria-hidden="true" />} loading={busy === "save"} disabled={disabled || !!busy} onClick={() => void run("save")}>{label}</Button>
      {share && <Button sm={sm} icon={<Share2 size={18} aria-hidden="true" />} loading={busy === "share"} disabled={disabled || !!busy} onClick={() => void run("share")}>Chia sẻ</Button>}
    </>
  );
}
