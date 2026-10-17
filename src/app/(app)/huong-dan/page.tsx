"use client";
import { BookOpen, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { guideFor } from "@/content/guide";
import { MiniMarkdown } from "@/components/ui/MiniMarkdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSession } from "@/lib/session";

/** Hướng dẫn sử dụng: chỉ hiện các mục khớp quyền của người dùng; tìm theo chữ không dấu. */
export default function GuidePage() {
  const { can } = useSession();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>("bat-dau");
  const list = useMemo(() => guideFor(can), [can]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const shown = q.trim() ? list.filter((s) => norm(`${s.title} ${s.summary} ${s.body}`).includes(norm(q.trim()))) : list;
  return (
    <>
      <PageHeader title="Hướng dẫn sử dụng" description="Các bước làm việc theo quyền của bạn" />
      <SearchBar value={q} onChange={setQ} placeholder="Tìm trong hướng dẫn…" />
      {shown.length === 0 ? (
        <div className="g wf-pad"><EmptyState variant="search" icon={<BookOpen size={24} />} title="Không có mục nào khớp" description="Thử từ khóa khác, ví dụ “bán nợ” hoặc “tem QR”." /></div>
      ) : (
        <div className="wf-stack">
          {shown.map((s) => {
            const on = open === s.id || !!q.trim();
            return (
              <section key={s.id} className="g wf-pad" aria-label={s.title}>
                <h2 style={{ margin: 0 }}>
                  <button type="button" aria-expanded={on} aria-controls={`gd-${s.id}`} onClick={() => setOpen(on && !q.trim() ? null : s.id)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8, textAlign: "left", minHeight: 44, background: "none", border: 0, color: "inherit" }}>
                    <span><b style={{ display: "block", fontSize: 16 }}>{s.title}</b><span className="wf-mute" style={{ fontSize: 12.5, fontWeight: 400 }}>{s.summary}</span></span>
                    <ChevronDown size={18} aria-hidden="true" style={{ transform: on ? "rotate(180deg)" : undefined, transition: "transform .2s", flex: "none" }} />
                  </button>
                </h2>
                {on && <div id={`gd-${s.id}`} style={{ marginTop: 6 }}><MiniMarkdown text={s.body} /></div>}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
