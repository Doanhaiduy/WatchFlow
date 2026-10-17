import "server-only";
// Bộ bọc route API (api-conventions §1): xác thực cookie, CSRF (double-submit + Origin), kiểm quyền sớm, Zod, idempotency,
// một transaction cho cả request (SET LOCAL ROLE wf_app + app.current_user_id ⇒ RLS), thử lại 40001/40P01, lỗi RFC 9457.
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withTx, type Tx } from "./db";
import { ApiError, isRetryable, mapDbError } from "./errors";
import { verifyAccess } from "./auth/tokens";
import { COOKIE, setCsrfCookie } from "./auth/cookies";
import { hashIp } from "./pii";
import { hitMemory } from "./ratelimit";
import { recordErrorEvent } from "./ops";
import { recordActivity } from "./activity";
import { kickOutbox } from "./outbox";
import { can, type Permission } from "@/lib/permissions";

export type SessionInfo = {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  roles: string[];
  perms: string[];
  mustChangePassword: boolean;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  mfaOk: boolean;
  reauthAt: string | null;
};

export type Ctx<B, Q> = {
  req: NextRequest;
  requestId: string;
  ipHash: string;
  userAgent: string;
  params: Record<string, string>;
  body: B;
  query: Q;
  user: SessionInfo;
  /** Truy vấn trong transaction của request (dưới wf_app, RLS theo người dùng) */
  db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
  can: (p: Permission | Permission[]) => boolean;
  /** Ném WF-SEC-REAUTH nếu chưa xác thực lại trong 5 phút */
  requireReauth: () => void;
};

export type PublicCtx<B, Q> = Omit<Ctx<B, Q>, "user" | "db" | "can" | "requireReauth"> & { user: null };

type Opts<BS extends z.ZodType | undefined, QS extends z.ZodType | undefined> = {
  /** "user" (mặc định): cần đăng nhập + đủ điều kiện; "auth": đăng nhập nhưng cho qua khi chưa đổi mật khẩu/chưa MFA; "public" */
  auth?: "user" | "auth";
  perm?: Permission | Permission[];
  body?: BS;
  query?: QS;
  /** GET có ghi dữ liệu */
  writes?: boolean;
  /** Idempotency-Key: "required" | "optional" */
  idempotent?: "required" | "optional";
};

type Infer<S> = S extends z.ZodType ? z.infer<S> : undefined;
type RouteCtx = { params: Promise<Record<string, string | string[]>> };
type Handler<C> = (ctx: C) => Promise<unknown>;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function problem(err: ApiError, requestId: string): NextResponse {
  const res = NextResponse.json(
    {
      type: `https://watchflow.app/errors/${err.code}`,
      title: err.status >= 500 ? "Lỗi hệ thống" : err.detail.split(".")[0],
      status: err.status,
      code: err.code,
      detail: err.detail,
      requestId,
      ...(err.errors ? { errors: err.errors } : {}),
    },
    { status: err.status, headers: { "Content-Type": "application/problem+json", "X-Request-Id": requestId, ...(err.headers ?? {}) } },
  );
  return res;
}

function zodErrors(e: z.ZodError) {
  return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "local";
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let oh: string;
    try { oh = new URL(origin).host; } catch { oh = ""; }
    if (oh !== host) throw new ApiError(403, "WF-AUTH-CSRF", "Yêu cầu không hợp lệ (khác nguồn). Hãy tải lại trang.");
  } else {
    const sfs = req.headers.get("sec-fetch-site");
    if (sfs && sfs !== "same-origin" && sfs !== "none") throw new ApiError(403, "WF-AUTH-CSRF", "Yêu cầu không hợp lệ (khác nguồn). Hãy tải lại trang.");
  }
}

export function checkCsrf(req: NextRequest) {
  checkOrigin(req);
  const cookie = req.cookies.get(COOKIE.csrf)?.value;
  const header = req.headers.get("x-csrf-token");
  if (!cookie || !header || cookie.length !== header.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    throw new ApiError(403, "WF-AUTH-CSRF", "Phiên làm việc đã hết hạn bảo vệ. Hãy tải lại trang rồi thử lại.");
  }
}

export { checkOrigin };

async function readParams(rc: RouteCtx | undefined): Promise<Record<string, string>> {
  const p = rc?.params ? await rc.params : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) out[k] = Array.isArray(v) ? v.join("/") : v;
  return out;
}

async function parseInput<BS extends z.ZodType | undefined, QS extends z.ZodType | undefined>(req: NextRequest, o: Opts<BS, QS>) {
  let body: unknown = undefined;
  if (o.body) {
    let raw: unknown;
    try { raw = await req.json(); } catch { throw new ApiError(422, "WF-VALIDATION", "Dữ liệu gửi lên không phải JSON hợp lệ."); }
    const r = o.body.safeParse(raw);
    if (!r.success) throw new ApiError(422, "WF-VALIDATION", "Dữ liệu chưa hợp lệ. Hãy kiểm tra các ô được đánh dấu.", zodErrors(r.error));
    body = r.data;
  }
  let query: unknown = undefined;
  if (o.query) {
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const r = o.query.safeParse(sp);
    if (!r.success) throw new ApiError(422, "WF-VALIDATION", "Tham số không hợp lệ.", zodErrors(r.error));
    query = r.data;
  }
  return { body, query };
}

function toResponse(out: unknown, requestId: string, timing: string): NextResponse {
  const res = out instanceof Response ? (out as NextResponse) : out === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(out);
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("Server-Timing", timing);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handleError(e: unknown, req: NextRequest, requestId: string): Promise<NextResponse> {
  if (e instanceof ApiError) return problem(e, requestId);
  const mapped = mapDbError(e);
  if (mapped) return problem(mapped, requestId);
  const err = e as { code?: string; message?: string };
  await recordErrorEvent({ source: "api", route: req.nextUrl.pathname, code: err?.code, message: err?.message, requestId });
  if (process.env.NODE_ENV !== "production") console.error("[api]", req.method, req.nextUrl.pathname, e);
  return problem(new ApiError(500, "WF-INTERNAL", `Có lỗi xảy ra. Vui lòng thử lại; nếu lặp lại hãy báo mã ${requestId.slice(0, 8)}.`), requestId);
}

/** Route công khai (không cần đăng nhập): health, login, refresh… */
export function publicApi<BS extends z.ZodType | undefined = undefined, QS extends z.ZodType | undefined = undefined>(
  o: Opts<BS, QS> & { csrf?: "origin" | "full" | "none" },
  handler: Handler<PublicCtx<Infer<BS>, Infer<QS>>>,
) {
  return async (req: NextRequest, rc?: RouteCtx) => {
    const requestId = crypto.randomUUID();
    const t0 = Date.now();
    try {
      if (MUTATING.has(req.method)) {
        if (o.csrf === "full") checkCsrf(req);
        else if (o.csrf !== "none") checkOrigin(req);
      }
      const { body, query } = await parseInput(req, o);
      const out = await handler({
        req, requestId, ipHash: hashIp(clientIp(req)), userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200),
        params: await readParams(rc), body: body as Infer<BS>, query: query as Infer<QS>, user: null,
      });
      return toResponse(out, requestId, `app;dur=${Date.now() - t0}`);
    } catch (e) {
      return handleError(e, req, requestId);
    }
  };
}

/** Route cần đăng nhập. Toàn bộ handler chạy trong MỘT transaction (dưới wf_app). */
export function api<BS extends z.ZodType | undefined = undefined, QS extends z.ZodType | undefined = undefined>(
  o: Opts<BS, QS>,
  handler: Handler<Ctx<Infer<BS>, Infer<QS>>>,
) {
  return async (req: NextRequest, rc?: RouteCtx) => {
    const requestId = crypto.randomUUID();
    const t0 = Date.now();
    // Nhật ký hoạt động (0021): ghi SAU phản hồi, gộp lô; chỉ khi đã biết người thực hiện (phiên hợp lệ)
    const act: { userId: string | null; params: Record<string, string> } = { userId: null, params: {} };
    const track = (status: number, errorCode: string | null) => {
      if (!act.userId) return;
      recordActivity({
        userId: act.userId, method: req.method, pathname: req.nextUrl.pathname, query: req.nextUrl.searchParams, params: act.params, status,
        errorCode, durationMs: Date.now() - t0, ipHash: hashIp(clientIp(req)), requestId, at: new Date(t0),
      });
    };
    try {
      if (MUTATING.has(req.method)) checkCsrf(req);
      const at = req.cookies.get(COOKIE.at)?.value;
      const claims = at ? await verifyAccess(at) : null;
      if (!claims) throw new ApiError(401, "WF-AUTH-UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      hitMemory(claims.sub);
      act.userId = claims.sub;
      const params = (act.params = await readParams(rc));
      const { body, query } = await parseInput(req, o);
      const ipHash = hashIp(clientIp(req));
      const idemKey = req.headers.get("idempotency-key");
      if (o.idempotent === "required" && !idemKey) {
        throw new ApiError(428, "WF-IDEMPOTENCY-REQUIRED", "Thiếu khóa chống bấm đúp (Idempotency-Key). Hãy tải lại trang.");
      }
      if (idemKey && !/^[0-9a-f-]{36}$/i.test(idemKey)) throw new ApiError(422, "WF-VALIDATION", "Idempotency-Key phải là UUID.");
      const readOnly = req.method === "GET" && !o.writes;

      let attempt = 0;
      for (;;) {
        try {
          const { result, rounds } = await withTx(
            "wf_app",
            async (tx) => {
              const user = sessionFrom(tx);
              if (o.auth !== "auth") {
                if (user.mustChangePassword) throw new ApiError(403, "WF-AUTH-MUST-CHANGE-PASSWORD", "Bạn cần đổi mật khẩu tạm trước khi tiếp tục.");
                if ((user.mfaRequired && !user.mfaEnabled) || (user.mfaEnabled && !user.mfaOk)) {
                  throw new ApiError(403, "WF-AUTH-MFA-REQUIRED", "Bạn cần xác thực 2 bước trước khi tiếp tục.");
                }
              }
              if (o.perm && !can(user.perms, o.perm)) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");

              let reqHash = "";
              if (idemKey) {
                reqHash = crypto.createHash("sha256").update(req.method + req.nextUrl.pathname + JSON.stringify(body ?? null)).digest("hex");
                const ins = await tx.q(
                  `INSERT INTO public.idempotency_keys (key, user_id, route, request_hash) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING key`,
                  [idemKey, user.userId, req.nextUrl.pathname, reqHash],
                );
                if (!ins.length) {
                  const old = await tx.one<{ request_hash: string; response: unknown; status_code: number | null }>(
                    "SELECT request_hash, response, status_code FROM public.idempotency_keys WHERE key=$1 AND user_id=$2",
                    [idemKey, user.userId],
                  );
                  if (old && old.request_hash !== reqHash) throw new ApiError(422, "WF-IDEMPOTENCY-MISMATCH", "Khóa chống bấm đúp đã dùng cho một yêu cầu khác.");
                  if (old?.status_code && (old.response as { __noReplay?: boolean } | null)?.__noReplay) {
                    // Lần đầu trả file/Response không lưu được ⇒ không chạy lại (tránh thao tác hai lần)
                    throw new ApiError(409, "WF-BUSY", "Yêu cầu này đã được xử lý trước đó. Tải lại trang để xem kết quả.");
                  }
                  if (old?.status_code) return { replay: true, out: NextResponse.json(old.response, { status: old.status_code, headers: { "Idempotent-Replay": "true" } }) };
                }
              }
              const ctx: Ctx<Infer<BS>, Infer<QS>> = {
                req, requestId, ipHash, userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200), params,
                body: body as Infer<BS>, query: query as Infer<QS>, user,
                db: (fn) => fn(tx),
                can: (p) => can(user.perms, p),
                requireReauth: () => {
                  if (!user.reauthAt || Date.now() - new Date(user.reauthAt).getTime() > 5 * 60_000) {
                    throw new ApiError(401, "WF-SEC-REAUTH", "Thao tác nhạy cảm: vui lòng nhập lại mật khẩu để xác nhận.");
                  }
                },
              };
              const out = await handler(ctx);
              if (idemKey) {
                const isRes = out instanceof Response;
                await tx.q("UPDATE public.idempotency_keys SET response=$3, status_code=$4 WHERE key=$1 AND user_id=$2", [
                  idemKey, user.userId, JSON.stringify(isRes ? { __noReplay: true } : (out ?? null)), isRes ? (out as Response).status : 200,
                ]);
              }
              return { replay: false, out };
            },
            {
              readOnly: readOnly && !idemKey,
              setup: async (tx) => {
                const r = await tx.one<{ r: Record<string, unknown> }>("SELECT app.fn_begin_request($1,$2,$3,$4) AS r", [claims.sub, claims.sid, requestId, ipHash]);
                if (!r?.r || r.r.ok !== true) throw new ApiError(401, "WF-AUTH-UNAUTHENTICATED", "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.");
                sessions.set(tx, { ...(r.r as object), sessionId: claims.sid } as SessionInfo);
                // Ngày giả cho test tích hợp: chỉ khi máy chủ chạy WF_TEST_MODE=1 VÀ DB đặt app.env='test' (app.today_vn kiểm lần hai)
                const fake = process.env.WF_TEST_MODE === "1" ? req.headers.get("x-test-today") : null;
                if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) await tx.q("SELECT set_config('app.test_today', $1, true)", [fake]);
              },
            },
          );
          if (MUTATING.has(req.method)) kickOutbox();
          const res = toResponse(result.out, requestId, `db;desc="rounds ${rounds}", app;dur=${Date.now() - t0}`);
          track(res.status, null);
          return res;
        } catch (e) {
          if (isRetryable(e) && attempt < 2) { attempt++; continue; }
          throw e;
        }
      }
    } catch (e) {
      const res = await handleError(e, req, requestId);
      track(res.status, e instanceof ApiError ? e.code : (mapDbError(e)?.code ?? "WF-INTERNAL"));
      return res;
    }
  };
}

const sessions = new WeakMap<Tx, SessionInfo>();
function sessionFrom(tx: Tx): SessionInfo {
  const s = sessions.get(tx);
  if (!s) throw new ApiError(401, "WF-AUTH-UNAUTHENTICATED", "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.");
  return s;
}

/** Đảm bảo có cookie CSRF trên phản hồi (gọi ở /auth/me, /auth/login, /auth/refresh) */
export function ensureCsrf(req: NextRequest, res: NextResponse): NextResponse {
  if (!req.cookies.get(COOKIE.csrf)?.value) setCsrfCookie(res, crypto.randomBytes(24).toString("base64url"));
  return res;
}
