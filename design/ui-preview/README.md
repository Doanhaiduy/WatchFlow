# Bản xem thử giao diện WatchFlow (UI tĩnh)

> **Khách đã chọn mẫu 6 — Glass (`v6-glass.html`)** (2026-10-16, `docs/01-product/customer-feedback-01.md` CF-09). Đặc tả để dựng thật: `docs/03-architecture/ui-design-system.md`. Các mẫu 1–5 giữ làm lịch sử, **không dựng**.

6 phương án giao diện để khách tham khảo và chọn, mỗi phương án có **điện thoại** và **máy tính**, bấm qua lại được giữa 16 màn hình (tổng quan, đồng hồ + chi tiết, bán hàng/POS, sửa chữa, thu chi & công nợ, nhập hàng, khách hàng, giữ hàng, đổi trả, linh kiện, kiểm kê, báo cáo, cộng tác viên, quản trị, phiếu bán).

> Đây là **bản trình diễn tĩnh**: dữ liệu là minh họa (cửa hàng "Minh Châu Watch"), không có máy chủ, không ghi gì. Không phải mã nguồn của ứng dụng — khi khách đã chọn mẫu, mới dựng thật bằng Next.js + Tailwind theo `docs/`.

## Gửi cho khách
Gửi đúng **một file**: [`dist/watchflow-ui-preview.html`](dist/watchflow-ui-preview.html) (~0,8 MB, mở bằng trình duyệt, cần Internet để tải phông chữ Google Fonts). Sinh lại sau khi sửa mẫu:

```
node build.mjs
```

## Cấu trúc
| Tệp | Nội dung |
|---|---|
| `index.html` | Trang chọn mẫu: chuyển mẫu, chuyển Điện thoại/Máy tính, nhảy nhanh tới từng màn hình, "Chọn mẫu này" + sao chép lựa chọn |
| `v1-horologe.html` … `v6-glass.html` | 6 phương án (mỗi tệp là một giao diện đầy đủ, responsive 390px → 1366px) |
| `assets/shared.js` | Dữ liệu minh họa, đồng hồ vẽ bằng SVG, icon, biểu đồ, giỏ hàng POS, định tuyến |
| `build.mjs` | Gộp tất cả vào một file HTML |

Mở `index.html` trực tiếp bằng trình duyệt (không cần máy chủ). Tham số: `index.html?dev=desktop&i=3` mở mẫu 3 ở chế độ máy tính. Phím tắt: `←` `→` đổi mẫu, `M` / `D` đổi thiết bị.

## 6 phương án
| # | Tên | Phong cách | Bố cục điện thoại | Bố cục máy tính |
|---|---|---|---|---|
| 1 | Horologe | Sang trọng kiểu tạp chí: ngà · xanh rêu · vàng, chữ serif | Tab dưới + nút Bán nổi, số liệu kẻ dòng, "Mục lục" | Không sidebar, menu ngang như đầu báo |
| 2 | Clarity | Dashboard xanh dương quen thuộc | Header xanh + thẻ nổi + 4 ô pastel | Sidebar + bảng + KPI sparkline |
| 3 | Bento | Ô gạch pastel, số khổng lồ | Lưới 2 cột, dock đen nổi | Thanh icon + mosaic ô |
| 4 | Command | Dày thông tin, mono, điểm nhấn cam | Tab chữ trên + nút "Lệnh nhanh" | 3 khung (menu · bảng · chi tiết) + ⌘K |
| 5 | Quầy | POS teal, lưới ô icon | Lưới 8 ô + nút Bán nổi giữa | Buồng lái POS, Kanban sửa chữa |
| 6 | Glass | Kính mờ, gradient sáng | Tiêu đề lớn, dock kính, nút "+" phát sáng | Sidebar đảo nổi + cột tiện ích |

## Lưu ý quan trọng — mẫu ≠ phạm vi hiện tại
Mẫu v6-glass được làm **trước** phản hồi vòng 1 nên còn các màn/nhãn đã bị loại: *Thu chi & công nợ*, *Đổi trả*, nhãn "thợ", "Quỹ tiền", "Khách nợ/NCC", "Nợ NCC", "Hoa hồng" (xem bảng "màn hình mẫu → ứng dụng" ở `ui-design-system` §6). Dùng mẫu để lấy **hình thức** (kính mờ, dock, thẻ, bố cục), không lấy nghiệp vụ. Màn mới (CTV, Giao hàng/Quyết toán, Bảo hành, Thống kê CTV, Đăng nhập…) cần bản tĩnh bổ sung theo cùng khung trước khi code.

## Ghi chú cho giai đoạn dựng thật
- Thanh điều hướng dưới ở các mẫu chưa khớp hoàn toàn `docs/01-product/ux-and-navigation.md` §2 (tài liệu đang ở trạng thái *Nháp — chốt khi dựng giao diện*). Khi khách chọn mẫu, **cập nhật tài liệu đó** cho khớp (CLAUDE.md: code và docs không được lệch).
- Màn hình theo vai trò (nhân viên, kho, thợ, cộng tác viên) chưa có trong bản này; mỗi mẫu hiện hiển thị góc nhìn **chủ cửa hàng** (đủ quyền, thấy giá vốn/lãi).
- Dữ liệu cá nhân trong mẫu đều là tên/SĐT giả và đã che (`0987 *** 301`); khi dựng thật, CCCD/SĐT phụ phải mã hóa theo `docs/03-architecture/security-model.md`.
