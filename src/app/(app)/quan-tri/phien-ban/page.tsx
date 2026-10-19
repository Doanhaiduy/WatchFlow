import { redirect } from "next/navigation";

// Đã bỏ tab Phiên bản: “Có gì mới” nằm ở cuối trang Hướng dẫn.
export default function VersionRedirect() {
  redirect("/huong-dan#co-gi-moi");
}
