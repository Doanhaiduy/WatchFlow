// Điều khiển PostgreSQL local: 127.0.0.1:54329, dữ liệu .local/pgdata.
// Dùng nhị phân từ PG_BIN, hoặc bản cài sẵn C:\Program Files\PostgreSQL\<bản mới nhất>\bin, hoặc PATH.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { ROOT } from "../lib/env.mjs";

export const PG_PORT = Number(process.env.PG_PORT || 54329);
export const PG_DATA = path.join(ROOT, ".local", "pgdata");
const PW_FILE = path.join(ROOT, ".local", "pg-superuser.txt");
const LOG_FILE = path.join(ROOT, ".local", "pg.log");
const exe = process.platform === "win32" ? ".exe" : "";

export function pgBin(name) {
  const cands = [];
  if (process.env.PG_BIN) cands.push(process.env.PG_BIN);
  if (process.platform === "win32") {
    const base = "C:/Program Files/PostgreSQL";
    if (fs.existsSync(base)) {
      for (const v of fs.readdirSync(base).filter((d) => /^\d+$/.test(d)).sort((a, b) => Number(b) - Number(a))) cands.push(path.join(base, v, "bin"));
    }
  } else {
    for (const v of ["18", "17", "16"]) cands.push(`/usr/lib/postgresql/${v}/bin`);
    cands.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  }
  for (const d of cands) {
    const p = path.join(d, name + exe);
    if (fs.existsSync(p)) return p;
  }
  return name; // thử PATH
}

export function superuserPassword() {
  if (fs.existsSync(PW_FILE)) return fs.readFileSync(PW_FILE, "utf8").trim();
  fs.mkdirSync(path.dirname(PW_FILE), { recursive: true });
  const pw = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(PW_FILE, pw + "\n", { mode: 0o600 });
  return pw;
}

export function superuserUrl(db = "postgres") {
  return `postgres://postgres:${encodeURIComponent(superuserPassword())}@127.0.0.1:${PG_PORT}/${db}`;
}

function run(bin, args, opts = {}) {
  const r = spawnSync(pgBin(bin), args, { encoding: "utf8", windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return r;
}

export function isRunning() {
  if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) return false;
  return run("pg_ctl", ["status", "-D", PG_DATA]).status === 0;
}

export function init() {
  if (fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) return false;
  fs.mkdirSync(PG_DATA, { recursive: true });
  const pwTmp = path.join(ROOT, ".local", "pw.tmp");
  fs.writeFileSync(pwTmp, superuserPassword() + "\n");
  try {
    const r = run("initdb", ["-D", PG_DATA, "-U", "postgres", "--pwfile", pwTmp, "-E", "UTF8", "--locale=C", "--auth=scram-sha-256"]);
    if (r.status !== 0) throw new Error("initdb lỗi:\n" + r.stderr);
  } finally {
    fs.rmSync(pwTmp, { force: true });
  }
  // Chỉ nghe 127.0.0.1
  fs.appendFileSync(path.join(PG_DATA, "postgresql.conf"), `\nlisten_addresses = '127.0.0.1'\nport = ${PG_PORT}\nmax_connections = 200\ntimezone = 'UTC'\n`);
  // Linux/macOS: PG của gói hệ thống mặc định tạo socket ở /var/run/postgresql (người dùng thường — vd. CI — không ghi được ⇒ không khởi động).
  // Chỉ dùng TCP 127.0.0.1 nên tắt Unix socket. (Windows không có tham số này — không được ghi.)
  if (process.platform !== "win32") fs.appendFileSync(path.join(PG_DATA, "postgresql.conf"), `unix_socket_directories = ''\n`);
  return true;
}

export function start({ quiet = false } = {}) {
  const created = init();
  if (isRunning()) { if (!quiet) console.log(`PostgreSQL đang chạy (127.0.0.1:${PG_PORT}).`); return; }
  // stdio "ignore": postgres con kế thừa pipe sẽ làm spawnSync treo.
  const r = run("pg_ctl", ["start", "-D", PG_DATA, "-l", LOG_FILE, "-w", "-t", "60"], { stdio: "ignore" });
  if (r.status !== 0) throw new Error("Không khởi động được PostgreSQL. Xem .local/pg.log");
  if (!quiet) console.log(`PostgreSQL đã khởi động (127.0.0.1:${PG_PORT})${created ? " — cụm mới" : ""}.`);
}

export function stop() {
  if (!isRunning()) { console.log("PostgreSQL không chạy."); return; }
  const r = run("pg_ctl", ["stop", "-D", PG_DATA, "-m", "fast", "-w"]);
  console.log(r.status === 0 ? "Đã dừng PostgreSQL." : r.stderr);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const cmd = process.argv[2];
  const quiet = process.argv.includes("--quiet");
  try {
    if (cmd === "start") start({ quiet });
    else if (cmd === "stop") stop();
    else if (cmd === "status") console.log(isRunning() ? `Đang chạy 127.0.0.1:${PG_PORT} · dữ liệu ${PG_DATA} · ${pgBin("postgres")}` : "Không chạy.");
    else { console.log("Dùng: pg.mjs start|stop|status"); process.exit(1); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
