"use client";
// Lưới ảnh nhỏ (thumb) — bấm mở trình xem ảnh toàn màn hình, vuốt/qua lại giữa các ảnh trong lưới. Vẫn là liên kết thật (chuột giữa/Ctrl+bấm mở tab mới).
import { openImageViewer, fileViewerImage } from "@/lib/image-viewer";

export type PhotoItem = { id: string; url: string; thumbUrl: string };

export function PhotoGrid({ photos, label = "ảnh" }: { photos: PhotoItem[]; label?: string }) {
  if (photos.length === 0) return null;
  const all = photos.map((p, i) => ({ ...fileViewerImage(p.id, `${label} ${i + 1}/${photos.length}`), src: p.url }));
  return (
    <div className="wf-photos">
      {photos.map((p, i) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Xem ${label} ${i + 1}/${photos.length}`}
          onClick={(e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            openImageViewer(all, i);
          }}
        >
          <img src={p.thumbUrl} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
