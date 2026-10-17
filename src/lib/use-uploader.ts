"use client";
// Trạng thái tải lên của MỘT ô/một tệp (port từ Lưu Xá src/lib/use-uploader.ts): run(file, target) tải (có tiến độ), cancel() hủy.
// `state` = null khi rảnh. Tự hủy khi component bị gỡ ra để không để lại yêu cầu treo.
import { useCallback, useEffect, useRef, useState } from "react";
import { isAbort, uploadFile, UploadNetworkError, type UploadedFile, type UploadPhase, type UploadTarget } from "./uploader";

export interface UploadState {
  name: string;
  phase: UploadPhase;
  /** 0–1: tiến độ gửi (chỉ có nghĩa ở pha "uploading") */
  ratio: number;
}

export function useUploader() {
  const [state, setState] = useState<UploadState | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => () => ctl.current?.abort(), []);

  const run = useCallback(async (file: File, target: UploadTarget): Promise<UploadedFile> => {
    const mine = new AbortController();
    ctl.current = mine;
    const current = () => ctl.current === mine; // lượt chạy cũ (bị thay/hủy) không được ghi đè trạng thái lượt mới
    setState({ name: file.name, phase: "optimizing", ratio: 0 });
    try {
      return await uploadFile(file, target, {
        signal: mine.signal,
        onPhase: (phase) => current() && setState((s) => (s ? { ...s, phase } : s)),
        onProgress: (ratio) => current() && setState((s) => (s ? { ...s, ratio } : s)),
      });
    } finally {
      if (current()) setState(null);
    }
  }, []);

  const cancel = useCallback(() => ctl.current?.abort(), []);
  return { state, uploading: state !== null, run, cancel };
}

/** Thông điệp lỗi cho người dùng; null nếu người dùng chủ động hủy (không phải lỗi). `retryable` = lỗi mạng. */
export function uploadErrorInfo(e: unknown): { message: string; retryable: boolean } | null {
  if (isAbort(e)) return null;
  const message = e instanceof Error && e.message ? e.message : "Tải lên thất bại. Vui lòng thử lại.";
  return { message, retryable: e instanceof UploadNetworkError };
}
