import type { HTMLAttributes, ReactNode } from "react";
import { cx, type Tone } from "./cx";

type Props = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li" | "aside";
  /** Thêm padding 16px */
  padded?: boolean;
  /** Nền kính KHÔNG blur — dùng cho danh sách dài (§7.2) */
  flat?: boolean;
  tone?: Tone;
  children?: ReactNode;
};

/** Khối kính `.g` (§5). Chỉ dùng blur cho khối nổi; danh sách dài dùng `flat`. */
export function GlassCard({ as: Tag = "div", padded, flat, tone, className, children, ...rest }: Props) {
  return (
    <Tag className={cx("g", flat && "g-flat", padded && "wf-pad", className)} data-tone={tone} {...rest}>
      {children}
    </Tag>
  );
}
