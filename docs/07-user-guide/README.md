# Hướng dẫn sử dụng — dàn bài

> Cập nhật lần cuối: 2026-10-17 · Trạng thái: Đã viết nội dung (M9) — bản in: [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md) · Đã cập nhật theo `customer-feedback-01` (vai trò: chủ, bán hàng, kho, cộng tác viên — không còn thợ)
> **Nguồn sự thật nội dung:** `src/content/guide.ts` (hiển thị trong ứng dụng, lọc theo vai trò). File `docs/07-user-guide/HUONG_DAN_SU_DUNG.md` được **sinh** từ đó bằng `pnpm docs:guide` để in/phát cho nhân viên — **đừng sửa tay file sinh ra**.

## Nguyên tắc viết

1. Theo **việc người dùng làm** ("Bán một chiếc đồng hồ"), không theo menu.
2. Mỗi mục: *Khi nào dùng · Các bước (có ảnh chụp theo giao diện Glass) · Lưu ý & lỗi thường gặp*. Câu ngắn, đời thường, đúng thuật ngữ `glossary` (đặc biệt **giá thu**, **Đang ở CTV**, **bảo hành**).
3. Có phần **"Nếu có chuyện gì đó sai"**: xử lý lỗi hay gặp bằng lời, kèm mã lỗi `WF-…` và cách xử.
4. Mỗi vai trò có một khung 1 trang "Hướng dẫn nhanh" (in dán quầy).
5. Cập nhật cùng PR đổi tính năng (Định nghĩa hoàn thành trong `CLAUDE.md`).

## Mục lục theo vai trò

### Chung (mọi người)
- Đăng nhập, đổi mật khẩu, bật xác thực 2 bước (TOTP), thiết bị tin cậy
- Cài ứng dụng lên màn hình điện thoại
- Làm quen giao diện: thanh dock, nút "+", menu; máy tính: thanh bên
- Tìm kiếm nhanh & quét QR
- Khi mất mạng: nháp tự lưu, gửi lại an toàn
- Chuông thông báo; xem phiên bản

### Chủ cửa hàng
- Tổng quan: đọc số liệu — **vì sao doanh thu, thực thu và lãi là ba con số khác nhau**
- Thiết lập ban đầu: thông tin cửa hàng, vai trò & hạn mức giảm giá, người dùng, hồ sơ CTV, cài đặt bảo hành
- Nhập hàng (không có nhà cung cấp — ghi nguồn hàng); thu mua từ khách; tồn đầu kỳ
- Sửa chữa: nhận máy (ảnh tùy chọn), ghi trạng thái, dịch vụ & linh kiện, giao máy, sửa cho máy của cửa hàng
- Bảo hành: tra cứu, nhận máy bảo hành
- **Cộng tác viên**: giao hàng kèm giá thu, xác nhận đơn, quyết toán, thu hồi, thống kê tháng/quý/năm
- Điều chỉnh giá vốn; ghi mất / thanh lý; hủy phiếu bán (trong 24 giờ); tịch thu cọc
- Báo cáo & xuất Excel/PDF (Tiền thu, Phiếu còn nợ, Thống kê CTV…)
- Nhật ký hoạt động; xem CCCD (khi nào được, vì sao phải nêu lý do)
- Sao lưu & khôi phục: kiểm tra trạng thái, việc cần làm mỗi quý
- Sự cố thường gặp & liên hệ

### Nhân viên bán hàng
- Bán nhanh: tìm/quét, giá, giảm giá (hạn mức), thanh toán kết hợp, tiền thừa, nợ & hẹn trả
- In phiếu bán; in lại
- **Thu thêm tiền** trên phiếu còn nợ
- Giữ hàng / đặt cọc; chuyển thành bán; hoàn cọc
- Thu cũ đổi mới (giấy tờ người bán, ảnh máy)
- Tra cứu bảo hành cho khách (chuyển chủ nhận máy)
- Tạo khách nhanh; xem lịch sử khách
- Xác nhận đơn nháp của cộng tác viên

### Quản lý kho
- Nhập hàng từ nguồn; nhập nhanh một chiếc; chi phí liên quan & phân bổ
- Thu mua từ khách (biên bản)
- In tem QR; vị trí lưu kho & di chuyển
- Chiếc "Chờ kiểm tra": kiểm tra & cho bán
- Linh kiện: nhập, điều chỉnh, ngưỡng cảnh báo
- Kiểm kê (quét QR, chênh lệch, lý do)
- Hủy phiếu nhập / điều chỉnh giá vốn (khi nào được)

### Cộng tác viên
- Xem hàng đang giữ (ảnh, **giá thu**)
- Bán và tạo đơn cho khách của mình: nhập **giá bán thực**, thông tin khách
- Điều gì xảy ra sau khi gửi đơn (chờ xác nhận → đã xác nhận → nộp giá thu)
- Theo dõi thống kê của mình: số chiếc, bán ra, phải nộp, **phần mình hưởng**
- Nộp giá thu cho chủ (quyết toán); trả lại hàng chưa bán
- Những gì bạn **không** thấy (giá vốn, khách của người khác) — và vì sao

### Phụ lục
- Bảng thuật ngữ (từ `glossary`)
- Danh sách mã lỗi thường gặp và cách xử lý (sinh từ `src/server/errors.ts`)
- Mẹo cho máy tính (phím tắt, máy quét mã vạch dạng bàn phím)
- Câu hỏi thường gặp

## Đào tạo

Buổi đào tạo theo vai trò trước go-live (45–60 phút/vai trò): làm lại **kịch bản vàng** trên staging (SC-02/03/04 cho bán hàng, SC-01 cho kho, SC-08 và SC-07 cho chủ khi sửa chữa/bảo hành, SC-12 cho chủ và CTV). Mỗi người đạt khi tự làm đúng không cần nhắc. Lưu danh sách người đã đào tạo ở `runbook`.
