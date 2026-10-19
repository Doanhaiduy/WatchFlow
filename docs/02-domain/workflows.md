# Quy trình nghiệp vụ

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (viết lại theo `customer-feedback-02`: sáu việc của chủ cửa hàng)
> Mỗi quy trình: **ai làm · điều kiện · các bước · hiệu ứng hệ thống (kho / bảo hành / audit / sự kiện) · ngoại lệ**. Quy tắc chi tiết ở `business-rules` (nhóm **LEAN**); số liệu ví dụ ở `golden-scenarios`. Giao diện từng màn: `ux-and-navigation`, phong cách: `ui-design-system`.
> Các quy trình cũ (nhập hàng nhiều dòng & chi phí, thu mua từ khách, POS có thanh toán, thu cũ đổi mới, giữ hàng/cọc, kiểm kê, quyết toán CTV, thu chi) **đã bỏ khỏi sản phẩm** — thiết kế nằm ở `99-archive/` và lịch sử git (≤ v0.15.0).

## W1. Thêm đồng hồ vào kho

**Ai:** quản lý kho hoặc chủ (`purchase.create`; xác nhận ngay nếu có `purchase.confirm`). **Màn hình:** Đồng hồ → **Thêm đồng hồ** (`/dong-ho/moi`); hoặc **Nhập từ Excel** (W10).

1. Chọn **loại** (tìm theo mã/tên; thiếu thì tạo ở Loại & hãng), nhập **serial** (hoặc tick "không serial"), tình trạng (mới/cũ/đã sửa; cũ ⇒ hạng), **giá niêm yết**, vị trí lưu, ảnh (tùy chọn), nguồn hàng (tùy chọn, mặc định "Nhập kho").
2. Lưu ⇒ hệ thống lập **một phiếu nhập một dòng** và xác nhận trong cùng transaction (`fn_confirm_purchase`): tạo chiếc + mã nội bộ `DH-…`, trạng thái `in_stock` (hàng cũ/đã sửa vào `inspecting` cho tới khi kiểm tra), ghi giá nhập **nội bộ** (không giao diện nào hiển thị — CF-14), audit, sự kiện `purchase.confirmed`.
3. In **tem QR** cho chiếc mới (nút "In tem").

**Ngoại lệ:** serial trùng ⇒ `WF-UNIT-SERIAL-DUPLICATE` (CT-09); ngày tương lai ⇒ `WF-DOC-FUTURE`; bấm đúp ⇒ cùng `Idempotency-Key` ⇒ một chiếc (BR-GEN-09).

## W2. Ghi đơn bán (khách mua tại cửa hàng)

**Ai:** nhân viên bán hàng / chủ (`sale.confirm`). **Màn hình:** `/ban-hang/moi` (mobile-first). Quy tắc: BR-SALE-20…24.

1. **Chọn chiếc:** ô tìm thống nhất (mã nội bộ, serial, tên, hãng) hoặc **quét QR**. Chỉ hiện chiếc **sẵn sàng bán** và không có báo bán CTV đang chờ. Nhiều chiếc/đơn (tối đa 20).
2. **Khách:** chọn khách có sẵn hoặc **nhập ngay** họ tên (+ SĐT) — cùng SĐT thì dùng lại khách cũ (khách bắt buộc, BR-SALE-20).
3. **Giá & ngày:** giá bán từng chiếc (điền sẵn giá niêm yết hiện hành, sửa tự do — chỉ hiển thị chênh lệch so với niêm yết, không chặn), ngày bán (mặc định hôm nay; ghi lùi theo BR-GEN-08), ghi chú, **hạn bảo hành** từng chiếc (mặc định theo tình trạng; 0 = không bảo hành).
4. **Lưu** ⇒ `fn_record_sale` (một transaction): khóa chiếc theo id tăng → kiểm trạng thái → tạo đơn `HD-…` `confirmed` + dòng → chiếc `sold` → chốt giá vốn nội bộ (giữ bất biến I8) → bảo hành → audit → `sale.confirmed`. Không thanh toán, không nợ, không QR chuyển khoản.
5. **Sau lưu:** xem đơn, **in phiếu** (PDF A5/80mm, kèm hạn bảo hành; in lần 2 là "BẢN IN LẠI" + audit — BR-SALE-11), tìm lại sau theo tên/SĐT/mã đơn/serial.

**Ngoại lệ:** chiếc vừa bị người khác bán ⇒ `WF-SALE-UNIT-UNAVAILABLE` (CT-01), các dòng khác giữ nguyên để sửa; chiếc có CTV báo bán đang chờ ⇒ `WF-SALE-UNIT-CLAIMED` (xử lý báo bán trước — W5); mất mạng khi gõ ⇒ nháp lưu cục bộ, đồng bộ khi có mạng.

## W3. Hủy đơn (nhập sai)

**Ai:** chủ (`sale.void`). Đơn đã ghi **không sửa** — sai thì hủy rồi ghi lại (BR-SALE-22).

1. Mở đơn → **Hủy đơn**: lý do ≥ 10 ký tự + nhập lại mật khẩu. Chỉ trong [`sales.void_window_hours`] giờ kể từ lúc ghi (mặc định 24) ⇒ quá hạn `WF-SALE-VOID-EXPIRED`.
2. `fn_void_sale`: đơn `voided`; chiếc về `in_stock`; bảo hành `voided`; báo bán CTV đã xác nhận (nếu đơn do CTV bán) `voided`; doanh thu của đơn biến mất khỏi báo cáo. Chào hàng CTV **không** tự mở lại (giao lại nếu muốn).

## W4. Giao đồng hồ cho cộng tác viên (nhiều CTV cùng bán một chiếc)

**Ai:** chủ (`collab.manage`). **Màn hình:** `/cong-tac-vien` → **Giao hàng** (BR-COL-12).

1. **Tạo CTV:** chủ tạo tài khoản, gán vai trò `collaborator` (là đủ để được giao hàng); hồ sơ (SĐT, khu vực) là tùy chọn, **tắt hồ sơ** = ngừng giao thêm cho người đó. Không có giá thu, không có % hoa hồng.
2. **Giao:** chọn **một hoặc nhiều chiếc** `in_stock` × **một hoặc nhiều CTV** ⇒ `fn_offer_units`: mỗi cặp (chiếc, CTV) có một **chào hàng** `active`. Chiếc **vẫn ở kho** và cửa hàng vẫn bán trực tiếp được. Giao lại cho cùng CTV không nhân đôi.
3. **Thu hồi:** theo từng CTV hoặc tất cả (`fn_withdraw_offer`) — không thu hồi được khi đang có báo bán chờ xử lý (`WF-COL-CLAIM-PENDING`).
4. **Tự đóng:** chiếc rời `in_stock` bằng bất kỳ đường nào (bán, ghi mất, đưa đi kiểm tra…) ⇒ mọi chào hàng của nó tự đóng (BR-COL-16).

## W5. CTV báo "đã bán" → chủ xác nhận

**Ai:** CTV (`collab.view_own`), chủ/nhân viên bán hàng xác nhận (`sale.confirm`). **Màn hình:** CTV `/ctv`; chủ `/cong-tac-vien/bao-ban`.

1. **CTV** xem "Hàng của tôi" (ảnh, thông số, **giá niêm yết tham khảo**; không giá vốn/doanh thu/đơn/khách) — chiếc mà CTV khác đã báo hiện "CTV khác đã báo bán".
2. Khi bán được: bấm **Đã bán** + **tên và SĐT khách** + ghi chú (**không nhập giá** — BR-COL-13). Mỗi chiếc chỉ có **một** báo bán đang chờ; **ai báo trước được giữ** (CT-14); người sau nhận `WF-COL-CLAIMED`. CTV rút lại được khi còn chờ.
3. **Chủ/nhân viên** nhận thông báo (chuông + đẩy) và thấy ở "Báo bán chờ xác nhận". **Xác nhận** (BR-COL-14): giá mặc định = giá niêm yết hiện hành, sửa được; ngày; bảo hành ⇒ `fn_confirm_claim` tạo đơn bán `confirmed` có gắn CTV (khách dùng lại theo SĐT), chiếc `sold`, chào hàng của CTV thắng `won`, các CTV còn lại `lost` (+ thông báo cho họ).
4. **Từ chối** (BR-COL-15): lý do ≥ 10 ký tự ⇒ báo bán `rejected`, chiếc mở lại cho CTV khác.
5. **Doanh thu cửa hàng = giá chủ xác nhận.** CTV bán giá nào cho khách, và CTV lời/lỗ bao nhiêu, nằm ngoài hệ thống (CF-12).
6. **Thống kê:** chủ xem số chiếc + doanh thu CTV mang về theo CTV và theo ngày/tháng/quý/năm (BR-COL-18); CTV chỉ xem **số chiếc** của mình (BR-COL-17).

**Ngoại lệ:** báo bán chờ quá 1 ngày ⇒ nhắc người xác nhận (job hằng ngày); hủy đơn CTV: W3.

## W6. Sửa chữa cho khách (chỉ chủ)

**Ai:** chủ (`repair.create`, `repair.update`, `repair.deliver`). **Màn hình:** `/sua-chua`. Quy tắc: BR-REP-17.

1. **Nhận máy** (1 trang): khách (tên + **SĐT bắt buộc**; nhập ngay, cùng SĐT dùng lại khách cũ), máy (hãng/loại/serial hoặc chọn máy đã lưu của khách), tình trạng ban đầu, lỗi khách mô tả, ngày hẹn trả, ảnh (tùy chọn). Nếu máy còn **bảo hành** (chọn từ bảo hành còn hạn của khách) ⇒ phiếu `warranty_free`, **doanh thu 0**. In **phiếu nhận**.
2. **Tiến độ:** đang kiểm tra → đang sửa → chờ linh kiện (nếu cần).
3. **Khoản tiền:** thêm *dịch vụ* (giá mặc định theo loại việc; đổi giá cần `repair.price.edit`) hoặc *khoản khác* (nội dung + tiền). Không linh kiện, không cọc, không thu tiền (CF-16).
4. **Sửa xong** (`fn_complete_repair`): khóa các khoản, chốt tổng. **Giao máy** (`fn_deliver_repair`): ghi doanh thu = tổng khoản (phiếu tính phí) hoặc 0 (bảo hành); bảo hành sau sửa [`warranty.repair_days`]; in **phiếu giao trả**.
5. **Hủy** (trước khi sửa xong): lý do ≥ 10 ký tự. **Làm lại:** `completed → repairing` kèm lý do. Máy xong quá [`repair.pickup_alert_days`] ngày chưa lấy ⇒ nhắc.

Không có màn tra cứu bảo hành riêng: hạn bảo hành nằm trên đơn bán và phiếu in; khi nhận máy sửa, chủ chọn bảo hành còn hạn của khách ở bước 1 (BR-SALE-21).

## W7. Xem báo cáo

**Ai:** chủ (mọi báo cáo), bán hàng (doanh thu, số lượng), kho (số lượng đồng hồ). Quy tắc: BR-RPT-01.

1. **Tổng quan** (trang chủ): thẻ số theo quyền — doanh thu, số chiếc bán, kho, CTV chờ xác nhận, máy sửa đang làm; biểu đồ doanh thu; việc cần xử lý.
2. **Báo cáo** (3 báo cáo, theo ngày/tháng/quý/năm): *Doanh thu* (cửa hàng / CTV / sửa chữa, số đơn, số chiếc), *Số lượng đồng hồ* (đã bán theo hãng & kênh, đang có theo hãng), *Cộng tác viên* (số chiếc + doanh thu theo CTV; chỉ chủ).
3. Xuất Excel (`report.export`, tối đa 5 lần/giờ, ghi audit) và in — cùng dữ liệu và cùng lớp quyền (PT-05).

## W8. Quản trị người dùng & quyền

1. Chủ tạo người dùng (mật khẩu tạm, buộc đổi lần đầu), gán vai trò, hồ sơ CTV.
2. Chủ tùy chỉnh vai trò (bật/tắt quyền); thay đổi có audit. Mục của tính năng đã bỏ bị ẩn khỏi Cài đặt/Vai trò.
3. Quên mật khẩu: chủ đặt lại mật khẩu tạm. Khóa tạm tự động khi sai nhiều lần.

## W9. Sao lưu & khôi phục (vận hành)

Xem `05-operations/backup-restore`. Chủ chỉ cần thấy trạng thái "Sao lưu gần nhất" ở **Quản trị → Hệ thống** và nhận cảnh báo khi quá hạn.

## W10. Nhập Excel hàng loạt (khách, đồng hồ)

1. Vào **Nhập từ Excel** (Menu) hoặc nút **Nhập Excel** ở Khách hàng / Đồng hồ; chọn loại, **tải tệp mẫu** (.xlsx: sheet Dữ liệu, Hướng dẫn, Danh mục), điền, chọn tệp (.xlsx/.csv, ≤ 300 dòng).
2. Trình duyệt đọc tệp (nhận tên cột có/không dấu) và gửi các dòng; hệ thống **xem trước** từng dòng: hợp lệ / cảnh báo / lỗi (kèm lý do) / trùng — chưa ghi gì (BR-IMP-02).
3. Người dùng tích chọn dòng muốn nhập (dòng trùng mặc định bỏ qua, dòng lỗi không nhập được) rồi **Nhập**.
4. Khách: tên, SĐT, địa chỉ, ghi chú. Đồng hồ: **một phiếu `opening`** lập và xác nhận ngay (hàng cũ vào "Chờ kiểm tra"; giá nhập 0 vì không còn theo dõi giá vốn). Kết quả liệt kê từng dòng + mã phiếu (BR-IMP-07).
