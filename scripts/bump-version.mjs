// Tăng phiên bản + thêm mục đầu changelog (nội dung TODO để người viết điền). Dùng: pnpm version:bump <patch|minor|major> "Tiêu đề"
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/env.mjs";

const [kind, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(" ").trim();
if (!["patch", "minor", "major"].includes(kind) || !title) {
  console.error('Dùng: pnpm version:bump <patch|minor|major> "Tiêu đề"');
  process.exit(1);
}
const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const [ma, mi, pa] = pkg.version.split(".").map(Number);
const next = kind === "major" ? `${ma + 1}.0.0` : kind === "minor" ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
const clPath = path.join(ROOT, "src", "content", "changelog.ts");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const entry = `  {\n    version: "${next}",\n    date: "${today}",\n    title: ${JSON.stringify(title)},\n    items: ["TODO: mô tả thay đổi"],\n  },\n`;
const src = fs.readFileSync(clPath, "utf8").replace("export const CHANGELOG: ChangelogEntry[] = [\n", (m) => m + entry);
fs.writeFileSync(clPath, src);
console.log(`✔ ${pkg.name} → ${next}. Viết nội dung thay "TODO" trong src/content/changelog.ts.`);
