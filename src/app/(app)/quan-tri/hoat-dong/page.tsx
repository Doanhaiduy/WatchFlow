import { redirect } from "next/navigation";

// Đã gộp vào trang Nhật ký (tab “Truy cập & đăng nhập”) — giữ đường dẫn cũ để liên kết/ghi chú cũ vẫn dùng được.
export default function ActivityRedirect() {
  redirect("/quan-tri/nhat-ky?muc=truy-cap");
}
