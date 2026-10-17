// Nạp biến môi trường từ .env.<env> (mặc định .env.local) — không ghi đè biến đã có.
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");

export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v.replace(/\\n/g, "\n");
  }
  return out;
}

export function loadEnv(envName = "local", { override = false } = {}) {
  const file = path.join(ROOT, `.env.${envName}`);
  if (!fs.existsSync(file)) return {};
  const vars = parseEnv(fs.readFileSync(file, "utf8"));
  for (const [k, v] of Object.entries(vars)) if (override || process.env[k] === undefined) process.env[k] = v;
  return vars;
}

export function argValue(name, def = undefined) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
export const hasFlag = (name) => process.argv.includes(name);

/** Chặn chuỗi kết nối không phải local trừ khi cho phép rõ ràng. */
export function assertLocalUrl(url, { allowRemote = false } = {}) {
  const u = new URL(url);
  const local = ["127.0.0.1", "localhost", "::1"].includes(u.hostname);
  if (!local && !allowRemote && process.env.ALLOW_REMOTE_DB !== "true") {
    throw new Error(`Từ chối kết nối DB không phải local (${u.hostname}). Dùng --env staging|production hoặc ALLOW_REMOTE_DB=true.`);
  }
  return u;
}
