// Sinh docs/07-user-guide/HUONG_DAN_SU_DUNG.md từ src/content/guide.ts (nguồn sự thật) để in/phát cho nhân viên.
// Chạy: pnpm docs:guide (Node ≥ 22.18 tự bỏ kiểu TypeScript). Đừng sửa tay file sinh ra.
// guide.ts là danh sách KHỐI có kiểu (md, heading, callout, steps, path, cards, flow, demo, table, tabs, accordion) — mỗi loại đổi sang Markdown ở đây.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../lib/env.mjs";

const { GUIDE, GUIDE_INTRO, GUIDE_ROLES } = await import(pathToFileURL(path.join(ROOT, "src", "content", "guide.ts")).href);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const CALLOUT_LABEL = { tip: "Mẹo", info: "Lưu ý", warn: "Chú ý", danger: "Quan trọng" };
const crumbs = (items, label) => `*${label ?? "Vào"}: ${items.join(" → ")}*`;
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const quote = (s) => s.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");

/** Khối → các đoạn Markdown (mỗi phần tử cách nhau một dòng trống). `h` = cấp tiêu đề nhỏ nhất dùng trong khối. */
function render(blocks, h = 3) {
  const out = [];
  const hd = (n, text) => `${"#".repeat(Math.min(n, 6))} ${text}`;
  for (const b of blocks) {
    switch (b.t) {
      case "md":
        // "## " trong đoạn md ⇒ tiêu đề nhỏ cùng cấp `h`
        out.push(b.text.replace(/^## /gm, `${"#".repeat(Math.min(h, 6))} `));
        break;
      case "heading":
        out.push(hd(h, b.text));
        break;
      case "callout":
        {
          const t = b.title ?? CALLOUT_LABEL[b.tone];
          out.push(quote(`**${t}${/[?!.:]$/.test(t) ? "" : "."}** ${b.text}`));
        }
        break;
      case "steps":
        if (b.title) out.push(hd(h, b.title));
        out.push(
          b.items
            .map((s, i) => {
              const where = s.path ? ` (${crumbs(s.path)})` : "";
              return `${i + 1}. **${s.title}**${where}${s.text ? ` — ${s.text}` : ""}`;
            })
            .join("\n"),
        );
        break;
      case "path":
        out.push(crumbs(b.items, b.label));
        break;
      case "cards":
        out.push(b.items.map((c) => `- **${c.title}** — ${c.text}`).join("\n"));
        break;
      case "flow":
        out.push(`${b.caption ? `**${b.caption}:** ` : ""}${b.items.map((s) => `**${s.label}**${s.note ? ` (${s.note})` : ""}`).join(" → ")}`);
        break;
      case "demo":
        if (b.caption) out.push(`*(Hình minh họa: ${b.caption})*`);
        break;
      case "table":
        out.push([`| ${b.head.map(cell).join(" | ")} |`, `|${b.head.map(() => "---").join("|")}|`, ...b.rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n"));
        break;
      case "tabs":
        for (const t of b.tabs) out.push(hd(h + 1, t.label), ...render(t.blocks, h + 2));
        break;
      case "accordion":
        for (const it of b.items) out.push(hd(h + 1, it.title), ...render(it.blocks, h + 2));
        break;
      default:
        throw new Error(`Khối hướng dẫn không biết: ${b.t}`);
    }
  }
  return out;
}

const out = [
  "# Hướng dẫn sử dụng WatchFlow",
  "",
  `> Cập nhật lần cuối: ${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())} · Phiên bản ${pkg.version} · Sinh tự động từ \`src/content/guide.ts\` bằng \`pnpm docs:guide\` — đừng sửa tay. Trong ứng dụng: menu **Hướng dẫn** (chỉ hiện mục hợp với quyền của bạn; có nút **In / Lưu PDF**).`,
  "",
  GUIDE_INTRO,
  "",
  "## Các loại tài khoản trong cửa hàng",
  "",
  ...GUIDE_ROLES.map((r) => `- **${r.title}** — ${r.text}`),
  "",
  "## Mục lục",
  "",
  ...GUIDE.map((s, i) => `${i + 1}. [${s.title}](#${s.id}) — ${s.summary}`),
  "",
];
for (const s of GUIDE) {
  out.push(`<a id="${s.id}"></a>`, "", `## ${s.title}`, "");
  const meta = [s.tags?.length ? `Dành cho: ${s.tags.join(", ")}` : "", s.perms ? `Hiện cho người có quyền: ${s.perms.map((p) => "`" + p + "`").join(", ")}` : ""].filter(Boolean);
  out.push(`*${s.summary}*${meta.length ? ` · ${meta.join(" · ")}` : ""}`, "");
  for (const part of render(s.blocks, 3)) out.push(part, "");
}
const file = path.join(ROOT, "docs", "07-user-guide", "HUONG_DAN_SU_DUNG.md");
fs.writeFileSync(file, out.join("\n").replace(/\n{3,}/g, "\n\n"));
console.log(`✔ ${path.relative(ROOT, file)} (${GUIDE.length} mục)`);
