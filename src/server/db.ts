import "server-only";
// Kết nối DB của ứng dụng (vai trò wf_api, NOINHERIT). Mọi truy vấn người dùng chạy trong transaction với
// SET LOCAL ROLE wf_app + app.current_user_id ⇒ RLS. Không bao giờ chạy bằng superuser/chủ bảng.
import pg from "pg";
import { env } from "./env";

// bigint (int8) → number (mọi số tiền < 2^53); numeric giữ chuỗi (giá bình quân numeric(14,4))
pg.types.setTypeParser(20, (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error("Giá trị bigint vượt 2^53");
  return n;
});
pg.types.setTypeParser(1082, (v) => v); // date → "YYYY-MM-DD" (không chuyển Date)

const g = globalThis as unknown as { __wfPool?: pg.Pool; __wfAuxPool?: pg.Pool };

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "::1"];

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.includes(host) && !env.allowRemoteDb && process.env.VERCEL !== "1") {
    throw new Error(`DATABASE_URL trỏ ra ngoài máy (${host}) — bị chặn. Đặt ALLOW_REMOTE_DB=true nếu thật sự cần.`);
  }
}

/**
 * TLS: DB_SSL_CA ⇒ kiểm chứng chỉ bằng CA đó (bỏ sslmode/sslrootcert trong URL — node-postgres để URL đè cấu hình ssl).
 * DB ngoài máy mà không có DB_SSL_CA ⇒ URL phải tự khai sslmode=verify-full (không bao giờ nối DB ngoài bằng kết nối trần).
 */
function connConfig(url: string): { connectionString: string; ssl?: pg.PoolConfig["ssl"] } {
  const u = new URL(url);
  const ca = process.env.DB_SSL_CA;
  if (ca) {
    u.searchParams.delete("sslmode");
    u.searchParams.delete("sslrootcert");
    return { connectionString: u.toString(), ssl: { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true } };
  }
  if (!LOCAL_HOSTS.includes(u.hostname) && u.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("DB ngoài máy cần TLS có kiểm chứng chỉ: đặt DB_SSL_CA hoặc thêm sslmode=verify-full vào DATABASE_URL.");
  }
  return { connectionString: url };
}

function makePool(max: number, name: string): pg.Pool {
  const url = env.databaseUrl;
  assertLocal(url);
  const p = new pg.Pool({
    ...connConfig(url),
    max,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10_000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
    // Chặn truy vấn/khóa treo giữ kết nối (serverless): mỗi phiên DB có trần thời gian
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 30_000),
    lock_timeout: Number(process.env.DB_LOCK_TIMEOUT_MS || 10_000),
    idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_TX_TIMEOUT_MS || 30_000),
    application_name: name,
  });
  p.on("error", () => {});
  return p;
}

/** Pool chính: transaction của người dùng (wf_app). */
export function pool(): pg.Pool {
  return (g.__wfPool ??= makePool(env.poolMax, "watchflow"));
}

/**
 * Mở sẵn vài kết nối của pool chính (máy chủ chạy lâu, KHÔNG dùng trên serverless) để lần tải trang đầu không phải chờ
 * bắt tay TLS tới DB ở xa. Số kết nối = DB_POOL_WARM (mặc định 2), không vượt DB_POOL_MAX. Trả về số kết nối đã mở.
 */
export async function warmPool(): Promise<number> {
  const n = Math.max(0, Math.min(Number(process.env.DB_POOL_WARM || 2) || 0, env.poolMax));
  if (n === 0) return 0;
  const p = pool();
  const clients = await Promise.all(Array.from({ length: n }, () => p.connect()));
  await Promise.all(clients.map((c) => c.query("SELECT 1")));
  clients.forEach((c) => c.release());
  return n;
}

/**
 * Pool phụ (wf_auth/wf_worker): đếm giới hạn tốc độ, xác thực, outbox — có thể được gọi khi request vẫn giữ kết nối
 * wf_app. Tách pool để không bao giờ chờ vòng tròn (N request giữ hết pool chính rồi cùng chờ thêm kết nối).
 */
function auxPool(): pg.Pool {
  return (g.__wfAuxPool ??= makePool(Number(process.env.DB_AUX_POOL_MAX || 2), "watchflow-aux"));
}

export type Tx = {
  q<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Gọi hàm DB trả jsonb: SELECT app.fn_x($1,…) AS r */
  fn<T = unknown>(name: string, params?: unknown[]): Promise<T>;
  client: pg.PoolClient;
  rounds: number;
};

function wrap(client: pg.PoolClient): Tx {
  const tx: Tx = {
    client,
    rounds: 0,
    async q(sql, params) {
      tx.rounds++;
      if (env.dbTrace) console.debug("[sql]", sql.replace(/\s+/g, " ").slice(0, 200));
      return (await client.query(sql, params as unknown[])).rows;
    },
    async one(sql, params) {
      return (await tx.q(sql, params))[0] as never;
    },
    async fn(name, params = []) {
      if (!/^app\.[a-z_0-9]+$/.test(name)) throw new Error("Tên hàm không hợp lệ");
      const ph = params.map((_, i) => `$${i + 1}`).join(",");
      const r = await tx.one<{ r: unknown }>(`SELECT ${name}(${ph}) AS r`, params);
      return r?.r as never;
    },
  };
  return tx;
}

export type DbRole = "wf_app" | "wf_auth" | "wf_worker";

/**
 * Chạy fn trong một transaction dưới vai trò DB chỉ định.
 * `setup` chạy ngay sau BEGIN (vd. fn_begin_request trước khi SET ROLE).
 */
export async function withTx<T>(
  role: DbRole,
  fn: (tx: Tx) => Promise<T>,
  opts: { readOnly?: boolean; setup?: (tx: Tx) => Promise<void>; vars?: Record<string, string> } = {},
): Promise<{ result: T; rounds: number }> {
  const client = await (role === "wf_app" ? pool() : auxPool()).connect();
  const tx = wrap(client);
  try {
    await client.query(opts.readOnly ? "BEGIN READ ONLY" : "BEGIN");
    if (opts.setup) await opts.setup(tx);
    const sets = Object.entries(opts.vars ?? {}).map(([k], i) => `set_config('${k.replace(/[^a-z_.]/g, "")}', $${i + 1}, true)`);
    await client.query(`SELECT set_config('role', '${role}', true)${sets.length ? ", " + sets.join(", ") : ""}`, Object.values(opts.vars ?? {}));
    const result = await fn(tx);
    await client.query("COMMIT");

    return { result, rounds: tx.rounds + 2 };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Cron/worker: wf_worker (BYPASSRLS, không UPDATE/DELETE bảng bất biến) */
export function withWorker<T>(fn: (tx: Tx) => Promise<T>) {
  return withTx("wf_worker", fn).then((r) => r.result);
}

/** Xác thực: wf_auth */
export function withAuth<T>(fn: (tx: Tx) => Promise<T>, vars?: Record<string, string>) {
  return withTx("wf_auth", fn, { vars }).then((r) => r.result);
}
