"use client";
// Tải ảnh/tệp lên máy chủ (POST /api/v1/files) CÓ TIẾN ĐỘ và HỦY ĐƯỢC (port từ Lưu Xá src/lib/uploader.ts).
// Các bước: tối ưu ảnh ngay trên trình duyệt (image-optimize.ts) → gửi bằng XMLHttpRequest (để có % tiến độ) → máy chủ kiểm magic bytes,
// xóa EXIF, mã hóa lại, tạo thumb rồi trả mã tệp. Hết phiên (401) thì làm mới phiên một lần rồi gửi lại. CSRF header như api-client.ts.
import { ApiClientError, csrfToken, refreshSession } from "./api-client";
import { optimizeImage } from "./image-optimize";

export type UploadKind = "product" | "condition" | "other" | "id_document" | "evidence" | "intake";
export type UploadPhase = "optimizing" | "uploading" | "processing";

export interface UploadTarget {
  kind: UploadKind;
  entityTable: string;
  entityId: string;
}

export interface UploadedFile {
  id: string;
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface UploadOptions {
  /** Tỷ lệ đã gửi (0–1) của pha "uploading" */
  onProgress?: (ratio: number) => void;
  onPhase?: (phase: UploadPhase) => void;
  /** Hủy giữa chừng: ném DOMException AbortError */
  signal?: AbortSignal;
  /** false = gửi nguyên bản, không thu nhỏ/nén (mặc định tối ưu ảnh) */
  optimize?: boolean;
}

/** Lỗi mạng (mất kết nối/quá thời gian) — giao diện hiện nút "Thử lại" */
export class UploadNetworkError extends Error {}

const abortError = () => new DOMException("Đã hủy tải lên.", "AbortError");
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

function post(form: FormData, opts: UploadOptions): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(abortError());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/files");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-CSRF-Token", csrfToken() ?? "");
    xhr.withCredentials = true;
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.min(1, e.loaded / e.total));
    xhr.upload.onload = () => {
      opts.onProgress?.(1);
      opts.onPhase?.("processing");
    };
    const onAbort = () => xhr.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const done = () => opts.signal?.removeEventListener("abort", onAbort);
    xhr.onabort = () => {
      done();
      reject(abortError());
    };
    xhr.onerror = () => {
      done();
      reject(new UploadNetworkError("Mất kết nối khi tải lên — kiểm tra mạng rồi thử lại."));
    };
    xhr.ontimeout = () => {
      done();
      reject(new UploadNetworkError("Tải lên quá lâu — kiểm tra mạng rồi thử lại."));
    };
    xhr.onload = () => {
      done();
      let body: { detail?: string; code?: string; errors?: { path: string; message: string }[] } & Partial<UploadedFile> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* không phải JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as UploadedFile);
      reject(new ApiClientError(xhr.status, body.code ?? `HTTP_${xhr.status}`, body.detail ?? `Lỗi ${xhr.status}`, undefined, body.errors));
    };
    xhr.send(form);
  });
}

export async function uploadFile(file: File, target: UploadTarget, opts: UploadOptions = {}): Promise<UploadedFile> {
  opts.onPhase?.("optimizing");
  const { file: out, exifDate } = opts.optimize === false ? { file, exifDate: null } : await optimizeImage(file);
  if (opts.signal?.aborted) throw abortError();
  const build = () => {
    const form = new FormData();
    form.append("kind", target.kind);
    form.append("entityTable", target.entityTable);
    form.append("entityId", target.entityId);
    if (exifDate) form.append("exifDate", exifDate);
    form.append("file", out);
    return form;
  };
  opts.onPhase?.("uploading");
  opts.onProgress?.(0);
  try {
    return await post(build(), opts);
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 401 && (await refreshSession())) {
      opts.onProgress?.(0);
      opts.onPhase?.("uploading");
      return post(build(), opts);
    }
    throw e;
  }
}
