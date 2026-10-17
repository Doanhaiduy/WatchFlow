"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

/** Phân trang đơn giản: Trước · Trang x/y · Sau */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="wf-dev-row" style={{ justifyContent: "space-between", marginTop: 14 }} aria-label="Phân trang">
      <Button sm iconOnly aria-label="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={18} aria-hidden="true" />
      </Button>
      <span className="wf-mute wf-num" aria-live="polite">
        Trang {page}/{pages} · {total} mục
      </span>
      <Button sm iconOnly aria-label="Trang sau" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <ChevronRight size={18} aria-hidden="true" />
      </Button>
    </nav>
  );
}
