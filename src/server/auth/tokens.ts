import "server-only";
// Access token JWT EdDSA (15 phút) + refresh token ngẫu nhiên (lưu băm SHA-256, xoay vòng) — security-model §7.
import crypto from "node:crypto";
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { env } from "../env";

type Keys = { priv: CryptoKey; pub: CryptoKey };
let keys: Promise<Keys> | null = null;
function getKeys(): Promise<Keys> {
  keys ??= Promise.all([importPKCS8(env.jwtPrivateKey, "EdDSA"), importSPKI(env.jwtPublicKey, "EdDSA")]).then(([priv, pub]) => ({ priv, pub }));
  return keys;
}

export type AccessClaims = { sub: string; sid: string };

export async function signAccess(c: AccessClaims, ttlSeconds: number): Promise<string> {
  const { priv } = await getKeys();
  return new SignJWT({ sid: c.sid })
    .setProtectedHeader({ alg: "EdDSA", kid: env.jwtKid })
    .setSubject(c.sub)
    .setIssuedAt()
    .setIssuer("watchflow")
    .setAudience("watchflow")
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(priv);
}

export async function verifyAccess(token: string): Promise<AccessClaims | null> {
  try {
    const { pub } = await getKeys();
    const { payload } = await jwtVerify(token, pub, { issuer: "watchflow", audience: "watchflow", algorithms: ["EdDSA"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

export function newOpaqueToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
