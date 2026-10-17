import type { ReactNode } from "react";

/** Dựng "markdown nhẹ" (đoạn, ##, -, 1., **đậm**) thành phần tử React — KHÔNG dùng dangerouslySetInnerHTML nên an toàn với mọi chuỗi. */
function inline(s: string, key: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={`${key}${i}`}>{p.slice(2, -2)}</strong> : p));
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
        out.push(<h4 key={`${bi}-${i}`} style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 4px" }}>{inline(l.slice(3), `h${bi}${i}`)}</h4>);
        i++;
      } else if (/^- /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^- /.test(lines[i]!)) items.push(lines[i++]!.slice(2));
        out.push(<ul key={`${bi}-${i}`} style={{ listStyle: "disc", paddingLeft: 20, margin: "6px 0" }}>{items.map((t, k) => <li key={k} style={{ margin: "3px 0" }}>{inline(t, `u${bi}${i}${k}`)}</li>)}</ul>);
      } else if (/^\d+\. /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i]!)) items.push(lines[i++]!.replace(/^\d+\. /, ""));
        out.push(<ol key={`${bi}-${i}`} style={{ listStyle: "decimal", paddingLeft: 22, margin: "6px 0" }}>{items.map((t, k) => <li key={k} style={{ margin: "3px 0" }}>{inline(t, `o${bi}${i}${k}`)}</li>)}</ol>);
      } else {
        const para: string[] = [];
        while (i < lines.length && !/^(## |- |\d+\. )/.test(lines[i]!)) para.push(lines[i++]!);
        out.push(<p key={`${bi}-${i}`} style={{ margin: "6px 0" }}>{inline(para.join(" "), `p${bi}${i}`)}</p>);
      }
    }
  });
  return <>{out}</>;
}
