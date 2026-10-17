// Chạy trước `next build`: phiên bản package.json phải trùng mục đầu changelog và changelog không còn "TODO".
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/env.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src", "content", "changelog.ts"), "utf8");
const first = /version:\s*"([^"]+)"/.exec(src)?.[1];
const errs = [];
if (first !== pkg.version) errs.push(`Phiên bản lệch: package.json ${pkg.version} ≠ changelog ${first}. Dùng: pnpm version:bump <patch|minor|major> "Tiêu đề".`);
if (/"[^"\n]*TODO[^"\n]*"/.test(src)) errs.push("changelog.ts còn chữ TODO — viết nội dung trước khi build.");
if (errs.length) { console.error("✘ check-version\n  " + errs.join("\n  ")); process.exit(1); }
console.log(`✔ check-version ${pkg.version}`);
