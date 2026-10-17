// pnpm docs:check — kiểm tài liệu (bản đầu M0, hoàn thiện M9):
// 1) liên kết tương đối trỏ tới tệp có thật; 2) mỗi tệp docs có dòng "Cập nhật lần cuối";
// 3) mọi ID FR/BR/SC/CT/PT/UAT được nhắc đều có định nghĩa; 4) mọi BR đang hiệu lực được requirements trỏ tới.
// Bỏ qua docs/99-archive (chỉ đọc lịch sử).
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../lib/env.mjs";

const DOCS = path.join(ROOT, "docs");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "99-archive") walk(p); }
    else if (e.name.endsWith(".md")) files.push(p);
  }
})(DOCS);
const extra = ["CLAUDE.md", "README.md"].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f));
const read = (f) => fs.readFileSync(f, "utf8");
const errors = [];
const warn = [];

// 1 + 2
for (const f of [...files, ...extra]) {
  const s = read(f);
  const rel = path.relative(ROOT, f);
  if (files.includes(f) && !/Cập nhật lần cuối|Phiên bản bộ docs/.test(s.slice(0, 600))) errors.push(`${rel}: thiếu dòng "Cập nhật lần cuối" ở đầu`);
  for (const m of s.matchAll(/\]\(([^)\s]+)\)/g)) {
    const link = m[1];
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = path.resolve(path.dirname(f), link.split("#")[0]);
    if (!fs.existsSync(target)) errors.push(`${rel}: liên kết hỏng → ${link}`);
  }
}

// 3: định nghĩa
const defs = { FR: new Set(), BR: new Set(), SC: new Set(), CT: new Set(), PT: new Set(), UAT: new Set() };
const req = read(path.join(DOCS, "01-product", "requirements.md"));
for (const m of req.matchAll(/^\|\s*(FR-[A-Z]+-\d+(?:,\s*FR-[A-Z]+-\d+)*)\s*\|/gm)) for (const id of m[1].split(/,\s*/)) defs.FR.add(id);
const br = read(path.join(DOCS, "02-domain", "business-rules.md"));
for (const m of br.matchAll(/^\|\s*(BR-[A-Z]+-\d+)\b/gm)) defs.BR.add(m[1]);
const gs = read(path.join(DOCS, "06-quality", "golden-scenarios.md"));
for (const m of gs.matchAll(/^##\s*(SC-\d+)/gm)) defs.SC.add(m[1]);
const tp = read(path.join(DOCS, "06-quality", "test-plan.md"));
for (const m of tp.matchAll(/^\|\s*((?:CT|PT)-\d+)\s*\|/gm)) defs[m[1].slice(0, 2)].add(m[1]);
const uat = read(path.join(DOCS, "06-quality", "uat-acceptance.md"));
for (const m of uat.matchAll(/^#{2,4}\s*(UAT-\d+)/gm)) defs.UAT.add(m[1]);

// Tham chiếu (bỏ qua dạng dải "FR-SALE-01…18", "FR-RSV-*")
const refRe = /\b(FR-[A-Z]+-\d+|BR-[A-Z]+-\d+|SC-\d+|CT-\d+|PT-\d+|UAT-\d+)\b(?!\s*(?:…|\.\.\.))/g;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const s = read(f);
  const missing = new Set();
  for (const m of s.matchAll(refRe)) {
    const id = m[1];
    const kind = id.startsWith("UAT") ? "UAT" : id.slice(0, 2);
    // SC-2026-0001 là mã phiếu sửa, không phải kịch bản
    if ((kind === "SC" || kind === "PT") && /^(SC|PT)-\d{4}-/.test(s.slice(m.index, m.index + 12))) continue;
    if (!defs[kind].has(id)) missing.add(id);
  }
  if (missing.size) warn.push(`${rel}: ID chưa có định nghĩa: ${[...missing].join(", ")}`);
}

// 4: mọi BR hiệu lực được requirements trỏ tới (BR ở mục "Hoãn"/"bỏ" của business-rules không tính)
const brActive = br.split(/\n##\s+[^\n]*(?:Hoãn|hoãn|Đã bỏ)/)[0];
const brActiveIds = new Set([...brActive.matchAll(/^\|\s*(BR-[A-Z]+-\d+)\b/gm)].map((m) => m[1]));
const reqRefs = new Set([...req.matchAll(/\bBR-[A-Z]+-\d+\b/g)].map((m) => m[0]));
const notReferenced = [...brActiveIds].filter((id) => !reqRefs.has(id));
if (notReferenced.length) warn.push(`requirements.md chưa trỏ tới BR: ${notReferenced.join(", ")}`);

console.log(`docs:check — ${files.length} tệp · FR ${defs.FR.size} · BR ${defs.BR.size} · SC ${defs.SC.size} · CT ${defs.CT.size} · PT ${defs.PT.size} · UAT ${defs.UAT.size}`);
for (const w of warn) console.log("⚠ " + w);
if (errors.length) { console.error("✘ " + errors.join("\n✘ ")); process.exit(1); }
console.log(`✔ docs:check đạt (${warn.length} cảnh báo)`);
