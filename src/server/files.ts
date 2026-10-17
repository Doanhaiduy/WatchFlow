import "server-only";
// Xử lý tệp tải lên: kiểm magic bytes (không tin Content-Type/đuôi), giới hạn kích thước, đọc thời điểm chụp (EXIF) rồi
// XÓA toàn bộ metadata (GPS…) khi mã hóa lại, xoay theo EXIF, giới hạn 2000px, sinh thumbnail WebP 400px.
import crypto from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import { ApiError } from "./errors";
import { putObject, type Bucket } from "./storage";
import { todayVn } from "@/lib/dates";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const FILE_KINDS = ["product", "condition", "intake", "evidence", "id_document", "logo", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export function bucketFor(kind: FileKind): Bucket {
  if (kind === "id_document" || kind === "evidence") return "documents";
  if (kind === "intake") return "repair-photos";
  if (kind === "logo") return "branding";
  return "unit-photos";
}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "heif" | "pdf" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp" && /^(heic|heix|mif1|msf1|heif)/.test(buf.subarray(8, 12).toString("ascii"))) return "heif";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return null;
}

export type Processed = {
  bucket: Bucket;
  path: string;
  thumbPath: string | null;
  mime: string;
  size: number;
  thumbSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
};

/** `clientTakenAt`: ngày chụp trình duyệt đọc từ EXIF trước khi nén (ISO) — chỉ dùng khi ảnh gửi lên không còn EXIF. */
export async function processUpload(buf: Buffer, kind: FileKind, clientTakenAt: string | null = null): Promise<Processed> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "WF-FILE-TOO-LARGE", "Tệp quá lớn (tối đa 10 MB).");
  const type = sniff(buf);
  if (!type) throw new ApiError(422, "WF-FILE-INVALID", "Định dạng tệp không được hỗ trợ (chỉ ảnh JPEG/PNG/WebP/HEIC hoặc PDF).");
  if (type === "pdf" && kind !== "evidence" && kind !== "id_document") {
    throw new ApiError(422, "WF-FILE-INVALID", "Mục này chỉ nhận ảnh.");
  }
  const bucket = bucketFor(kind);
  const id = crypto.randomUUID();
  const dir = `${todayVn().slice(0, 7)}/${id}`;
  if (type === "pdf") {
    const p = `${dir}.pdf`;
    await putObject(bucket, p, buf, "application/pdf");
    return { bucket, path: p, thumbPath: null, mime: "application/pdf", size: buf.length, thumbSize: 0, sha256: sha(buf), width: null, height: null, takenAt: null };
  }
  let takenAt: string | null = null;
  try {
    const ex = (await exifr.parse(buf, ["DateTimeOriginal", "CreateDate"])) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
    const d = ex?.DateTimeOriginal ?? ex?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) takenAt = d.toISOString();
  } catch {
    /* ảnh không có EXIF */
  }
  takenAt ??= clientTakenAt;
  let main: Buffer, thumb: Buffer, meta: { width: number; height: number };
  try {
    const out = await sharp(buf, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    main = out.data;
    meta = out.info;
    thumb = await sharp(main).resize({ width: 400, height: 400, fit: "cover" }).webp({ quality: 75 }).toBuffer();
  } catch {
    throw new ApiError(422, "WF-FILE-INVALID", "Không đọc được ảnh. Hãy chụp/chọn ảnh khác.");
  }
  const p = `${dir}.webp`;
  const tp = `${dir}_thumb.webp`;
  await putObject(bucket, p, main, "image/webp");
  await putObject(bucket, tp, thumb, "image/webp");
  return { bucket, path: p, thumbPath: tp, mime: "image/webp", size: main.length, thumbSize: thumb.length, sha256: sha(main), width: meta.width, height: meta.height, takenAt };
}

function sha(b: Buffer) {
  return crypto.createHash("sha256").update(b).digest("hex");
}
