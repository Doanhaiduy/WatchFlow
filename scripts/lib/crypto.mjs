// Mã hóa PII/TOTP secret: AES-256-GCM, định dạng "v1:<iv b64url>:<ct b64url>:<tag b64url>". Khớp src/server/pii.ts.
import crypto from "node:crypto";
export function encrypt(plain, keyB64, ver = "v1") {
  const key = Buffer.from(keyB64, "base64");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return [ver, iv.toString("base64url"), ct.toString("base64url"), c.getAuthTag().toString("base64url")].join(":");
}
export function blindIndex(value, keyB64) {
  return crypto.createHmac("sha256", Buffer.from(keyB64, "base64")).update(String(value)).digest("hex");
}
