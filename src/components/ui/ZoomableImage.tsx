"use client";
// Ảnh bấm vào là mở trình xem ảnh dùng chung (phóng to / kéo / chụm / lướt) — port từ Lưu Xá ZoomableImage.
// Bấm KHÔNG lan ra phần tử cha (vd. thẻ có onClick riêng); Enter / Space cũng mở được.
import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { openImageViewer, viewerImageFromSrc, type ViewerImage } from "@/lib/image-viewer";
import { cx } from "./cx";

export interface ZoomableImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onClick"> {
  src: string;
  /** Ảnh (hoặc cả bộ ảnh) mở trong trình xem khi bấm; mặc định = chính ảnh này (nhận diện /api/v1/files/<mã> để nạp ảnh đầy đủ). */
  viewer?: ViewerImage | ViewerImage[];
  /** Vị trí ảnh đang bấm trong bộ ảnh */
  index?: number;
}

export function ZoomableImage({ src, viewer, index = 0, alt, className, title, ...rest }: ZoomableImageProps) {
  const open = (e: SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openImageViewer(viewer ?? viewerImageFromSrc(src, alt), viewer ? index : 0);
  };
  return (
    <img
      {...rest}
      src={src}
      alt={alt ?? ""}
      title={title ?? "Bấm để xem ảnh lớn"}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}
      className={cx("wf-zoomable", className)}
    />
  );
}
