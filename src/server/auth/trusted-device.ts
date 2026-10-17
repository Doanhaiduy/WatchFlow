import "server-only";
// "Tin cậy thiết bị này N ngày" ở bước xác thực 2 bước (0021a_trusted_devices.sql; security-model §7.4).
//  • Token ngẫu nhiên 256-bit nằm trong cookie httpOnly (Path=/api/v1/auth, SameSite=Strict); DB CHỈ giữ SHA-256.
//  • Một trình duyệt tin cậy được nhiều tài khoản: cookie chứa tối đa 5 token (cách nhau dấu phẩy); mỗi token chỉ có tác dụng với đúng tài khoản đã cấp.
//  • Chỉ bỏ qua BƯỚC MÃ 6 SỐ khi đăng nhập — mật khẩu luôn phải đúng; tài khoản khóa/vô hiệu bị chặn trước. reauth (thao tác nhạy cảm) KHÔNG bao giờ bỏ qua.
//  • Hết hạn cố định (security.trusted_device_days, không gia hạn khi dùng; 0 = tắt). Thu hồi: trigger trên users (đổi/đặt lại mật khẩu, khóa tài khoản,
//    tắt 2FA) + người dùng tự thu hồi ở /cai-dat.
import type { NextResponse } from "next/server";
import { withAuth, type Tx } from "../db";
import { ApiError } from "../errors";
import { setTrustCookie as setCookie, clearTrustCookie as clearCookie } from "./cookies";
import { newOpaqueToken, sha256 } from "./tokens";

const MAX_COOKIE_TOKENS = 5;
const MAX_ACTIVE_PER_USER = 10;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Nhãn thiết bị hiển thị: "Trình duyệt · Hệ điều hành" suy từ User-Agent. */
export function deviceLabel(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Thiết bị";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Trình duyệt";
  return `${br} · ${os}`;
}

/** Đọc cookie ⇒ danh sách token hợp lệ về hình thức (tối đa 5). */
export function parseTrustCookie(value: string | undefined | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((t) => t.trim()).filter((t) => TOKEN_RE.test(t)))].slice(0, MAX_COOKIE_TOKENS);
}

export function setTrustCookie(res: NextResponse, tokens: string[], days: number) {
  setCookie(res, tokens.slice(0, MAX_COOKIE_TOKENS).join(","), days);
  return res;
}

export function clearTrustCookie(res: NextResponse) {
  clearCookie(res);
  return res;
}

/** Cookie mới = token mới đứng đầu + các token cũ (tối đa 5). */
export const mergeTrustTokens = (fresh: string, existing: string[]): string[] => [fresh, ...existing.filter((t) => t !== fresh)].slice(0, MAX_COOKIE_TOKENS);

/** Số ngày tin cậy (0 = tắt), kẹp 0…90. */
export async function trustedDays(tx: Tx): Promise<number> {
  const r = await tx.one<{ v: number }>("SELECT app.setting_int('security.trusted_device_days', 30) AS v");
  return Math.max(0, Math.min(90, r?.v ?? 30));
}

/** Thiết bị đang dùng có phải thiết bị đã tin cậy của tài khoản này (còn hạn, chưa thu hồi, cùng nhãn trình duyệt/hệ điều hành)? Có ⇒ ghi lần dùng. */
export async function findTrustedDevice(tx: Tx, userId: string, tokens: string[], userAgent: string | null): Promise<string | null> {
  if (!tokens.length || (await trustedDays(tx)) === 0) return null;
  const r = await tx.one<{ id: string }>(
    `UPDATE public.trusted_devices SET last_used_at = now()
      WHERE id = (SELECT id FROM public.trusted_devices
                   WHERE user_id = $1 AND token_hash = ANY($2::text[]) AND revoked_at IS NULL AND expires_at > now()
                     AND (device_label IS NULL OR $3::text IS NULL OR device_label = $3)
                   LIMIT 1)
      RETURNING id`,
    [userId, tokens.map(sha256), deviceLabel(userAgent)],
  );
  return r?.id ?? null;
}

/** Tạo thiết bị tin cậy mới trong transaction wf_auth của bước xác thực 2 bước. Trả token (để đặt vào cookie) + số ngày. null nếu tính năng đang tắt. */
export async function createTrustedDevice(tx: Tx, userId: string, userAgent: string | null, ipHash: string): Promise<{ token: string; days: number } | null> {
  const days = await trustedDays(tx);
  if (days === 0) return null;
  const t = newOpaqueToken();
  await tx.q("DELETE FROM public.trusted_devices WHERE user_id = $1 AND (expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days')", [userId]);
  // Giữ tối đa MAX_ACTIVE_PER_USER thiết bị còn hiệu lực (thu hồi các cái cũ nhất)
  await tx.q(
    `UPDATE public.trusted_devices SET revoked_at = now(), revoked_reason = 'limit'
      WHERE id IN (SELECT id FROM public.trusted_devices WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC OFFSET $2)`,
    [userId, MAX_ACTIVE_PER_USER - 1],
  );
  await tx.q(
    `INSERT INTO public.trusted_devices (user_id, token_hash, device_label, ip_hash, last_used_at, expires_at)
     VALUES ($1, $2, $3, $4, now(), now() + make_interval(days => $5))`,
    [userId, t.hash, deviceLabel(userAgent), ipHash, days],
  );
  return { token: t.token, days };
}

// ---------------------------------------------------------------------
// Danh sách + thu hồi (Cài đặt → Bảo mật)
// ---------------------------------------------------------------------
export type TrustedDeviceDto = { id: string; label: string; createdAt: string; lastUsedAt: string | null; expiresAt: string; current: boolean };

export async function listTrustedDevices(userId: string, cookieTokens: string[]): Promise<{ days: number; items: TrustedDeviceDto[] }> {
  const mine = new Set(cookieTokens.map(sha256));
  return withAuth(async (tx) => {
    const days = await trustedDays(tx);
    const rows = await tx.q<{ id: string; token_hash: string; device_label: string | null; created_at: Date; last_used_at: Date | null; expires_at: Date }>(
      `SELECT id, token_hash, device_label, created_at, last_used_at, expires_at
         FROM public.trusted_devices WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
      [userId],
    );
    return {
      days,
      items: rows.map((r) => ({
        id: r.id, label: r.device_label ?? "Thiết bị không rõ", createdAt: r.created_at.toISOString(),
        lastUsedAt: r.last_used_at ? r.last_used_at.toISOString() : null, expiresAt: r.expires_at.toISOString(), current: mine.has(r.token_hash),
      })),
    };
  });
}

export async function auditTrust(tx: Tx, action: string, userId: string, after: object | null, ipHash: string) {
  await tx.q(
    `INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, after, ip_hash, level) VALUES ($1::uuid,$2,'users',$5::text,$3,$4,'info')`,
    [userId, action, after ? JSON.stringify(after) : null, ipHash, userId],
  );
}

/** Thu hồi một thiết bị của chính mình. Trả token_hash đã thu hồi. */
export async function revokeTrustedDevice(userId: string, id: string, ipHash: string): Promise<string> {
  return withAuth(async (tx) => {
    const r = await tx.one<{ token_hash: string }>(
      "UPDATE public.trusted_devices SET revoked_at = now(), revoked_reason = 'user' WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING token_hash",
      [id, userId],
    );
    if (!r) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy thiết bị tin cậy này (có thể đã được thu hồi).");
    await auditTrust(tx, "auth.trusted_device_revoked", userId, { deviceId: id }, ipHash);
    return r.token_hash;
  });
}

export async function revokeAllTrustedDevices(userId: string, ipHash: string): Promise<number> {
  return withAuth(async (tx) => {
    const r = await tx.q("UPDATE public.trusted_devices SET revoked_at = now(), revoked_reason = 'user' WHERE user_id = $1 AND revoked_at IS NULL RETURNING 1", [userId]);
    if (r.length) await auditTrust(tx, "auth.trusted_devices_revoked", userId, { reason: "user", count: r.length }, ipHash);
    return r.length;
  });
}
