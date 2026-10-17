// Sao lưu thủ công: pg_dump -Fc → mã hóa AES-256-GCM (khóa dẫn từ passphrase bằng scrypt) → .local/backups/watchflow-<thời điểm>.dump.enc
// Dùng: pnpm db:backup [-- --env local|staging|production] [--passphrase-file <tệp>] [--plain]
// Passphrase: biến BACKUP_PASSPHRASE hoặc --passphrase-file; local không có ⇒ sinh và lưu .local/backup-passphrase.txt (git-ignore).
// Định dạng tệp: "WFBK1" | salt(16) | iv(12) | tag(16) | ciphertext. Giải mã: node scripts/db/backup.mjs --decrypt <tệp> --out <tệp>.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { ROOT, argValue, hasFlag } from "../lib/env.mjs";
import { ownerUrl, targetEnv } from "../lib/db.mjs";
import { pgBin } from "./pg.mjs";

const MAGIC = Buffer.from("WFBK1");

export function passphrase(env = "local") {
  const file = argValue("--passphrase-file");
  if (file) return fs.readFileSync(file, "utf8").trim();
  if (process.env.BACKUP_PASSPHRASE) return process.env.BACKUP_PASSPHRASE;
  if (env !== "local") throw new Error("Thiếu BACKUP_PASSPHRASE cho môi trường " + env);
  const f = path.join(ROOT, ".local", "backup-passphrase.txt");
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(24).toString("base64url") + "\n", { mode: 0o600 });
  return fs.readFileSync(f, "utf8").trim();
}

export function encrypt(buf, pass) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pass, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), ct]);
}

export function decrypt(buf, pass) {
  if (!buf.subarray(0, 5).equals(MAGIC)) throw new Error("Không phải tệp sao lưu WatchFlow");
  const salt = buf.subarray(5, 21), iv = buf.subarray(21, 33), tag = buf.subarray(33, 49), ct = buf.subarray(49);
  const key = crypto.scryptSync(pass, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export function dump(url) {
  const r = spawnSync(pgBin("pg_dump"), ["-Fc", "--no-owner", "--no-acl", "-n", "public", "-n", "app", "-d", url], { maxBuffer: 2 * 1024 ** 3, windowsHide: true });
  if (r.status !== 0) throw new Error("pg_dump lỗi: " + r.stderr?.toString());
  return r.stdout;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("db", "backup.mjs"));
if (isMain) {
  try {
    const env = targetEnv();
    const dec = argValue("--decrypt");
    if (dec) {
      const out = argValue("--out", dec.replace(/\.enc$/, ""));
      fs.writeFileSync(out, decrypt(fs.readFileSync(dec), passphrase(env)));
      console.log("✔ Đã giải mã → " + out);
    } else {
      const raw = dump(ownerUrl({ env }));
      const dir = path.join(ROOT, ".local", "backups");
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(new Date()).replace(/[: ]/g, "").replace(/-/g, "");
      const file = path.join(dir, `watchflow-${env}-${stamp}.dump${hasFlag("--plain") ? "" : ".enc"}`);
      fs.writeFileSync(file, hasFlag("--plain") ? raw : encrypt(raw, passphrase(env)), { mode: 0o600 });
      console.log(`✔ Sao lưu ${env}: ${path.relative(ROOT, file)} (${(raw.length / 1024).toFixed(0)} KB trước mã hóa)`);
      if (hasFlag("--with-storage")) console.log("ℹ --with-storage: local lưu ở .local/storage (sao chép thư mục); staging/production dùng scripts/ops/storage-backup.mjs (cloud — ⏭).");
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
