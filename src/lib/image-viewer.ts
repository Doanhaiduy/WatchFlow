"use client";
// Trình xem ảnh DÙNG CHUNG (port từ Lưu Xá src/lib/image-viewer.ts): mở từ bất kỳ đâu bằng openImageViewer(...).
// <ImageViewerHost /> (gắn ở layout (app)) lắng nghe sự kiện và vẽ trình xem, nên không cần truyền state qua từng component.

export interface ViewerImage {
  /** Ảnh hiển thị */
  src: string;
  /** Ảnh gốc nét hơn — nạp ngầm rồi thay vào khi tải xong (tùy chọn) */
  fullSrc?: string;
  alt?: string;
  /** Dòng chú thích hiện ở dưới */
  caption?: string;
  /** Địa chỉ tải về (mặc định: ảnh đang xem) */
  downloadUrl?: string;
  downloadName?: string;
}

export const IMAGE_VIEWER_EVENT = "watchflow:image-viewer";

export function openImageViewer(images: ViewerImage | ViewerImage[], index = 0) {
  if (typeof window === "undefined") return;
  const list = Array.isArray(images) ? images : [images];
  if (!list.length) return;
  window.dispatchEvent(new CustomEvent(IMAGE_VIEWER_EVENT, { detail: { images: list, index: Math.min(Math.max(0, index), list.length - 1) } }));
}

/** Ảnh lưu trên máy chủ (kiểm quyền theo RLS qua /api/v1/files/{id}). */
export const fileViewerImage = (fileId: string, alt?: string, caption?: string): ViewerImage => ({
  src: `/api/v1/files/${fileId}`,
  alt,
  caption,
});

/** Nhận diện /api/v1/files/<mã>[/thumb] để dựng ViewerImage ảnh đầy đủ; không nhận ra ⇒ dùng nguyên URL. */
export function viewerImageFromSrc(src: string, alt?: string, caption?: string): ViewerImage {
  const m = /^\/api\/v1\/files\/([0-9a-f-]{36})(?:\/thumb)?(?:\?.*)?$/i.exec(src);
  return m?.[1] ? fileViewerImage(m[1], alt, caption) : { src, alt, caption };
}
