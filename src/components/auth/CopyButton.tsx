"use client";
import { Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

/** Sao chép văn bản vào clipboard (có phương án dự phòng cho trình duyệt cũ) */
export function CopyButton({ text, label = "Sao chép", sm = true }: { text: string; label?: string; sm?: boolean }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success("Đã sao chép");
  };
  return (
    <Button sm={sm} icon={<Copy size={16} aria-hidden="true" />} onClick={() => void copy()}>
      {label}
    </Button>
  );
}
