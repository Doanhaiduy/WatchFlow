import "server-only";
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "./env";

/** Xác thực Bearer cho /api/cron/* (Vercel Cron) và heartbeat sao lưu */
export function bearerOk(req: NextRequest, secret: string): boolean {
  const h = req.headers.get("authorization") ?? "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!secret || !tok || tok.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(secret));
}

export function cronGuard(req: NextRequest): NextResponse | null {
  let secret = "";
  try { secret = env.cronSecret; } catch { /* thiếu biến ⇒ từ chối */ }
  if (!bearerOk(req, secret)) return NextResponse.json({ code: "WF-AUTH-UNAUTHENTICATED", detail: "Thiếu hoặc sai khóa cron." }, { status: 401 });
  return null;
}
