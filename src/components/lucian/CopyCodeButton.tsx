"use client";
// Lucian UX/UI Prompt #008 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#008
// Nút sao chép mã: biểu tượng đổi thành dấu tích, bong bóng "Đã sao chép". Bản gốc xem sổ ui-design-system §9.
import { useEffect, useRef, useState } from "react";
import "./lucian-008.css";

export function CopyCodeButton({ text, label = "Sao chép mã" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (t.current) clearTimeout(t.current);
    setCopied(false);
    requestAnimationFrame(() => setCopied(true));
    t.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <span className={`ux u008${copied ? " is-copied" : ""}`}>
      <button type="button" className="u008-btn" aria-label={label} onClick={() => void copy()}>
        <svg className="u008-cp" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
          <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
        </svg>
        <svg className="u008-ok" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.5 12.5l4.2 4.2L18.5 8" />
        </svg>
      </button>
      <span className="u008-tip" role="status">
        {copied ? "Đã sao chép" : ""}
      </span>
    </span>
  );
}
