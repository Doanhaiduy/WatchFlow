import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Dựng "markdown nhẹ" thành phần tử React — KHÔNG dùng dangerouslySetInnerHTML nên an toàn với mọi chuỗi.
 * Dòng/đoạn: "## " tiêu đề nhỏ, "- " gạch đầu dòng, "1. " đánh số, còn lại là đoạn (đoạn cách nhau dòng trống).
 * Trong dòng: **đậm**, *nghiêng*, `mã`, [chữ](/duong-dan-noi-bo) (chỉ nhận đường dẫn nội bộ "/…" hoặc "#…"; liên kết khác hiện như chữ thường).
 * Kiểu dáng ở src/components/guide/guide.css (lớp .wf-gd-*).
 */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

export function Inline({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i} className="wf-gd-code">{p.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (link) {
      const href = link[2]!;
      if (href.startsWith("/") && !href.startsWith("//")) return <Link key={i} href={href} className="wf-gd-a">{link[1]}</Link>;
      if (href.startsWith("#")) return <a key={i} href={href} className="wf-gd-a">{link[1]}</a>;
      return link[1];
    }
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*") && !p.startsWith("**")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((b, bi) => {
    const lines = b.split("\n");
    let i = 0;
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.startsWith("## ")) {
        out.push(<h4 key={`${bi}-${i}`} className="wf-gd-h4"><Inline text={l.slice(3)} /></h4>);
        i++;
      } else if (/^- /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^- /.test(lines[i]!)) items.push(lines[i++]!.slice(2));
        out.push(<ul key={`${bi}-${i}`} className="wf-gd-ul">{items.map((t, k) => <li key={k}><Inline text={t} /></li>)}</ul>);
      } else if (/^\d+\. /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i]!)) items.push(lines[i++]!.replace(/^\d+\. /, ""));
        out.push(<ol key={`${bi}-${i}`} className="wf-gd-ol">{items.map((t, k) => <li key={k}><Inline text={t} /></li>)}</ol>);
      } else {
        const para: string[] = [];
        while (i < lines.length && !/^(## |- |\d+\. )/.test(lines[i]!)) para.push(lines[i++]!);
        out.push(<p key={`${bi}-${i}`} className="wf-gd-p"><Inline text={para.join(" ")} /></p>);
      }
    }
  });
  return <>{out}</>;
}
