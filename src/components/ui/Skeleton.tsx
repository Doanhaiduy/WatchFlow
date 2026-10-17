// Vệt sáng quét skeleton: Lucian UX/UI Prompt #079 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#079
// (chỉ lấy lớp shimmer .u079-sk; CSS gốc ở ../lucian/lucian-079.css). Có thể dùng ở server component.
import type { CSSProperties } from "react";
import "../lucian/lucian-079.css";
import { cx } from "./cx";

type Props = {
  w?: number | string;
  h?: number | string;
  /** Bo tròn hoàn toàn (avatar) */
  circle?: boolean;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** Khối giữ chỗ khi tải. Đặt bên trong `SkeletonGroup` (hoặc tự thêm role="status") để đọc màn hình biết đang tải. */
export function Skeleton({ w = "100%", h = 14, circle, radius, className, style }: Props) {
  return (
    <span className={cx("ux u079-s wf-skb", className)} style={{ width: w, height: h, borderRadius: circle ? "50%" : (radius ?? 10), ...style }} aria-hidden="true">
      <span className="u079-sk" />
    </span>
  );
}

export function SkeletonGroup({ children, label = "Đang tải…", className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/** Khung danh sách inset giả (ảnh + 2 dòng + số) */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonGroup className={cx("wf-ig g g-flat", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="wf-ir" style={{ pointerEvents: "none" }}>
          <Skeleton w={48} h={48} radius={15} />
          <span className="wf-irm" style={{ display: "grid", gap: 8 }}>
            <Skeleton w="62%" h={13} />
            <Skeleton w="38%" h={11} />
          </span>
          <Skeleton w={64} h={14} />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Thẻ KPI giả */
export function SkeletonKpis({ count = 3 }: { count?: number }) {
  return (
    <SkeletonGroup className="wf-kpis">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="wf-kpi g" style={{ display: "grid", gap: 8 }}>
          <Skeleton w="60%" h={10} />
          <Skeleton w="80%" h={22} />
        </div>
      ))}
    </SkeletonGroup>
  );
}
