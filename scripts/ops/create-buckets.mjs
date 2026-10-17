// Tạo 4 bucket Storage RIÊNG TƯ trên Supabase qua API (khỏi vào dashboard) — idempotent.
// Dùng riêng: node scripts/ops/create-buckets.mjs --env staging|production   (thường đã gọi trong pnpm db:deploy:<env>)
// Cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (dẫn xuất bởi pnpm env:check). Không bao giờ in khóa.
import { loadEnv } from "../lib/env.mjs";
import { targetEnv } from "../lib/db.mjs";

export const BUCKETS = ["unit-photos", "repair-photos", "documents", "branding"];
const LIMIT = 15 * 1024 * 1024; // 15 MB / tệp

export async function ensureBuckets({ url, key, log = console.log } = {}) {
  if (!url || !key) throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const call = async (method, path, body) => {
    const r = await fetch(`${url}/storage/v1${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (!r.ok) throw new Error(`Storage ${method} ${path} → HTTP ${r.status}: ${text.slice(0, 160)}`);
    return text ? JSON.parse(text) : null;
  };
  const have = new Map((await call("GET", "/bucket")).map((b) => [b.id, b]));
  for (const id of BUCKETS) {
    const b = have.get(id);
    if (!b) {
      await call("POST", "/bucket", { id, name: id, public: false, file_size_limit: LIMIT });
      log(`✔ bucket ${id}: đã tạo (riêng tư, ≤ 15 MB/tệp)`);
    } else if (b.public) {
      await call("PUT", `/bucket/${id}`, { public: false, file_size_limit: LIMIT });
      log(`✔ bucket ${id}: đang CÔNG KHAI → đã chuyển riêng tư`);
    } else {
      log(`✔ bucket ${id}: đã có (riêng tư)`);
    }
  }
}

const isMain = process.argv[1] && /create-buckets\.mjs$/.test(process.argv[1]);
if (isMain) {
  const env = targetEnv();
  if (env === "local") { console.error("Chỉ dùng cho staging|production: --env staging"); process.exit(1); }
  loadEnv(env, { override: true });
  await ensureBuckets({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }).catch((e) => { console.error("✘ " + e.message); process.exit(1); });
}
