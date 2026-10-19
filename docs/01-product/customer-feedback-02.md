# Phản hồi của chủ cửa hàng — vòng 2: rút gọn về đúng 6 việc

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (chủ cửa hàng chốt trực tiếp, 2026-10-18)
> **Tài liệu này thắng** `customer-feedback-01` ở mọi chỗ mâu thuẫn (cùng quy tắc: docs khác phải sửa theo đây). Thiết kế đầy đủ trước đợt này nằm ở lịch sử git (commit `250a3cf` và trước đó) và `docs/99-archive/`.

## 1. Mục đích của website (nguyên văn tinh thần của chủ cửa hàng)

Website chỉ để **chủ cửa hàng**:
1. **Quản lý đồng hồ hiện có** (kho).
2. **Ghi lại đơn khi khách mua**: khách mua đồng hồ nào thì nhập thông tin để lưu lại tra cứu sau này.
3. **Giao đồng hồ cho cộng tác viên (CTV) đi bán**: *một chiếc có thể giao cho nhiều CTV cùng lúc; CTV nào bán được trước thì được*.
4. **Quản lý đơn sửa chữa đồng hồ của khách** (chỉ chủ được thao tác): lưu thông tin khách, máy, lỗi, tiến độ, tiền sửa.
5. **Báo cáo** doanh thu, số lượng đồng hồ, và doanh thu/số lượng CTV mang về — theo ngày, tháng, quý, năm.
6. **CTV cũng dùng được web nhưng ở mức nhất định, không thấy doanh thu**.

"Chủ yếu chỉ có vậy." Mọi thứ ngoài 6 việc này là thừa, trừ khi bên dưới có ghi giữ.

## 2. Quyết định

| ID | Nội dung | Quyết định |
|---|---|---|
| CF-10 | CTV: giá thu, giá bán thực của CTV, quyết toán/nộp tiền, phần CTV hưởng | **Bỏ hẳn.** Cửa hàng không quan tâm CTV bán giá bao nhiêu, chỉ cần bán được. |
| CF-11 | Một chiếc giao nhiều CTV | **Có.** Chiếc vẫn là `in_stock` (cửa hàng vẫn bán được); CTV nào gửi "đã bán" trước thì giữ chiếc đó, các CTV khác tự mất quyền; chủ xác nhận hoặc từ chối. |
| CF-12 | Doanh thu của chiếc CTV bán | **Giá niêm yết hiện hành của chiếc, chủ sửa được khi xác nhận.** CTV không nhập và không thấy doanh thu. |
| CF-13 | Phiếu bán | **Chỉ ghi: chiếc + khách + giá + ngày (+ ghi chú, hạn bảo hành).** Không theo dõi thanh toán (tiền mặt/chuyển khoản/QR/tiền thừa), không ghi nợ & thu thêm. |
| CF-14 | Giữ hàng/đặt cọc · Thu cũ đổi mới · Kiểm kê · Linh kiện (tồn kho) · Giá vốn & lãi gộp · Phiếu nhập nhiều dòng | **Bỏ khỏi giao diện/API.** Hàm và dữ liệu DB cũ để nguyên (ngủ), sẽ dọn bằng migration "contract" sau. Thêm chiếc vào kho: **Thêm đồng hồ** (từng chiếc) và **Nhập từ Excel** (hàng loạt). |
| CF-15 | Bảo hành | **Giữ dạng gọn:** đơn bán có *hạn bảo hành* (mặc định hàng mới 12 tháng, hàng cũ 3 tháng, sửa được); hiện trên đơn và phiếu in. Không có màn tra cứu/nhận máy bảo hành riêng. |
| CF-16 | Sửa chữa | Chỉ khách + máy + lỗi + tiến độ + tiền sửa. Bỏ: linh kiện dùng, sửa nội bộ (máy cửa hàng), cọc/thu tiền/ghi nợ, duyệt báo giá. |
| CF-17 | Báo cáo | Chỉ còn: **Doanh thu**, **Số lượng đồng hồ**, **Cộng tác viên** (theo ngày/tháng/quý/năm). |
| CF-18 | Thừa thải khác (đã nêu ở phiên rà soát) | Gộp Nhật ký + Hoạt động thành MỘT trang (2 mục); bỏ tab Phiên bản ("Có gì mới" ở cuối trang Hướng dẫn); bỏ VietQR; bỏ các báo cáo trùng/đã hết nghĩa; Nhập Excel còn khách + đồng hồ (bỏ linh kiện, CCCD, nhóm khách, giá vốn); trang Cài đặt và Vai trò & quyền ẩn mục của tính năng đã bỏ. **Giữ nguyên** chuông thông báo + thông báo đẩy (là kênh báo "CTV báo bán" cho chủ và "đồng hồ mới/kết quả" cho CTV). |

## 3. Việc CTV thấy / làm được

Thấy: chiếc được giao cho mình (ảnh, hãng, loại, tình trạng, **giá niêm yết** tham khảo), đơn mình đã báo, số chiếc mình bán được theo tháng/quý/năm. **Không thấy:** giá vốn, doanh thu, đơn của người khác, chiếc không giao cho mình.
Làm: "Báo đã bán" một chiếc (tên + SĐT khách + ghi chú), huỷ báo khi còn chờ.

## 4. Vai trò còn lại

Chủ (toàn quyền) · Nhân viên bán hàng (ghi đơn bán, khách, xem đồng hồ) · Quản lý kho (thêm/sửa đồng hồ, vị trí) · CTV. Sửa chữa: **chỉ chủ** (quyền `repair.*` mặc định chỉ chủ).

## 5. Tác động

- DB: migration `0023_simple_mode.sql` (đơn bán gọn + mô hình CTV mới). Không xóa bảng/hàm cũ.
- Code: gỡ các trang/API/thành phần của phần đã bỏ; viết lại Bán hàng, Cộng tác viên, màn CTV, báo cáo, Tổng quan, Hướng dẫn.
- Tài liệu: `CLAUDE.md` (phạm vi), `workflows`, `business-rules` (BR-COL-*, BR-SALE-*), `state-machines`, `money-and-payments`, `reports-and-dashboard`, `ux-and-navigation`, `ui-design-system` §6, `guide.ts`.
