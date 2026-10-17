"use client";
// Lucian UX/UI Prompt #032 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#032
// Kéo-thả tải ảnh: viền nét đứt chạy khi kéo vào, mỗi tệp có thanh tiến trình riêng. Bản WatchFlow: nén ảnh trên trình duyệt → tải thật bằng XHR (pha: tối ưu / tải lên % / xử lý), có nút Hủy và Thử lại (lib/uploader.ts, use-uploader.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadErrorInfo, useUploader } from "@/lib/use-uploader";
import type { UploadKind, UploadPhase } from "@/lib/uploader";
import "./lucian-032.css";

type Props = {
  kind: UploadKind;
  entityTable: string;
  entityId: string;
  /** Gọi sau mỗi tệp tải xong */
  onUploaded: () => void;
  disabled?: boolean;
};

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const PHASE: Record<UploadPhase, string> = { optimizing: "Đang tối ưu ảnh…", uploading: "Đang tải lên", processing: "Đang xử lý…" };
let seq = 0;

type Result = { s: "done" } | { s: "fail"; msg: string; retryable: boolean } | { s: "cancelled" };

/** Một tệp đang tải: tự chạy khi gắn vào, có Hủy / Thử lại. Mỗi dòng giữ hook tải riêng nên nhiều ảnh tải song song độc lập. */
function UploadRow({ file, target, onDone, onRemove }: { file: File; target: { kind: UploadKind; entityTable: string; entityId: string }; onDone: () => void; onRemove: () => void }) {
  const { state, run, cancel } = useUploader();
  const [res, setRes] = useState<Result | null>(null);
  const attempt = useRef(0);
  const cbs = useRef({ onDone, target });
  cbs.current = { onDone, target };

  const start = useCallback(async () => {
    const my = ++attempt.current; // StrictMode gắn 2 lần: lượt cũ bị hủy không được ghi đè kết quả lượt mới
    setRes(null);
    try {
      await run(file, cbs.current.target);
      if (my !== attempt.current) return;
      setRes({ s: "done" });
      cbs.current.onDone();
    } catch (e) {
      if (my !== attempt.current) return;
      const info = uploadErrorInfo(e);
      setRes(info ? { s: "fail", msg: info.message, retryable: info.retryable } : { s: "cancelled" });
    }
  }, [file, run]);
  useEffect(() => {
    void start();
  }, [start]);

  const phase = state?.phase;
  const up = phase !== undefined;
  const ratio = state && phase === "uploading" ? state.ratio : 0;
  const done = res?.s === "done";
  const fail = res?.s === "fail" || res?.s === "cancelled";
  const text = phase
    ? phase === "uploading"
      ? `${PHASE.uploading} ${Math.round(ratio * 100)}% · ${size(file.size * ratio)} / ${size(file.size)}`
      : PHASE[phase]
    : res?.s === "fail"
      ? res.msg
      : res?.s === "cancelled"
        ? "Đã hủy tải lên"
        : done
          ? `${size(file.size)} · Đã tải lên`
          : "";
  const indeterminate = up && phase !== "uploading";

  return (
    <li className={`u032-row${done ? " done" : fail ? " fail" : ""}${indeterminate ? " indet" : ""}`} style={{ "--p": (done ? 1 : ratio).toFixed(3) } as React.CSSProperties}>
      <span className="u032-ic" style={{ "--c": "var(--ux-accent)" } as React.CSSProperties} aria-hidden="true">
        ẢNH
      </span>
      <span className="u032-meta">
        <b>{file.name}</b>
        <small>{text}</small>
      </span>
      {up ? (
        <button className="u032-cancel" type="button" onClick={cancel} aria-label={`Hủy tải ${file.name}`}>
          Hủy
        </button>
      ) : fail ? (
        <>
          {(res?.s === "cancelled" || (res?.s === "fail" && res.retryable)) && (
            <button className="u032-retry" type="button" onClick={() => void start()}>
              Thử lại
            </button>
          )}
          <button className="u032-cancel" type="button" onClick={onRemove} aria-label={`Bỏ ${file.name}`}>
            Bỏ
          </button>
        </>
      ) : done ? (
        <span className="u032-st">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.4l3 3 6-6.4" />
          </svg>
        </span>
      ) : null}
      <span className="u032-bar" aria-hidden="true" />
    </li>
  );
}

type Item = { key: number; file: File; reject?: string };

export function ImageUpload({ kind, entityTable, entityId, onUploaded, disabled }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const target = { kind, entityTable, entityId };

  const add = (files: FileList | File[]) => {
    const next = Array.from(files).map((f): Item => {
      const ok = f.type.startsWith("image/") || (/\.(heic|heif)$/i.test(f.name) && f.type === "");
      return { key: ++seq, file: f, reject: ok ? undefined : "Chỉ nhận tệp ảnh (JPG, PNG, WebP, HEIC)" };
    });
    setItems((r) => [...next.reverse(), ...r].slice(0, 6));
  };
  const remove = (key: number) => setItems((r) => r.filter((x) => x.key !== key));

  return (
    <div className={`ux u032${over ? " is-over" : ""}`}>
      <button
        className="u032-zone"
        type="button"
        disabled={disabled}
        onClick={() => pick.current?.click()}
        onDragEnter={(e) => (e.preventDefault(), depth.current++, setOver(true))}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          if (--depth.current <= 0) {
            depth.current = 0;
            setOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <svg className="u032-dash" aria-hidden="true">
          <rect width="100%" height="100%" rx="25" />
        </svg>
        <span className="u032-orb" aria-hidden="true">
          <svg viewBox="0 0 28 28">
            <path d="M8.5 20.5H7a5 5 0 0 1-.6-10 7 7 0 0 1 13.4-1.6A5.5 5.5 0 0 1 21 20.5h-1.5M14 13v10M10.5 16.5L14 13l3.5 3.5" />
          </svg>
        </span>
        <b>
          Kéo ảnh vào đây hoặc <em>chọn từ máy</em>
        </b>
        <small>JPG, PNG, WebP, HEIC · chụp trực tiếp trên điện thoại được</small>
      </button>
      <input ref={pick} className="u032-file" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" onChange={(e) => (e.target.files && add(e.target.files), (e.target.value = ""))} />
      <ul className="u032-list" aria-live="polite">
        {items.map((it) =>
          it.reject ? (
            <li key={it.key} className="u032-row fail">
              <span className="u032-ic" style={{ "--c": "var(--ux-accent)" } as React.CSSProperties} aria-hidden="true">
                ẢNH
              </span>
              <span className="u032-meta">
                <b>{it.file.name}</b>
                <small>{it.reject}</small>
              </span>
              <button className="u032-cancel" type="button" onClick={() => remove(it.key)} aria-label={`Bỏ ${it.file.name}`}>
                Bỏ
              </button>
            </li>
          ) : (
            <UploadRow key={it.key} file={it.file} target={target} onDone={onUploaded} onRemove={() => remove(it.key)} />
          ),
        )}
      </ul>
    </div>
  );
}
