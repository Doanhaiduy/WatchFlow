"use client";
import { ArrowUp, BookOpen, Link2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Blocks, GUIDE_ICONS } from "@/components/guide/GuideBlocks";
import "@/components/guide/guide.css";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inline } from "@/components/ui/MiniMarkdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { CHANGELOG } from "@/content/changelog";
import { GUIDE, GUIDE_INTRO, GUIDE_QUICK, GUIDE_ROLES, guideFor, type GuideBlock, type GuideSection } from "@/content/guide";
import { useSession } from "@/lib/session";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

function blockText(b: GuideBlock): string {
  switch (b.t) {
    case "md": return b.text;
    case "heading": return b.text;
    case "callout": return `${b.title ?? ""} ${b.text}`;
    case "steps": return `${b.title ?? ""} ${b.items.map((i) => `${i.title} ${i.text ?? ""} ${(i.path ?? []).join(" ")}`).join(" ")}`;
    case "path": return b.items.join(" ");
    case "cards": return b.items.map((c) => `${c.title} ${c.text}`).join(" ");
    case "flow": return `${b.caption ?? ""} ${b.items.map((i) => `${i.label} ${i.note ?? ""}`).join(" ")}`;
    case "demo": return b.caption ?? "";
    case "table": return [...b.head, ...b.rows.flat()].join(" ");
    case "tabs": return b.tabs.map((t) => `${t.label} ${t.blocks.map(blockText).join(" ")}`).join(" ");
    case "accordion": return b.items.map((i) => `${i.title} ${i.blocks.map(blockText).join(" ")}`).join(" ");
  }
}
const sectionText = (s: GuideSection) => norm(`${s.title} ${s.summary} ${(s.tags ?? []).join(" ")} ${s.blocks.map(blockText).join(" ")}`.replace(/[*`]/g, ""));
const INDEX = GUIDE.map((s) => ({ s, text: sectionText(s) }));

const smooth = (): ScrollBehavior => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/** Hướng dẫn sử dụng: mặc định chỉ hiện mục hợp với quyền của người xem; tìm theo chữ không dấu (tìm trong mọi mục); mục lục dính + liên kết sâu /huong-dan#ban-hang. */
export default function GuidePage() {
  const { can } = useSession();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [active, setActive] = useState<string>(GUIDE[0]!.id);
  const [showTop, setShowTop] = useState(false);

  const mine = useMemo(() => guideFor(can), [can]);
  const mineIds = useMemo(() => new Set(mine.map((s) => s.id)), [mine]);
  const nq = norm(q.trim());
  const sections = useMemo(() => (nq ? INDEX.filter((x) => x.text.includes(nq)).map((x) => x.s) : scope === "all" ? GUIDE : mine), [nq, scope, mine]);
  const quick = useMemo(() => GUIDE_QUICK.filter((c) => sections.some((s) => s.id === c.target)), [sections]);

  // Mục nào đang gần đầu màn hình thì sáng trong mục lục
  const ids = sections.map((s) => s.id).join("|");
  useEffect(() => {
    const els = ids.split("|").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-110px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  // Giữ chip đang sáng trong tầm nhìn của thanh mục lục ngang (điện thoại)
  useEffect(() => {
    document.querySelector<HTMLElement>('.wf-gd-chips [aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [active]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Liên kết sâu /huong-dan#dong-ho: mở đúng mục (kể cả mục ngoài quyền của mình — chỉ để đọc) rồi cuộn tới
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id === "co-gi-moi") { const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 250); return () => clearTimeout(t); }
    if (!id || !GUIDE.some((s) => s.id === id)) return;
    if (!mineIds.has(id)) setScope("all");
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: smooth(), block: "start" });
    setActive(id);
  };
  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/huong-dan#${id}`);
      toast.success("Đã sao chép liên kết", "Dán cho đồng nghiệp để mở đúng mục này.");
    } catch {
      toast.warning("Chưa sao chép được", "Trình duyệt chặn truy cập bộ nhớ tạm.");
    }
  };

  return (
    <>
      <PageHeader title="Hướng dẫn sử dụng" description="Làm theo từng bước, đúng việc của bạn" />
      <div className="wf-gd">
        <section className="wf-gd-hero" aria-label="Giới thiệu hướng dẫn">
          <div className="top">
            <span className="ib" aria-hidden="true"><BookOpen size={24} /></span>
            <div>
              <h2>Mọi việc hằng ngày, từng bước một</h2>
              <p><Inline text={GUIDE_INTRO} /></p>
            </div>
          </div>
          <div className="row">
            <span className="pill">{mine.length} / {GUIDE.length} mục hợp với quyền của bạn</span>
            <button type="button" className="act" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              In / Lưu PDF
            </button>
          </div>
        </section>

        <div className="wf-gd-tools">
          <SearchBar value={q} onChange={setQ} placeholder="Tìm hướng dẫn (vd. CTV, tem QR, hủy đơn)" />
          <SegmentedControl ariaLabel="Phạm vi hướng dẫn" options={[{ value: "mine", label: "Dành cho tôi" }, { value: "all", label: "Tất cả mục" }]} value={scope} onChange={setScope} />
        </div>
        <p className="wf-gd-note" role="status">
          {nq ? `${sections.length} mục khớp “${q.trim()}” (tìm trong mọi mục).` : scope === "all" ? "Đang xem mọi mục, kể cả mục cần quyền bạn chưa có." : "Chỉ hiện mục hợp với quyền của bạn. Chọn “Tất cả mục” để xem thêm."}
        </p>

        {!nq && (
          <>
            {quick.length > 0 && (
              <nav className="wf-gd-quick" aria-label="Bắt đầu nhanh">
                {quick.map((c) => {
                  const Icon = GUIDE_ICONS[c.icon];
                  return (
                    <button key={c.target} type="button" className="wf-gd-q g g-flat" onClick={() => go(c.target)}>
                      <span className="wf-ib" aria-hidden="true"><Icon size={20} /></span>
                      <b>{c.title}</b>
                      <small>{c.text}</small>
                    </button>
                  );
                })}
              </nav>
            )}
            <details className="wf-gd-roles g g-flat">
              <summary>
                Các loại tài khoản trong cửa hàng
                <span>Xem</span>
              </summary>
              <div className="grid">
                {GUIDE_ROLES.map((r) => (
                  <div key={r.title}>
                    <b>{r.title}</b>
                    <p>{r.text}</p>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {sections.length > 0 && (
          <nav className="wf-gd-chips g" aria-label="Mục lục (cuộn ngang)">
            {sections.map((s) => (
              <button key={s.id} type="button" aria-current={active === s.id} onClick={() => go(s.id)}>
                {s.title.split(":")[0]}
              </button>
            ))}
          </nav>
        )}

        <div className="wf-gd-wrap">
          <aside className="wf-gd-toc g" aria-label="Mục lục">
            <h6>Mục lục</h6>
            {sections.map((s) => {
              const Icon = GUIDE_ICONS[s.icon];
              return (
                <button key={s.id} type="button" aria-current={active === s.id} onClick={() => go(s.id)}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{s.title.split(":")[0]}</span>
                </button>
              );
            })}
          </aside>

          <div className="wf-gd-list">
            {sections.length === 0 && (
              <div className="g wf-gd-empty">
                <EmptyState variant="search" icon={<BookOpen size={24} />} title="Không có mục nào khớp" description="Thử từ khóa ngắn hơn, ví dụ “CTV”, “tem QR” hoặc “sửa chữa”." />
              </div>
            )}
            {sections.map((s) => {
              const Icon = GUIDE_ICONS[s.icon];
              return (
                <section key={s.id} id={s.id} className="wf-gd-sec g" aria-labelledby={`${s.id}-t`}>
                  <header className="wf-gd-sh">
                    <span className="wf-ib" aria-hidden="true"><Icon size={22} /></span>
                    <div className="tx">
                      <h2 id={`${s.id}-t`}>{s.title}</h2>
                      <p>{s.summary}</p>
                      {s.tags && s.tags.length > 0 && (
                        <div className="wf-gd-tags">
                          {s.tags.map((t) => <span key={t} className="wf-chip" data-tone="info">{t}</span>)}
                          {!mineIds.has(s.id) && <span className="wf-chip" data-tone="hold">Cần quyền bạn chưa có</span>}
                        </div>
                      )}
                    </div>
                    <button type="button" className="lnk" onClick={() => void copyLink(s.id)} aria-label={`Sao chép liên kết tới mục ${s.title}`} title="Sao chép liên kết tới mục này">
                      <Link2 size={18} aria-hidden="true" />
                    </button>
                  </header>
                  <Blocks blocks={s.blocks} />
                </section>
              );
            })}
          </div>
        </div>

        {!nq && (
          <section id="co-gi-moi" className="wf-gd-sec g" aria-labelledby="co-gi-moi-t" style={{ marginTop: 16 }}>
            <header className="wf-gd-sh">
              <span className="wf-ib" aria-hidden="true"><BookOpen size={22} /></span>
              <div className="tx">
                <h2 id="co-gi-moi-t">Có gì mới</h2>
                <p>Phiên bản đang chạy: v{CHANGELOG[0]?.version}</p>
              </div>
            </header>
            <ul className="wf-stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {CHANGELOG.slice(0, 4).map((c, i) => (
                <li key={c.version}>
                  <p style={{ fontWeight: 700 }}>{c.title} <span className="wf-chip" data-tone={i === 0 ? "ok" : "info"}>v{c.version}</span> <span className="wf-mute" style={{ fontWeight: 500, fontSize: 12.5 }}>{c.date}</span></p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                    {c.items.slice(0, 6).map((t) => <li key={t} style={{ fontSize: 13.5 }}><Inline text={t} /></li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {showTop && (
        <button type="button" className="wf-gd-top" onClick={() => window.scrollTo({ top: 0, behavior: smooth() })} aria-label="Lên đầu trang">
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
