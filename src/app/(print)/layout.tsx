import type { ReactNode } from "react";

/** Khung trang in (tem…): không sidebar/dock để khi in chỉ còn nội dung */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <main style={{ padding: 16, minHeight: "100vh" }}>{children}</main>;
}
