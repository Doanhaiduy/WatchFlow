#!/usr/bin/env node
/**
 * pack-changes.mjs — ĐÓNG GÓI thay đổi ở máy công ty thành MỘT file .mjs mang về máy cá nhân.
 *
 * Máy công ty (thư mục GỐC repo):
 *   node scripts/handoff/pack-changes.mjs [--out <file>] [--list] [--all] [--allow-secrets] [--max-mb 25]
 *   → tạo watchflow-changes-YYYYMMDD-HHMMSS.mjs (tự chứa: gzip + base64 + kiểm sha256, không cần cài gì).
 *
 * Máy cá nhân (thư mục GỐC repo, đã `git pull` tới commit gốc):
 *   node watchflow-changes-....mjs [--dry-run] [--force] [--no-backup] [--here]
 *
 * Gói gồm: file SỬA / THÊM / XÓA so với commit gốc (HEAD lúc clone) — kể cả file mới chưa add.
 * Luôn loại: .git, node_modules, .next, .local, .env* (trừ .env.example), CLAUDE.local.md,
 *   .claude/settings.local.json, *.log, các file đã git-ignore, và chính script này.
 * Chỉ ĐỌC git (diff / ls-files / show). Không add/commit/push, không dùng mạng.
 * Quét bí mật trước khi đóng gói: có nghi vấn thì DỪNG (xem lại rồi mới dùng --allow-secrets).
 *
 * Áp dụng an toàn: file ở nhà còn nguyên như commit gốc → ghi đè; đã giống → bỏ qua; nhà đã sửa khác
 * → KHÔNG ghi đè, lưu bản công ty thành <file>.company-incoming để bạn tự gộp (hoặc --force: ghi đè,
 * bản cũ lưu ở .company-bundle-backup/<thời-điểm>/). Không tự commit/push.
 * Nếu máy công ty không có git (hoặc dùng --all) → chế độ "snapshot": gói toàn bộ file, ghi đè có sao lưu.
 *   (snapshot KHÔNG truyền được việc xóa file; muốn đủ thì dùng chế độ mặc định có git.)
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ───────── Phần dùng chung (được nhúng nguyên văn vào file gói) ─────────
const IMPORTS = [
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import zlib from "node:zlib";',
  'import crypto from "node:crypto";',
  'import { execFileSync } from "node:child_process";',
].join("\n");

/** Băm sha256 sau khi chuẩn hóa CRLF→LF với file văn bản (tránh lệch do autocrlf). */
function normHash(buf) {
  let b = buf;
  if (!buf.subarray(0, 8000).includes(0) && buf.includes(13)) {
    b = Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
  }
  return crypto.createHash("sha256").update(b).digest("hex");
}

/** Chạy ở máy cá nhân: giải gói và áp dụng. Chỉ dùng fs/path/zlib/crypto/execFileSync/normHash. */
async function applyMain(b64, expectSha, argv) {
  const has = (f) => argv.includes(f);
  if (has("--help") || has("-h")) {
    console.log(
      [
        "Áp dụng gói thay đổi WatchFlow (chạy ở thư mục GỐC repo):",
        "  node <file>.mjs               áp dụng (an toàn: không ghi đè file bạn đã sửa khác)",
        "  --dry-run                     chỉ in kế hoạch, không ghi gì",
        "  --force                       với file xung đột: ghi đè (bản cũ sao lưu ở .company-bundle-backup/)",
        "  --no-backup                   không sao lưu khi ghi đè",
        "  --here                        bỏ qua kiểm tra đang đứng ở gốc repo WatchFlow",
      ].join("\n"),
    );
    return;
  }
  const dry = has("--dry-run");
  const force = has("--force");
  const noBackup = has("--no-backup");

  const gz = Buffer.from(b64.replace(/\s+/g, ""), "base64");
  if (crypto.createHash("sha256").update(gz).digest("hex") !== expectSha) {
    console.error("✗ File gói bị hỏng hoặc thiếu (sai sha256). Chép lại nguyên vẹn file rồi chạy lại.");
    process.exit(2);
  }
  const raw = zlib.gunzipSync(gz);
  const metaLen = raw.readUInt32BE(0);
  const meta = JSON.parse(raw.subarray(4, 4 + metaLen).toString("utf8"));
  const dataBase = 4 + metaLen;
  const root = process.cwd();

  let okRepo = false;
  try {
    okRepo = /WatchFlow/.test(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8").slice(0, 400));
  } catch {
    /* không có CLAUDE.md */
  }
  if (!okRepo && !has("--here")) {
    console.error("✗ Hãy chạy ở THƯ MỤC GỐC repo WatchFlow (nơi có CLAUDE.md). Bỏ qua kiểm tra: --here");
    process.exit(2);
  }
  const snapshot = meta.mode === "snapshot";
  console.log(
    `Gói tạo lúc ${meta.createdAt} · chế độ ${meta.mode} · ${meta.files.length} file` +
      (meta.baseCommit ? ` · commit gốc ${meta.baseCommit.slice(0, 10)}` : ""),
  );
  if (meta.baseCommit) {
    try {
      execFileSync("git", ["cat-file", "-e", meta.baseCommit + "^{commit}"], { stdio: "ignore" });
    } catch {
      console.warn(
        `⚠ Repo này chưa có commit gốc ${meta.baseCommit.slice(0, 10)} — nên 'git pull' trước, không thì nhiều file sẽ bị coi là xung đột.`,
      );
    }
  }
  if (dry) console.log("(dry-run: không ghi gì)\n");

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const backupRoot = path.join(root, ".company-bundle-backup", stamp);
  const inside = (p) => {
    const r = path.relative(root, p);
    return !!r && !r.startsWith("..") && !path.isAbsolute(r);
  };
  const backup = (rel, target) => {
    if (noBackup || dry) return;
    const dst = path.join(backupRoot, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(target, dst);
  };
  const write = (target, data) => {
    if (dry) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  };

  const n = { added: 0, modified: 0, deleted: 0, same: 0, overwritten: 0, conflict: 0 };
  const conflicts = [];
  for (const f of meta.files) {
    const target = path.resolve(root, f.path);
    if (!inside(target) || f.path.split("/").includes(".git")) {
      console.error(`✗ Bỏ qua đường dẫn không an toàn: ${f.path}`);
      n.conflict++;
      continue;
    }
    const data = f.op === "delete" ? null : raw.subarray(dataBase + f.offset, dataBase + f.offset + f.size);
    if (data && normHash(data) !== f.sha) {
      console.error(`✗ Dữ liệu file hỏng: ${f.path}`);
      process.exit(2);
    }
    const isFile = fs.existsSync(target) && fs.statSync(target).isFile();
    const local = isFile ? fs.readFileSync(target) : null;
    const lsha = local ? normHash(local) : null;

    // Quyết định hành động
    let action; // write | overwrite | delete | same | conflict
    let why = "";
    if (f.op === "delete") {
      if (!local) action = "same";
      else if (f.baseSha && lsha === f.baseSha) action = "delete";
      else {
        action = "conflict";
        why = "đã bị bạn sửa ở máy nhà nên không xóa";
      }
    } else if (!local) {
      if (f.op === "modify" && f.baseSha && !snapshot) {
        action = "conflict";
        why = "file đã bị xóa ở máy nhà";
      } else action = "write";
    } else if (lsha === f.sha) action = "same";
    else if (f.baseSha && lsha === f.baseSha) action = "write";
    else if (snapshot) action = "overwrite";
    else {
      action = "conflict";
      why = "máy nhà đã sửa khác bản gốc";
    }

    if (action === "same") {
      n.same++;
      if (!dry) fs.rmSync(target + ".company-incoming", { force: true }); // đã gộp xong → dọn bản chờ cũ
      continue;
    }
    if (action === "conflict") {
      conflicts.push(`${f.path} — ${why}`);
      if (force) {
        if (local) backup(f.path, target);
        if (!dry) fs.rmSync(target + ".company-incoming", { force: true });
        if (f.op === "delete") {
          if (!dry) fs.rmSync(target, { force: true });
          n.deleted++;
          console.log(`  - ${f.path}  (force)`);
        } else {
          write(target, data);
          n.overwritten++;
          console.log(`  ! ${f.path}  (force: ghi đè, ${why})`);
        }
      } else {
        n.conflict++;
        if (data) write(target + ".company-incoming", data);
        console.log(`  ! ${f.path}  XUNG ĐỘT: ${why}${data ? ` → bản công ty: ${f.path}.company-incoming` : ""}`);
      }
      continue;
    }
    if (action === "delete") {
      if (!dry) fs.rmSync(target, { force: true });
      n.deleted++;
      console.log(`  - ${f.path}`);
      continue;
    }
    if (action === "overwrite") {
      backup(f.path, target);
      write(target, data);
      n.overwritten++;
      console.log(`  ~ ${f.path}  (ghi đè, đã sao lưu)`);
      continue;
    }
    // write
    write(target, data);
    if (local) {
      n.modified++;
      console.log(`  ~ ${f.path}`);
    } else {
      n.added++;
      console.log(`  + ${f.path}`);
    }
  }

  console.log(
    `\nXong${dry ? " (dry-run)" : ""}: thêm ${n.added} · sửa ${n.modified} · xóa ${n.deleted} · ghi đè ${n.overwritten} · giống sẵn ${n.same} · xung đột ${n.conflict}`,
  );
  if (!dry && !noBackup && (n.overwritten || (force && conflicts.length))) {
    console.log(`Bản cũ của file bị ghi đè: .company-bundle-backup/${stamp}/`);
  }
  if (conflicts.length && !force) {
    console.log(
      `\n⚠ ${conflicts.length} file xung đột — máy nhà KHÔNG bị ghi đè. Mở từng file .company-incoming để gộp tay,` +
        " hoặc chạy lại với --force nếu muốn lấy hết bản công ty.",
    );
    process.exitCode = 1;
  }
  console.log(
    "\nBước tiếp theo (tự làm, script không commit/push):\n" +
      "  1) git status / git diff   — xem lại\n" +
      "  2) pnpm install            — nếu package.json / pnpm-lock.yaml đổi\n" +
      "  3) đọc CONFIRM.md          — các điểm AI tự quyết chờ bạn duyệt; PROGRESS.md — việc ⏭ cloud\n" +
      "  4) git add -A && git commit && git push — khi hài lòng",
  );
}

// ───────── Phần đóng gói (chỉ chạy ở máy công ty) ─────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const die = (msg, code = 2) => {
  console.error("✗ " + msg);
  process.exit(code);
};

function git(args, { buffer = false, allowFail = false } = {}) {
  try {
    const out = execFileSync("git", args, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 30 });
    return buffer ? out : out.toString("utf8");
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

const root = process.cwd();
try {
  if (!/WatchFlow/.test(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8").slice(0, 400))) throw new Error();
} catch {
  die("Hãy chạy ở THƯ MỤC GỐC repo WatchFlow (nơi có CLAUDE.md).");
}

const SELF_REL = path.relative(root, fileURLToPath(import.meta.url)).split(path.sep).join("/");
const OUT_NAME = opt("--out", `watchflow-changes-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}.mjs`);
const maxMb = Number(opt("--max-mb", "25"));
const snapshotForced = flag("--all");

const EXCLUDE_DIRS = new Set([
  ".git", "node_modules", ".next", ".local", ".vercel", ".turbo", "coverage",
  "playwright-report", "test-results", ".company-bundle-backup",
]);
function excluded(rel, snapshot) {
  const parts = rel.split("/");
  const name = parts[parts.length - 1];
  if (parts.slice(0, -1).some((s) => EXCLUDE_DIRS.has(s))) return true;
  if (rel.startsWith("design/ui-preview/dist/")) return true;
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) return true;
  if (/^(CLAUDE\.local\.md|\.DS_Store|Thumbs\.db)$/.test(name)) return true;
  if (rel === ".claude/settings.local.json") return true;
  if (/\.(log|tsbuildinfo)$/.test(name)) return true;
  if (/^watchflow-changes-.*\.mjs$/.test(name) || rel === SELF_REL || rel === OUT_NAME) return true;
  if (snapshot && /(\.xlsx$|^~\$)/i.test(name)) return true;
  return false;
}

// Xác định chế độ
let useGit = !snapshotForced;
let baseCommit = null;
if (useGit) {
  const cdup = git(["rev-parse", "--show-cdup"], { allowFail: true });
  if (cdup === null) {
    console.warn("⚠ Không thấy git → chế độ snapshot (gói toàn bộ file, ghi đè có sao lưu).");
    useGit = false;
  } else if (cdup.trim() !== "") {
    die("Hãy chạy ở THƯ MỤC GỐC repo (đang đứng ở thư mục con).");
  } else {
    baseCommit = (git(["rev-parse", "HEAD"], { allowFail: true }) || "").trim() || null;
    if (!baseCommit) {
      console.warn("⚠ Repo chưa có commit → chế độ snapshot.");
      useGit = false;
    }
  }
}

const entries = []; // { path, op, baseSha, sha, data }
const skipped = [];
const maxBytes = maxMb * 1024 * 1024;

function addEntry(rel, op, baseSha) {
  let st;
  try {
    st = fs.lstatSync(rel);
  } catch {
    return;
  }
  if (!st.isFile()) return void skipped.push(`${rel} (không phải file thường: symlink/thư mục)`);
  if (st.size > maxBytes) return void skipped.push(`${rel} (${(st.size / 1048576).toFixed(1)} MB > ${maxMb} MB)`);
  const data = fs.readFileSync(rel);
  const sha = normHash(data);
  if (op === "modify" && baseSha === sha) return; // chỉ khác kiểu xuống dòng
  entries.push({ path: rel, op, baseSha, sha, data });
}

if (useGit) {
  const tracked = git(["diff", "--name-status", "-z", "--no-renames", "HEAD"]).split("\0").filter(Boolean);
  for (let i = 0; i + 1 < tracked.length; i += 2) {
    const st = tracked[i][0];
    const rel = tracked[i + 1];
    if (excluded(rel, false)) continue;
    if (st === "D") {
      const baseBuf = git(["show", "HEAD:" + rel], { buffer: true, allowFail: true });
      entries.push({ path: rel, op: "delete", baseSha: baseBuf ? normHash(baseBuf) : null, sha: null, data: null });
    } else if (st === "M" || st === "T") {
      const baseBuf = git(["show", "HEAD:" + rel], { buffer: true, allowFail: true });
      addEntry(rel, "modify", baseBuf ? normHash(baseBuf) : null);
    } else if (st === "A") {
      addEntry(rel, "add", null);
    } else {
      skipped.push(`${rel} (trạng thái git '${st}' — bỏ qua)`);
    }
  }
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  for (const rel of untracked) if (!excluded(rel, false)) addEntry(rel, "add", null);
} else {
  const walk = (dir, rel) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + "/" + d.name : d.name;
      if (d.isDirectory()) {
        if (!EXCLUDE_DIRS.has(d.name)) walk(path.join(dir, d.name), r);
      } else if (!excluded(r, true)) addEntry(r, "add", null);
    }
  };
  walk(root, "");
}
entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

// Quét bí mật
const PLACEHOLDER = /^(?:\$|\{|<|\[|x{3,}|\*{3,}|\.{3}|password|passwd|pass\b|secret|changeme|your|example|test|dev|local|postgres|wf_)/i;
const LOCALHOST = /^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/i;
const RULES = [
  ["khóa riêng (PRIVATE KEY)", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, null],
  [
    "chuỗi kết nối có mật khẩu thật",
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/'"`<>]+:([^\s@/'"`<>]{6,})@([^\s/:'"`<>?]+)/,
    (m) => !PLACEHOLDER.test(m[1]) && !LOCALHOST.test(m[2]),
  ],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/, null],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, null],
  ["API key kiểu sk-…", /\bsk-[A-Za-z0-9_-]{32,}\b/, null],
  ["JWT", /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, null],
];
const hits = [];
for (const e of entries) {
  if (!e.data || e.data.length > 2 * 1024 * 1024 || e.data.subarray(0, 8000).includes(0)) continue;
  const lines = e.data.toString("utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [name, re, ok] of RULES) {
      const m = line.match(re);
      if (m && (!ok || ok(m))) hits.push(`${e.path}:${i + 1}  ${name}`);
    }
  });
}

const OPSYM = { add: "+", modify: "~", delete: "-" };
const counts = ["add", "modify", "delete"].map((o) => `${OPSYM[o]}${entries.filter((e) => e.op === o).length}`).join(" ");
console.log(`Chế độ: ${useGit ? "diff so với HEAD " + baseCommit.slice(0, 10) : "snapshot"} · ${entries.length} file (${counts})`);
if (skipped.length) console.log("Bỏ qua:\n  " + skipped.join("\n  "));
if (hits.length) {
  console.error(`\n⚠ Nghi có bí mật trong ${hits.length} chỗ (không in giá trị):\n  ` + hits.slice(0, 50).join("\n  "));
  if (!flag("--allow-secrets")) die("Dừng. Xem lại các chỗ trên; nếu chắc chắn là dữ liệu giả thì chạy lại với --allow-secrets.");
}
if (flag("--list")) {
  for (const e of entries) console.log(`  ${OPSYM[e.op]} ${e.path}`);
  process.exit(0);
}
if (!entries.length) die("Không có thay đổi nào để đóng gói.", 0);

// Đóng gói
const meta = { format: 1, createdAt: new Date().toISOString(), mode: useGit ? "diff" : "snapshot", baseCommit, files: [] };
const chunks = [];
let offset = 0;
for (const e of entries) {
  const f = { path: e.path, op: e.op, baseSha: e.baseSha, sha: e.sha, size: e.data ? e.data.length : 0, offset };
  if (e.data) {
    chunks.push(e.data);
    offset += e.data.length;
  }
  meta.files.push(f);
}
const metaBuf = Buffer.from(JSON.stringify(meta), "utf8");
const head = Buffer.alloc(4);
head.writeUInt32BE(metaBuf.length);
const gz = zlib.gzipSync(Buffer.concat([head, metaBuf, ...chunks]), { level: 9 });
const gzSha = crypto.createHash("sha256").update(gz).digest("hex");
const b64 = gz.toString("base64").match(/.{1,120}/g).join("\n");

const listed = entries.slice(0, 2000).map((e) => `//   ${OPSYM[e.op]} ${e.path.replace(/[\r\n]/g, "?")}`);
const out = [
  "#!/usr/bin/env node",
  `// WatchFlow — GÓI THAY ĐỔI từ máy công ty (${meta.createdAt})`,
  `// Cách dùng (ở thư mục GỐC repo máy cá nhân, sau khi git pull): node ${path.basename(OUT_NAME)} [--dry-run] [--force] [--no-backup]`,
  `// Chế độ: ${meta.mode}${baseCommit ? " · commit gốc " + baseCommit.slice(0, 10) : ""} · ${entries.length} file (${counts})`,
  "// Danh sách file:",
  ...listed,
  entries.length > 2000 ? `//   … và ${entries.length - 2000} file nữa` : "//",
  IMPORTS,
  normHash.toString(),
  applyMain.toString(),
  `const PAYLOAD_SHA256 = "${gzSha}";`,
  "const PAYLOAD = `",
  b64,
  "`;",
  "await applyMain(PAYLOAD, PAYLOAD_SHA256, process.argv.slice(2));",
  "",
].join("\n");
fs.writeFileSync(OUT_NAME, out);
const rawMb = (entries.reduce((s, e) => s + (e.data ? e.data.length : 0), 0) / 1048576).toFixed(2);
console.log(`\n✔ Đã tạo ${OUT_NAME} (${(Buffer.byteLength(out) / 1048576).toFixed(2)} MB; dữ liệu gốc ${rawMb} MB)`);
console.log(`Mang file này về máy cá nhân, đứng ở gốc repo (đã git pull) rồi chạy:\n  node ${path.basename(OUT_NAME)} --dry-run   (xem trước)\n  node ${path.basename(OUT_NAME)}             (áp dụng)`);
