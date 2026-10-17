import "server-only";
// Lưu tệp: driver "local" (.local/storage/<bucket>/<path>) hoặc "supabase" (Storage REST bằng service_role — chỉ máy chủ).
// Bucket riêng tư: unit-photos, repair-photos, documents, branding. Đọc qua /api/v1/files/{id} (kiểm quyền theo RLS bảng files).
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export type Bucket = "unit-photos" | "repair-photos" | "documents" | "branding";
const LOCAL_ROOT = path.join(process.cwd(), ".local", "storage");

function safePath(bucket: Bucket, p: string): string {
  if (!/^[a-z0-9/_.-]+$/i.test(p) || p.includes("..")) throw new Error("Đường dẫn tệp không hợp lệ");
  return path.join(LOCAL_ROOT, bucket, p);
}

export async function putObject(bucket: Bucket, p: string, data: Buffer, contentType: string): Promise<void> {
  if (env.storageDriver === "local") {
    const full = safePath(bucket, p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data, { flag: "wx" });
    return;
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Thiếu cấu hình Supabase Storage");
  const r = await fetch(`${base}/storage/v1/object/${bucket}/${p}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "false" },
    body: new Uint8Array(data),
  });
  if (!r.ok) throw new Error(`Tải tệp lên Storage lỗi ${r.status}`);
}

export async function getObject(bucket: Bucket, p: string): Promise<Buffer | null> {
  if (env.storageDriver === "local") {
    try {
      return await fs.readFile(safePath(bucket, p));
    } catch {
      return null;
    }
  }
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${p}`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

/** Xóa đối tượng khỏi Supabase Storage (mẫu Lưu Xá deleteFromSupabase). true = Storage xác nhận 2xx (đối tượng đã không còn cũng tính là xong). */
async function deleteFromSupabase(bucket: Bucket, objPaths: string[]): Promise<boolean> {
  if (objPaths.length === 0) return true;
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return false;
  try {
    const r = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: objPaths }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Xóa hẳn tệp (bản chính + thumb) khỏi kho. Trả về id các tệp đã xóa XONG; tệp lỗi KHÔNG có trong kết quả để lượt sau thử lại.
 * Idempotent: tệp không còn (đã xóa trước đó) tính là xong. Lỗi một tệp không làm hỏng các tệp khác.
 */
export async function purgeStorageFiles(files: { id: string; bucket: Bucket; path: string; thumb_path: string | null }[]): Promise<string[]> {
  const done: string[] = [];
  if (env.storageDriver === "local") {
    for (const f of files) {
      try {
        for (const p of [f.path, f.thumb_path]) if (p) await fs.rm(safePath(f.bucket, p), { force: true });
        done.push(f.id);
      } catch {
        /* lượt sau thử lại */
      }
    }
    return done;
  }
  const byBucket = new Map<Bucket, typeof files>();
  for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f]);
  for (const [bucket, list] of byBucket) {
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const ok = await deleteFromSupabase(bucket, chunk.flatMap((f) => [f.path, f.thumb_path].filter((x): x is string => !!x)));
      if (ok) done.push(...chunk.map((f) => f.id));
    }
  }
  return done;
}
