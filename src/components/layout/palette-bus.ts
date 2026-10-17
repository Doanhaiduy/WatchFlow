"use client";
// Cầu nối mở bảng lệnh Ctrl+K từ bất cứ đâu (thanh trên, đầu trang điện thoại…) mà không cần truyền props qua khung.
import { useEffect, useState } from "react";

export const PALETTE_EVENT = "wf:palette";

/** Mở bảng lệnh (tùy chọn điền sẵn từ khóa) */
export function openCommandPalette(q = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: { q } }));
}

/** Nhãn phím tắt theo hệ điều hành ("⌘K" trên Mac/iOS, "Ctrl K" còn lại). Đặt sau khi gắn vào trình duyệt để không lệch hydrate. */
export function useShortcutHint(): string {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || "")), []);
  return mac ? "⌘K" : "Ctrl K";
}
