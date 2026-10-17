// Sinh docs/07-user-guide/HUONG_DAN_SU_DUNG.md từ src/content/guide.ts (nguồn sự thật) để in/phát cho nhân viên.
// Chạy: pnpm docs:guide (Node ≥ 22.18 tự bỏ kiểu TypeScript). Đừng sửa tay file sinh ra.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../lib/env.mjs";

const { GUIDE } = await import(pathToFileURL(path.join(ROOT, "src", "content", "guide.ts")).href);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const out = [
  "# Hướng dẫn sử dụng WatchFlow",
  "",
  `> Cập nhật lần cuối: ${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())} · Phiên bản ${pkg.version} · Sinh tự động từ \`src/content/guide.ts\` bằng \`pnpm docs:guide\` — đừng sửa tay. Trong ứng dụng: menu **Hướng dẫn** (chỉ hiện mục hợp với quyền của bạn).`,
  "",
  "## Mục lục",
  "",
  ...GUIDE.map((s, i) => `${i + 1}. [${s.title}](#${s.id}) — ${s.summary}`),
  "",
];
for (const s of GUIDE) {
  out.push(`<a id="${s.id}"></a>`, "", `## ${s.title}`, "", `*${s.summary}*${s.perms ? ` · Hiện cho người có quyền: ${s.perms.map((p) => "`" + p + "`").join(", ")}` : ""}`, "");
  // Tiêu đề nhỏ "## " trong thân mục ⇒ "### " để giữ cấp bậc
  out.push(s.body.replace(/^## /gm, "### "), "");
}
const file = path.join(ROOT, "docs", "07-user-guide", "HUONG_DAN_SU_DUNG.md");
fs.writeFileSync(file, out.join("\n"));
console.log(`✔ ${path.relative(ROOT, file)} (${GUIDE.length} mục)`);
