import "server-only";
// TOTP RFC 6238 (30 giây, 6 số, SHA1) — chấp nhận lệch ±1 bước; chống dùng lại cùng bước (user_mfa.last_used_step).
import { TOTP, Secret } from "otpauth";

const make = (secret: string, label?: string) =>
  new TOTP({ issuer: "WatchFlow", label: label ?? "WatchFlow", secret: Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, account: string): string {
  return make(secret, account).toString();
}

/** Trả số bước (counter) nếu đúng, null nếu sai */
export function verifyTotp(secret: string, code: string, at = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = make(secret).validate({ token: code, timestamp: at, window: 1 });
  if (delta === null) return null;
  return Math.floor(at / 1000 / 30) + delta;
}

export function generateTotp(secret: string, at = Date.now()): string {
  return make(secret).generate({ timestamp: at });
}
