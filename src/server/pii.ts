import "server-only";
// PII: AES-256-GCM tầng ứng dụng, định dạng "v1:<iv>:<ct>:<tag>" (base64url) + chỉ mục băm HMAC-SHA256 (BR-SEC-03).
// Khớp scripts/lib/crypto.mjs. KHÔNG log giá trị giải mã.
import crypto from "node:crypto";
import { env } from "./env";

function key(ver: string): Buffer {
  if (ver !== "v1") throw new Error("Phiên bản khóa PII không hỗ trợ");
  const k = Buffer.from(env.piiKeyV1, "base64");
  if (k.length !== 32) throw new Error("PII_KEY_V1 phải dài 32 byte (base64)");
  return k;
}

export function encryptPii(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key("v1"), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), ct.toString("base64url"), c.getAuthTag().toString("base64url")].join(":");
}

export function decryptPii(enc: string): string {
  const [ver, iv, ct, tag] = enc.split(":");
  if (!ver || !iv || !ct || !tag) throw new Error("Dữ liệu mã hóa hỏng");
  const d = crypto.createDecipheriv("aes-256-gcm", key(ver), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export function blindIndex(value: string): string {
  const norm = value.replace(/\s+/g, "").toUpperCase();
  return crypto.createHmac("sha256", Buffer.from(env.piiBidxKey, "base64")).update(norm).digest("hex");
}

/** "079201001234" → "*** *** 234" */
export function maskId(last3: string | null | undefined): string {
  return last3 ? `*** *** ${last3.slice(-3)}` : "—";
}

export function hashIp(ip: string | null | undefined): string {
  return crypto.createHmac("sha256", env.rateLimitPepper).update(ip || "unknown").digest("hex").slice(0, 32);
}
