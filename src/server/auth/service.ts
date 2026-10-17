import "server-only";
// Nghiệp vụ xác thực (BR-SEC-04/06, security-model §7). Chạy dưới vai trò DB wf_auth.
// Lỗi xác thực cần COMMIT (đếm sai, thu hồi phiên) ⇒ hàm trả kết quả, ném lỗi SAU khi transaction xong.
import crypto from "node:crypto";
import { withAuth, type Tx } from "../db";
import { ApiError } from "../errors";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { newOpaqueToken, sha256, signAccess } from "./tokens";
import { newTotpSecret, totpUri, verifyTotp } from "./totp";
import { decryptPii, encryptPii } from "../pii";
import { auditTrust, createTrustedDevice, findTrustedDevice } from "./trusted-device";

export type Issued = { userId: string; sessionId: string; accessToken: string; accessTtl: number; refreshToken: string | null; refreshTtlDays: number };

async function settingsInt(tx: Tx, keys: Record<string, number>): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(keys)) {
    const r = await tx.one<{ v: number }>("SELECT app.setting_int($1,$2) v", [k, d]);
    out[k] = r?.v ?? d;
  }
  return out;
}

async function audit(tx: Tx, action: string, userId: string | null, after: object | null, level: "info" | "high" = "info", ipHash?: string) {
  await tx.q(
    `INSERT INTO public.audit_logs (actor_id, action, entity_table, entity_id, after, level, ip_hash) VALUES ($1,$2,'users',$3,$4,$5,$6)`,
    [userId, action, userId, after ? JSON.stringify(after) : null, level, ipHash ?? null],
  );
}

async function issue(tx: Tx, userId: string, sessionId: string): Promise<Issued> {
  const s = await settingsInt(tx, { "security.access_token_ttl_seconds": 900, "security.refresh_token_ttl_days": 30 });
  const accessTtl = s["security.access_token_ttl_seconds"]!;
  const refreshTtlDays = s["security.refresh_token_ttl_days"]!;
  const rt = newOpaqueToken();
  await tx.q(
    // Token refresh không sống quá hạn tuyệt đối của phiên (auth_sessions.expires_at, CQ-015)
    `INSERT INTO public.refresh_tokens (session_id, token_hash, expires_at)
     SELECT $1, $2, least(now() + make_interval(days => $3), s.expires_at) FROM public.auth_sessions s WHERE s.id = $1`,
    [sessionId, rt.hash, refreshTtlDays],
  );
  const accessToken = await signAccess({ sub: userId, sid: sessionId }, accessTtl);
  return { userId, sessionId, accessToken, accessTtl, refreshToken: rt.token, refreshTtlDays };
}

type LoginResult = { ok: true; issued: Issued; mfaPending: boolean; viaTrusted: boolean } | { ok: false; error: ApiError };

/** trustTokens = token trong cookie thiết bị tin cậy (nếu có): hợp lệ ⇒ bỏ bước mã 2FA (mật khẩu vẫn phải đúng, reauth vẫn cần mã). */
export async function login(email: string, password: string, userAgent: string, ipHash: string, trustTokens: string[] = []): Promise<{ issued: Issued; mfaPending: boolean; viaTrusted: boolean }> {
  const r = await withAuth<LoginResult>(async (tx) => {
    const s = await settingsInt(tx, { "security.max_failed_logins": 5, "security.lockout_minutes": 15 });
    const max = s["security.max_failed_logins"]!;
    const lockMin = s["security.lockout_minutes"]!;
    const u = await tx.one<{ id: string; password_hash: string; status: string; locked_until: string | null; failed_login_count: number; mfa_enabled: boolean }>(
      `SELECT id, password_hash, status, locked_until::text, failed_login_count, mfa_enabled FROM public.users WHERE email = $1 FOR UPDATE`,
      [email.trim().toLowerCase()],
    );
    const invalid = (left?: number) =>
      new ApiError(401, "WF-AUTH-INVALID", left !== undefined && left <= 3 ? `Email hoặc mật khẩu không đúng. Còn ${left} lần thử trước khi tài khoản bị khóa tạm.` : "Email hoặc mật khẩu không đúng.", undefined, left !== undefined ? { "X-Attempts-Left": String(left) } : undefined);
    if (!u) {
      await verifyPassword(null, password);
      return { ok: false, error: invalid() };
    }
    if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
      return { ok: false, error: new ApiError(423, "WF-AUTH-LOCKED", `Tài khoản đang bị khóa tạm do nhập sai nhiều lần. Thử lại sau ${mins} phút.`) };
    }
    const good = await verifyPassword(u.password_hash, password);
    if (!good || u.status !== "active") {
      if (!good) {
        const n = u.failed_login_count + 1;
        if (n >= max) {
          await tx.q(`UPDATE public.users SET failed_login_count = 0, locked_until = now() + make_interval(mins => $2) WHERE id = $1`, [u.id, lockMin]);
          await audit(tx, "auth.locked", u.id, { minutes: lockMin }, "high", ipHash);
          return { ok: false, error: new ApiError(423, "WF-AUTH-LOCKED", `Nhập sai ${max} lần. Tài khoản bị khóa tạm ${lockMin} phút.`) };
        }
        await tx.q(`UPDATE public.users SET failed_login_count = $2 WHERE id = $1`, [u.id, n]);
        await audit(tx, "auth.login_failed", u.id, null, "info", ipHash);
        return { ok: false, error: invalid(max - n) };
      }
      return { ok: false, error: invalid() };
    }
    await tx.q(`UPDATE public.users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [u.id]);
    const trustedId = u.mfa_enabled ? await findTrustedDevice(tx, u.id, trustTokens, userAgent) : null;
    const sess = await tx.one<{ id: string }>(
      `INSERT INTO public.auth_sessions (user_id, user_agent, ip_hash, expires_at, mfa_at)
       VALUES ($1,$2,$3, now() + make_interval(days => app.setting_int('security.refresh_token_ttl_days', 30)), CASE WHEN $4::boolean THEN now() END) RETURNING id`,
      [u.id, userAgent, ipHash, trustedId !== null],
    );
    const issued = await issue(tx, u.id, sess!.id);
    await audit(tx, trustedId ? "auth.login_trusted" : "auth.login", u.id, trustedId ? { trustedDeviceId: trustedId } : null, "info", ipHash);
    return { ok: true, issued, mfaPending: u.mfa_enabled && !trustedId, viaTrusted: trustedId !== null };
  });
  if (!r.ok) throw r.error;
  return { issued: r.issued, mfaPending: r.mfaPending, viaTrusted: r.viaTrusted };
}

type RefreshResult = { ok: true; issued: Issued } | { ok: false; error: ApiError };
const REFRESH_GRACE_MS = 10_000; // CQ-005: hai tab làm mới cùng lúc

export async function refresh(token: string): Promise<Issued> {
  const r = await withAuth<RefreshResult>(async (tx) => {
    const unauth = new ApiError(401, "WF-AUTH-UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const row = await tx.one<{ id: string; session_id: string; expires_at: string; rotated_at: string | null; user_id: string; revoked_at: string | null; status: string; session_expired: boolean }>(
      `SELECT t.id, t.session_id, t.expires_at::text, t.rotated_at::text, s.user_id, s.revoked_at::text, u.status, s.expires_at <= now() AS session_expired
       FROM public.refresh_tokens t JOIN public.auth_sessions s ON s.id = t.session_id JOIN public.users u ON u.id = s.user_id
       WHERE t.token_hash = $1 FOR UPDATE OF t, s`,
      [sha256(token)],
    );
    if (!row || row.revoked_at || row.status !== "active" || row.session_expired) return { ok: false, error: unauth };
    if (row.rotated_at) {
      if (Date.now() - new Date(row.rotated_at).getTime() < REFRESH_GRACE_MS) {
        // Tab kia vừa xoay token: chỉ cấp access token mới, KHÔNG xoay và KHÔNG xóa cookie (cookie refresh mới đã về trình duyệt)
        const s = await settingsInt(tx, { "security.access_token_ttl_seconds": 900 });
        const accessTtl = s["security.access_token_ttl_seconds"]!;
        const accessToken = await signAccess({ sub: row.user_id, sid: row.session_id }, accessTtl);
        return { ok: true, issued: { userId: row.user_id, sessionId: row.session_id, accessToken, accessTtl, refreshToken: null, refreshTtlDays: 0 } };
      }
      // Dùng lại token đã xoay ⇒ thu hồi cả phiên (BR-SEC-06)
      await tx.q(`UPDATE public.refresh_tokens SET reuse_detected_at = now() WHERE id = $1`, [row.id]);
      await tx.q(`UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'refresh_reuse' WHERE id = $1`, [row.session_id]);
      await audit(tx, "auth.refresh_reuse", row.user_id, { sessionId: row.session_id }, "high");
      return { ok: false, error: unauth };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: unauth };
    const issued = await issue(tx, row.user_id, row.session_id);
    await tx.q(
      `UPDATE public.refresh_tokens SET rotated_at = now(), replaced_by = (SELECT id FROM public.refresh_tokens WHERE token_hash = $2) WHERE id = $1`,
      [row.id, sha256(issued.refreshToken!)],
    );
    await tx.q(`UPDATE public.auth_sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id]);
    return { ok: true, issued };
  });
  if (!r.ok) throw r.error;
  return r.issued;
}

export async function logout(sessionId: string | null, refreshToken: string | null): Promise<void> {
  await withAuth(async (tx) => {
    let sid = sessionId;
    if (!sid && refreshToken) {
      sid = (await tx.one<{ session_id: string }>("SELECT session_id FROM public.refresh_tokens WHERE token_hash=$1", [sha256(refreshToken)]))?.session_id ?? null;
    }
    if (sid) await tx.q(`UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'logout' WHERE id = $1 AND revoked_at IS NULL`, [sid]);
  });
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string): Promise<void> {
  const r = await withAuth<{ ok: true } | { ok: false; error: ApiError }>(async (tx) => {
    const u = await tx.one<{ email: string; password_hash: string }>("SELECT email::text, password_hash FROM public.users WHERE id = $1 FOR UPDATE", [userId]);
    if (!u || !(await verifyPassword(u.password_hash, current))) {
      return { ok: false, error: new ApiError(422, "WF-VALIDATION", "Mật khẩu hiện tại không đúng.", [{ path: "currentPassword", message: "Mật khẩu hiện tại không đúng." }]) };
    }
    const min = (await settingsInt(tx, { "security.password_min_length": 10 }))["security.password_min_length"]!;
    const p = passwordProblem(next, min, u.email);
    if (p) return { ok: false, error: new ApiError(422, "WF-PASSWORD-WEAK", p, [{ path: "newPassword", message: p }]) };
    if (await verifyPassword(u.password_hash, next)) {
      return { ok: false, error: new ApiError(422, "WF-PASSWORD-WEAK", "Mật khẩu mới phải khác mật khẩu cũ.", [{ path: "newPassword", message: "Mật khẩu mới phải khác mật khẩu cũ." }]) };
    }
    await tx.q(`UPDATE public.users SET password_hash = $2, must_change_password = false, password_changed_at = now() WHERE id = $1`, [userId, await hashPassword(next)]);
    await tx.q(`UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'password_changed' WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, [userId, sessionId]);
    await audit(tx, "auth.password_changed", userId, null, "high");
    return { ok: true };
  });
  if (!r.ok) throw r.error;
}

// ===== MFA =====
export async function mfaSetup(userId: string, email: string): Promise<{ secret: string; uri: string }> {
  return withAuth(async (tx) => {
    const cur = await tx.one<{ enabled_at: string | null }>("SELECT enabled_at::text FROM public.user_mfa WHERE user_id = $1", [userId]);
    if (cur?.enabled_at) throw new ApiError(409, "WF-CONFLICT", "Xác thực 2 bước đã bật.");
    const secret = newTotpSecret();
    await tx.q(
      `INSERT INTO public.user_mfa (user_id, totp_secret_enc) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET totp_secret_enc = EXCLUDED.totp_secret_enc, enabled_at = NULL, last_used_step = NULL`,
      [userId, encryptPii(secret)],
    );
    return { secret, uri: totpUri(secret, email) };
  });
}

type MfaResult = { ok: true; recoveryCodes?: string[]; trusted?: { token: string; days: number } } | { ok: false; error: ApiError };

/** Xác minh mã TOTP (hoặc mã khôi phục). Lần đầu ⇒ bật MFA + trả mã khôi phục (hiện một lần). */
/** trust: người dùng tick "Tin cậy thiết bị này" — chỉ hiệu lực khi đây là lần xác minh khi đăng nhập (2FA đã bật từ trước) và tính năng chưa tắt. */
export async function mfaVerify(userId: string, sessionId: string, code: string, trust?: { userAgent: string; ipHash: string }): Promise<{ recoveryCodes?: string[]; trusted?: { token: string; days: number } }> {
  const r = await withAuth<MfaResult>(async (tx) => {
    const bad = new ApiError(401, "WF-AUTH-MFA-INVALID", "Mã xác thực không đúng hoặc đã hết hạn.");
    const m = await tx.one<{ totp_secret_enc: string; enabled_at: string | null; recovery_codes_hash: string[]; last_used_step: number | null }>(
      "SELECT totp_secret_enc, enabled_at::text, recovery_codes_hash, last_used_step FROM public.user_mfa WHERE user_id = $1 FOR UPDATE",
      [userId],
    );
    if (!m) return { ok: false, error: new ApiError(409, "WF-CONFLICT", "Chưa thiết lập xác thực 2 bước.") };
    const clean = code.replace(/\s+/g, "");
    let recoveryCodes: string[] | undefined;
    if (/^\d{6}$/.test(clean)) {
      const step = verifyTotp(decryptPii(m.totp_secret_enc), clean);
      if (step === null || (m.last_used_step !== null && step <= m.last_used_step)) {
        await audit(tx, "auth.mfa_failed", userId, null);
        return { ok: false, error: bad };
      }
      await tx.q("UPDATE public.user_mfa SET last_used_step = $2 WHERE user_id = $1", [userId, step]);
    } else if (m.enabled_at && /^[0-9a-f]{10}$/i.test(clean)) {
      const h = sha256(clean.toLowerCase());
      if (!m.recovery_codes_hash.includes(h)) { await audit(tx, "auth.mfa_failed", userId, null); return { ok: false, error: bad }; }
      await tx.q("UPDATE public.user_mfa SET recovery_codes_hash = array_remove(recovery_codes_hash, $2) WHERE user_id = $1", [userId, h]);
      await audit(tx, "auth.recovery_code_used", userId, { left: m.recovery_codes_hash.length - 1 }, "high");
    } else {
      return { ok: false, error: bad };
    }
    if (!m.enabled_at) {
      recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex"));
      await tx.q("UPDATE public.user_mfa SET enabled_at = now(), recovery_codes_hash = $2 WHERE user_id = $1", [userId, recoveryCodes.map((c) => sha256(c))]);
      await tx.q("UPDATE public.users SET mfa_enabled = true WHERE id = $1", [userId]);
      await audit(tx, "auth.mfa_enabled", userId, null, "high");
    }
    await tx.q("UPDATE public.auth_sessions SET mfa_at = now(), reauth_at = now() WHERE id = $1 AND user_id = $2", [sessionId, userId]);
    let trusted: { token: string; days: number } | undefined;
    if (trust && m.enabled_at) {
      trusted = (await createTrustedDevice(tx, userId, trust.userAgent, trust.ipHash)) ?? undefined;
      if (trusted) await auditTrust(tx, "auth.device_trusted", userId, { days: trusted.days }, trust.ipHash);
    }
    return { ok: true, recoveryCodes, trusted };
  });
  if (!r.ok) throw r.error;
  return { recoveryCodes: r.recoveryCodes, trusted: r.trusted };
}

export async function mfaDisable(userId: string, mfaRequired: boolean): Promise<void> {
  if (mfaRequired) throw new ApiError(409, "WF-CONFLICT", "Vai trò của bạn bắt buộc xác thực 2 bước, không tắt được.");
  await withAuth(async (tx) => {
    await tx.q("DELETE FROM public.user_mfa WHERE user_id = $1", [userId]);
    await tx.q("UPDATE public.users SET mfa_enabled = false WHERE id = $1", [userId]);
    await audit(tx, "auth.mfa_disabled", userId, null, "high");
  });
}

/** Xác thực lại cho thao tác nhạy cảm (5 phút): mật khẩu (+ TOTP nếu đã bật) */
export async function reauth(userId: string, sessionId: string, password: string, code?: string): Promise<void> {
  const r = await withAuth<{ ok: boolean; error?: ApiError }>(async (tx) => {
    const u = await tx.one<{ password_hash: string; mfa_enabled: boolean }>("SELECT password_hash, mfa_enabled FROM public.users WHERE id = $1", [userId]);
    if (!u || !(await verifyPassword(u.password_hash, password))) {
      await audit(tx, "auth.reauth_failed", userId, null);
      return { ok: false, error: new ApiError(401, "WF-AUTH-INVALID", "Mật khẩu không đúng.") };
    }
    if (u.mfa_enabled) {
      const m = await tx.one<{ totp_secret_enc: string; last_used_step: number | null }>("SELECT totp_secret_enc, last_used_step FROM public.user_mfa WHERE user_id=$1 FOR UPDATE", [userId]);
      const step = code && m ? verifyTotp(decryptPii(m.totp_secret_enc), code) : null;
      if (step === null || (m!.last_used_step !== null && step <= m!.last_used_step)) {
        return { ok: false, error: new ApiError(401, "WF-AUTH-MFA-INVALID", "Mã xác thực 2 bước không đúng.") };
      }
      await tx.q("UPDATE public.user_mfa SET last_used_step = $2 WHERE user_id = $1", [userId, step]);
    }
    await tx.q("UPDATE public.auth_sessions SET reauth_at = now() WHERE id = $1 AND user_id = $2", [sessionId, userId]);
    return { ok: true };
  });
  if (!r.ok) throw r.error!;
}

export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  return withAuth(async (tx) => {
    const r = await tx.q("UPDATE public.auth_sessions SET revoked_at = now(), revoke_reason = 'user_revoked' WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id", [sessionId, userId]);
    return r.length > 0;
  });
}
