# Hướng dẫn sử dụng — dàn bài

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Nháp (viết nội dung đầy đủ ở M9; từng mốc bổ sung mục tương ứng ngay khi tính năng xong)
> **Nguồn sự thật nội dung:** `src/content/guide.ts` (hiển thị trong ứng dụng, lọc theo vai trò). File `docs/07-user-guide/HUONG_DAN_SU_DUNG.md` được **sinh** từ đó bằng `node --experimental-strip-types scripts/docs/export-guide.mjs` để in/phát cho nhân viên — **đừng sửa tay file sinh ra**.

## Nguyên tắc viết

1. Theo **việc người dùng làm** ("Bán một chiếc đồng hồ"), không theo menu.
2. Mỗi mục: *Khi nào dùng · Các bước (có ảnh chụp) · Lưu ý & lỗi thường gặp*. Câu ngắn, đời thường, đúng thuật ngữ `glossary`.
3. Có phần **"Nếu có chuyện gì đó sai"**: xử lý lỗi hay gặp bằng lời, kèm mã lỗi `WF-…` và cách xử.
4. Mỗi vai trò có một khung 1 trang "Hướng dẫn nhanh" (in dán quầy).
5. Cập nhật cùng PR đổi tính năng (Định nghĩa hoàn thành trong `CLAUDE.md`).

## Mục lục theo vai trò

### Chung (mọi người)
- Đăng nhập, đổi mật khẩu, bật xác thực 2 bước (TOTP), thiết bị tin cậy
- Cài ứng dụng lên màn hình chính điện thoại
- Tìm kiếm nhanh & quét QR
- Khi mất mạng: nháp tự lưu, gửi lại an toàn
- Chuông thông báo
- Sáng/tối; xem phiên bản

### Chủ cửa hàng
- Tổng quan: đọc số liệu — **vì sao doanh thu, thực thu và lãi là ba con số khác nhau**
- Thiết lập ban đầu: thông tin cửa hàng, quỹ & số dư đầu kỳ, vai trò & hạn mức giảm giá, người dùng, hồ sơ thợ/CTV
- Chốt ngày; đối chiếu quỹ; khóa kỳ; mở lại kỳ
- Điều chỉnh giá vốn; điều chỉnh quỹ; hủy phiếu thu/chi
- Duyệt: hủy phiếu bán, đổi trả quá hạn, tịch thu cọc, thanh lý/ghi mất hàng
- Chi trả hoa hồng CTV & tiền công thợ
- Báo cáo & xuất Excel/PDF
- Nhật ký hoạt động; xem CCCD (khi nào được, vì sao phải nêu lý do)
- Sao lưu & khôi phục: kiểm tra trạng thái, việc cần làm mỗi quý
- Sự cố thường gặp & liên hệ

### Nhân viên bán hàng
- Bán nhanh: tìm/quét, giá, giảm giá (hạn mức), thanh toán kết hợp, tiền thừa, nợ & hẹn trả
- In phiếu bán; in lại
- Giữ hàng / đặt cọc; chuyển thành bán; hoàn/tịch thu cọc
- Thu cũ đổi mới (giấy tờ người bán, ảnh máy)
- Đổi trả
- Thu nợ khách
- Nhận máy sửa chữa; ghi khách đồng ý báo giá; giao máy & thu tiền
- Tạo khách nhanh; xem lịch sử khách
- Xác nhận đơn nháp của cộng tác viên

### Quản lý kho
- Nhập hàng từ nhà cung cấp; nhập nhanh một chiếc; chi phí liên quan & phân bổ
- Thu mua từ khách (biên bản)
- In tem QR; vị trí lưu kho & di chuyển
- Chiếc "Chờ kiểm tra": kiểm tra & cho bán
- Linh kiện: nhập, điều chỉnh, ngưỡng cảnh báo
- Kiểm kê (quét QR, chênh lệch, lý do)
- Hủy phiếu nhập / điều chỉnh giá vốn (khi nào được)

### Thợ sửa chữa
- "Việc của tôi": nhận việc, ghi kiểm tra
- Thêm nhân công & linh kiện; **xác nhận dùng** linh kiện
- Chờ linh kiện; hoàn thành; làm lại
- Xem tiền công của mình
- Chụp ảnh đúng cách

### Cộng tác viên
- Xem hàng đang bán (ảnh, giá)
- Lập đơn nháp cho khách của mình
- Theo dõi hoa hồng (chờ / có thể nhận / đã nhận)
- Những gì bạn **không** thấy (giá vốn, khách của người khác) — và vì sao

### Phụ lục
- Bảng thuật ngữ (từ `glossary`)
- Danh sách mã lỗi thường gặp và cách xử lý (sinh từ `src/server/errors.ts`)
- Mẹo cho máy tính (phím tắt, máy quét mã vạch dạng bàn phím)
- Câu hỏi thường gặp

## Đào tạo

Buổi đào tạo theo vai trò trước go-live (45–60 phút/vai trò): làm lại **kịch bản vàng** trên staging (SC-02/03/04 cho bán hàng, SC-01 cho kho, SC-08 cho thợ, SC-10/16 cho chủ). Mỗi người đạt khi tự làm đúng không cần nhắc. Lưu danh sách người đã đào tạo ở `runbook`.
