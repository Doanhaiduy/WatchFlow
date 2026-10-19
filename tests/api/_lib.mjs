// Tiện ích test tích hợp: client HTTP (cookie jar + CSRF), đăng nhập (kèm TOTP cho owner), kết nối DB như ứng dụng (wf_api → wf_app).
import pg from "pg";
import { TOTP, Secret } from "otpauth";

pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1082, (v) => v);

export const BASE = process.env.TEST_BASE_URL;
export const ACC = JSON.parse(process.env.TEST_ACCOUNTS || "{}");
export const userOf = (role, i = 0) => ACC.users.filter((u) => u.role === role)[i];

export class Client {
  constructor() { this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv, ...attrs] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
      const maxAge = attrs.find((a) => /max-age=/i.test(a));
      if (v === "" || (maxAge && /max-age=0\b/i.test(maxAge))) this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  csrf() { return this.jar.get("wf_csrf"); }
  async req(method, path, body, headers = {}) {
    const h = { Origin: BASE, ...(this.today ? { "X-Test-Today": this.today } : {}), ...headers };
    if (this.jar.size) h.Cookie = this.cookieHeader();
    if (method !== "GET" && this.csrf() && !("X-CSRF-Token" in headers)) h["X-CSRF-Token"] = this.csrf();
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
    this.store(res);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }
  get(p, h) { return this.req("GET", p, undefined, h); }
  post(p, b, h) { return this.req("POST", p, b ?? {}, h); }
  put(p, b, h) { return this.req("PUT", p, b, h); }
  patch(p, b, h) { return this.req("PATCH", p, b, h); }
  del(p, h) { return this.req("DELETE", p, undefined, h); }
}

export function totpNow(secret = ACC.totpSecret, offsetSteps = 0) {
  return new TOTP({ secret: Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

/** Đăng nhập; owner tự qua TOTP (reset chống dùng lại ở DB test để không phải chờ 30 giây) */
export async function login(role = "owner", { mfa = true, password = ACC.password, email } = {}) {
  const c = new Client();
  const em = email ?? userOf(role).email;
  const r = await c.post("/api/v1/auth/login", { email: em, password });
  if (r.status !== 200) throw new Error(`Đăng nhập ${em} lỗi ${r.status}: ${JSON.stringify(r.body)}`);
  if (r.body.mfaPending && mfa) {
    await ownerSql("UPDATE public.user_mfa SET last_used_step = NULL WHERE user_id = (SELECT id FROM public.users WHERE email = $1)", [em]);
    const v = await c.post("/api/v1/auth/mfa/verify", { code: totpNow() });
    if (v.status !== 200) throw new Error("MFA lỗi " + JSON.stringify(v.body));
  }
  c.email = em;
  return c;
}

/** Xác thực lại (thao tác nhạy cảm) */
export async function reauth(c) {
  await ownerSql("UPDATE public.user_mfa SET last_used_step = NULL WHERE user_id = (SELECT id FROM public.users WHERE email = $1)", [c.email]);
  const r = await c.post("/api/v1/auth/reauth", { password: ACC.password, code: totpNow() });
  if (r.status !== 200) throw new Error("reauth lỗi " + JSON.stringify(r.body));
}

// ===== DB =====
export async function ownerSql(sql, params) {
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

/** Kết nối như ứng dụng (wf_api) — mỗi lần một kết nối mới (test đồng thời) */
export async function apiConn() {
  const c = new pg.Client({ connectionString: process.env.TEST_API_DB_URL });
  await c.connect();
  return c;
}

/**
 * Chạy fn trong transaction dưới wf_app với ngữ cảnh người dùng (giống src/server/http.ts).
 * Tạo phiên DB hợp lệ cho user nếu cần. Trả kết quả fn; lỗi DB ném nguyên.
 */
export async function asUser(userId, fn, { today } = {}) {
  const [s] = await ownerSql("INSERT INTO public.auth_sessions (user_id, mfa_at) VALUES ($1, now()) RETURNING id", [userId]);
  const c = await apiConn();
  try {
    await c.query("BEGIN");
    const r = await c.query("SELECT app.fn_begin_request($1,$2,'test','test') AS r", [userId, s.id]);
    if (!r.rows[0].r.ok) throw new Error("fn_begin_request từ chối");
    await c.query("SELECT set_config('role','wf_app',true)");
    if (today) await c.query("SELECT set_config('app.test_today',$1,true)", [today]);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

/** Mã WF-* từ lỗi DB (MESSAGE JSON) */
export function wfCode(e) {
  try { return JSON.parse(e.message).code; } catch { return e.code ?? e.message; }
}

export async function expectWf(promise, code) {
  try { await promise; } catch (e) {
    if (wfCode(e) !== code) throw new Error(`Mong ${code}, nhận ${wfCode(e)}: ${e.message}`);
    return;
  }
  throw new Error(`Mong lỗi ${code} nhưng thành công`);
}

let _unitSeq = 0;
/** Tạo nhanh một chiếc trong kho (qua kết nối chủ DB, bật app.seed) — dùng cho test cần dữ liệu riêng. */
export async function makeUnit(listPrice, { cond = "new", status = "in_stock", serial } = {}) {
  const [model] = await ownerSql("SELECT id, brand_id FROM public.watch_models ORDER BY code LIMIT 1");
  const [loc] = await ownerSql("SELECT id FROM public.storage_locations ORDER BY name LIMIT 1");
  const code = `TU-${Date.now().toString(36)}-${++_unitSeq}`;
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("SELECT set_config('app.seed','on',false)");
    const r = await c.query(
      `INSERT INTO public.watch_units (asset_code, model_id, brand_id, serial_no, condition, condition_grade, status, location_id, list_price_vnd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [code, model.id, model.brand_id, serial ?? code, cond, cond === "new" ? null : "A", status, loc.id, listPrice]);
    return { id: r.rows[0].id, code };
  } finally { await c.end(); }
}
