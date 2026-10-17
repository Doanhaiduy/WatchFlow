import "server-only";
// Biến môi trường phía máy chủ (chỉ tên; giá trị ở .env.*). Thiếu biến bắt buộc ⇒ lỗi rõ ràng lúc dùng.

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường ${name}`);
  return v.replace(/\\n/g, "\n");
}

export const env = {
  get databaseUrl() { return req("DATABASE_URL"); },
  get allowRemoteDb() { return process.env.ALLOW_REMOTE_DB === "true"; },
  get jwtPrivateKey() { return req("AUTH_JWT_PRIVATE_KEY"); },
  get jwtPublicKey() { return req("AUTH_JWT_PUBLIC_KEY"); },
  get jwtKid() { return process.env.AUTH_JWT_KID || "k1"; },
  get piiKeyV1() { return req("PII_KEY_V1"); },
  get piiBidxKey() { return req("PII_BIDX_KEY"); },
  get cronSecret() { return req("CRON_SECRET"); },
  get opsHeartbeatSecret() { return process.env.OPS_HEARTBEAT_SECRET || ""; },
  get rateLimitPepper() { return process.env.RATE_LIMIT_PEPPER || process.env.PII_BIDX_KEY || "wf"; },
  get cookieSecure() { return process.env.COOKIE_SECURE !== "false"; },
  get storageDriver() { return (process.env.STORAGE_DRIVER || "local") as "local" | "supabase"; },
  get appUrl() { return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; },
  get poolMax() { return Number(process.env.DB_POOL_MAX || 5); },
  get dbTrace() { return process.env.DB_TRACE === "1"; },
  /** Web Push: thiếu khóa VAPID ⇒ tính năng tắt êm (src/server/push.ts) */
  get vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY || ""; },
  get vapidPrivateKey() { return process.env.VAPID_PRIVATE_KEY || ""; },
  get vapidSubject() { return process.env.VAPID_SUBJECT || "mailto:push@watchflow.invalid"; },
  get isProd() { return process.env.NODE_ENV === "production"; },
};
