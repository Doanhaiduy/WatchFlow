// Sinh bộ khóa mới cho một môi trường — CHỈ in ra màn hình (hoặc trả về object cho setup-local). Không ghi file.
import crypto from "node:crypto";
import path from "node:path";

export function genKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    AUTH_JWT_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    AUTH_JWT_PUBLIC_KEY: publicKey.export({ type: "spki", format: "pem" }).toString(),
    AUTH_JWT_KID: "k" + new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    PII_KEY_V1: crypto.randomBytes(32).toString("base64"),
    PII_BIDX_KEY: crypto.randomBytes(32).toString("base64"),
    CRON_SECRET: crypto.randomBytes(24).toString("base64url"),
    OPS_HEARTBEAT_SECRET: crypto.randomBytes(24).toString("base64url"),
    WF_API_PASSWORD: crypto.randomBytes(18).toString("base64url"),
  };
}

/** Cặp khóa VAPID (Web Push, ECDSA P-256) dạng base64url + chủ thể mailto giả của môi trường. KHÔNG đưa vào .env.local (local tắt đẩy thật). */
export function genVapid(env = "production") {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString("base64url"),
    VAPID_PRIVATE_KEY: ecdh.getPrivateKey().toString("base64url"),
    VAPID_SUBJECT: `mailto:push@${env}.watchflow.invalid`,
  };
}

export function toEnvLines(keys) {
  return Object.entries(keys).map(([k, v]) => `${k}="${String(v).trim().replace(/\n/g, "\\n")}"`).join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("env", "gen-keys.mjs"))) {
  const envName = process.argv[2] || "production";
  console.log("# Khóa mới — lưu vào .env.<môi trường> + trình quản lý mật khẩu. KHÔNG commit.\n" + toEnvLines(genKeys()));
  console.log("\n# VAPID (thông báo đẩy) — mỗi môi trường một cặp riêng; đổi khóa = mọi thiết bị phải bật lại thông báo. Không dùng ở .env.local.\n" + toEnvLines(genVapid(envName)));
}
