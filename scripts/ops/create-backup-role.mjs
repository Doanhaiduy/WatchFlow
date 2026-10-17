// Tạo/xoay mật khẩu vai trò sao lưu wf_backup (LOGIN, BYPASSRLS, chỉ SELECT) — backup-restore §3.
// Dùng: node scripts/ops/create-backup-role.mjs --env production [--rotate]   (staging/production: ⏭ cloud ở máy công ty)
// Ghi chuỗi kết nối vào backup/backup-db-url-<env>.txt (git-ignore). Kiểm tra: INSERT bằng vai trò này phải lỗi.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "../lib/env.mjs";
import { ownerUrl, connect, targetEnv } from "../lib/db.mjs";

const env = targetEnv();
const url = ownerUrl({ env });
const c = await connect(url);
try {
  const pw = crypto.randomBytes(24).toString("base64url");
  await c.query(`ALTER ROLE wf_backup WITH LOGIN BYPASSRLS PASSWORD ${c.escapeLiteral(pw)}`);
  await c.query("GRANT USAGE ON SCHEMA public, app TO wf_backup");
  await c.query("GRANT SELECT ON ALL TABLES IN SCHEMA public TO wf_backup");
  const u = new URL(url);
  u.username = "wf_backup";
  u.password = pw;
  const dir = path.join(ROOT, "backup");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `backup-db-url-${env}.txt`), u.toString() + "\n", { mode: 0o600 });
  // tự kiểm: không ghi được
  const b = await connect(u.toString());
  try {
    await b.query("INSERT INTO public.settings (key, value) VALUES ('x.y', '1')");
    console.error("✘ wf_backup GHI được — dừng lại kiểm tra quyền!");
    process.exitCode = 1;
  } catch {
    console.log(`✔ wf_backup sẵn sàng (chỉ đọc). Chuỗi kết nối: backup/backup-db-url-${env}.txt — đặt vào secret BACKUP_DATABASE_URL.`);
  } finally {
    await b.end();
  }
} finally {
  await c.end();
}
